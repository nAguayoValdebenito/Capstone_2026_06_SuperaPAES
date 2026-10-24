// Escenario de las pruebas de sesión y permisos (HU-02.1 consola, HU-03.3): la app con los servicios
// reales de cuentas y administracion sobre repositorios en memoria que imitan app.token_sesion y
// contenido.usuario_interno, y un reloj que se adelanta para simular el paso del tiempo sin esperar.
import { createHash } from 'node:crypto';
import request from 'supertest';
import { expect } from 'vitest';
import { crearApp, crearServicios, type Dependencias } from '../app.js';
import { cifrarContrasena } from '../comun/contrasenas.js';
import type { Audiencia } from '../comun/jwt.js';
import type { RolCuentaInterna } from '../comun/roles.js';
import type { Ejecutor, UnidadDeTrabajo } from '../db/transaccion.js';
import { crearAdministracionServicio } from '../modulos/administracion/index.js';
import type { CuentasRepositorio, NuevaSesion } from '../modulos/cuentas/cuentas.repositorio.js';
import { crearCuentasServicio, type CuentasServicio } from '../modulos/cuentas/index.js';
import { crearDependenciasDePrueba } from './ayudantes.js';
import { crearRepositorioFalso } from './escenario-usuarios-internos.js';

export const RUTA_INGRESO = '/api/v1/admin/cuentas/ingreso';
export const RUTA_RENOVAR = '/api/v1/admin/cuentas/renovar';
export const RUTA_CERRAR = '/api/v1/admin/cuentas/cerrar';
export const RUTA_YO = '/api/v1/admin/cuentas/yo';

export const conToken = (token: string) => ({ Authorization: `Bearer ${token}` });
export const sha256 = (texto: string) => createHash('sha256').update(texto).digest('hex');

export interface FilaSesion extends NuevaSesion {
  id: string;
  revocadoEn: Date | null;
}

type Usuarios = ReturnType<typeof crearRepositorioFalso>['usuarios'];

const abierta = (fila: FilaSesion, ahora: Date) =>
  fila.revocadoEn === null && fila.expiraEn.getTime() > ahora.getTime();

/** app.token_sesion en memoria, con las mismas condiciones que el SQL de cuentas.repositorio.ts. */
function crearRepositorioCuentas(usuarios: Usuarios, sesiones: Map<string, FilaSesion>) {
  let siguienteId = 1;
  const buscar = (tipo: Audiencia, hashToken: string) =>
    [...sesiones.values()].find((f) => f.tipo === tipo && f.hashToken === hashToken);
  const vigente = (tipo: Audiencia, sid: string, cuentaId: string, ahora: Date) => {
    const fila = sesiones.get(sid);
    return fila?.tipo === tipo && fila.cuentaId === cuentaId && abierta(fila, ahora);
  };
  const repositorio: CuentasRepositorio = {
    buscarCredencialesInternas: (correo) => {
      const u = [...usuarios.values()].find((x) => x.correo.toLowerCase() === correo.toLowerCase());
      if (!u) return Promise.resolve(null);
      const { id, nombre, rol, activo, hash } = u;
      return Promise.resolve({ id, nombre, correo: u.correo, rol, activo, hashContrasena: hash });
    },
    registrarAccesoInterno: (id, ahora) => {
      const usuario = usuarios.get(id);
      if (usuario) usuario.ultimoAcceso = ahora;
      return Promise.resolve();
    },
    crearSesion: (sesion) => {
      const id = String(siguienteId++);
      sesiones.set(id, { ...sesion, id, revocadoEn: null });
      return Promise.resolve(id);
    },
    consumirSesion: (tipo, hashToken, ahora) => {
      const fila = buscar(tipo, hashToken);
      if (!fila || !abierta(fila, ahora)) return Promise.resolve(null);
      fila.revocadoEn = ahora;
      return Promise.resolve({ tipo, cuentaId: fila.cuentaId });
    },
    revocarSesion: (tipo, hashToken, ahora) => {
      const fila = buscar(tipo, hashToken);
      if (fila && fila.revocadoEn === null) fila.revocadoEn = ahora;
      return Promise.resolve();
    },
    revocarSesionesUsuarioInterno: (id, ahora) => {
      for (const fila of sesiones.values()) {
        if (fila.tipo === 'admin' && fila.cuentaId === id && fila.revocadoEn === null) {
          fila.revocadoEn = ahora;
        }
      }
      return Promise.resolve();
    },
    sesionInternaVigente: (sid, usuarioId, rol, ahora) => {
      const usuario = usuarios.get(usuarioId);
      const cuentaVigente = usuario?.activo === true && usuario.rol === rol;
      return Promise.resolve(cuentaVigente && vigente('admin', sid, usuarioId, ahora));
    },
    sesionEstudianteVigente: (sid, estudianteId, ahora) =>
      Promise.resolve(vigente('app', sid, estudianteId, ahora)),
  };
  return repositorio;
}

/** bcrypt con costo 12 tarda: cada contraseña de prueba se cifra una sola vez por archivo. */
const hashes = new Map<string, Promise<string>>();
function hashDe(contrasena: string): Promise<string> {
  const guardado = hashes.get(contrasena) ?? cifrarContrasena(contrasena);
  hashes.set(contrasena, guardado);
  return guardado;
}

export interface CuentaDePrueba {
  nombre?: string;
  correo: string;
  contrasena: string;
  rol: RolCuentaInterna;
  areas?: number[];
  activo?: boolean;
}

export function crearEscenarioSesiones(cambios: Partial<Dependencias> = {}) {
  let ahora = new Date('2026-10-24T12:00:00Z');
  const reloj = () => new Date(ahora);
  const falso = crearRepositorioFalso();
  const sesiones = new Map<string, FilaSesion>();
  const tx: Ejecutor = { query: () => Promise.reject(new Error('sin base')) };
  const unidadDeTrabajo: UnidadDeTrabajo = { enTransaccion: (trabajo) => trabajo(tx) };
  const dependencias = crearDependenciasDePrueba({ unidadDeTrabajo, reloj, ...cambios });
  const base = { bd: dependencias.bd, unidadDeTrabajo };
  const administracion = crearAdministracionServicio({
    ...base,
    repositorio: falso.repositorio,
    revocarSesionesUsuarioInterno: (id, txRevocar) =>
      cuentas.revocarSesionesUsuarioInterno(id, txRevocar),
  });
  const cuentas: CuentasServicio = crearCuentasServicio({
    ...base,
    correo: dependencias.proveedores.correo,
    administracion,
    jwt: dependencias.jwt,
    reloj,
    repositorio: crearRepositorioCuentas(falso.usuarios, sesiones),
  });
  const app = crearApp(dependencias, { ...crearServicios(dependencias), administracion, cuentas });

  async function crearCuenta(cuenta: CuentaDePrueba): Promise<string> {
    const { correo, rol, areas = rol === 'docente' ? [1, 2] : [], activo = true } = cuenta;
    const nombre = cuenta.nombre ?? correo.split('@')[0] ?? correo;
    const hashContrasena = await hashDe(cuenta.contrasena);
    const id = await falso.repositorio.crearUsuarioInterno({ nombre, correo, rol, hashContrasena });
    await falso.repositorio.reemplazarEspecialidades(id, areas);
    await falso.repositorio.cambiarActivoUsuarioInterno(id, activo);
    return id;
  }

  const ingresar = (correo: string, contrasena: string, ip = '198.51.100.1') =>
    request(app).post(RUTA_INGRESO).set('X-Forwarded-For', ip).send({ correo, contrasena });

  return {
    app,
    cuentas,
    sesiones,
    usuarios: falso.usuarios,
    crearCuenta,
    ingresar,
    avanzarSegundos: (segundos: number) => {
      ahora = new Date(ahora.getTime() + segundos * 1000);
    },
    ahora: reloj,
  };
}

export const ADMIN: CuentaDePrueba = {
  nombre: 'Ana Admin',
  correo: 'ana@ejemplo.cl',
  contrasena: 'clave-de-ana-1',
  rol: 'admin',
};

export const DOCENTE: CuentaDePrueba = {
  nombre: 'Diego Docente',
  correo: 'diego@ejemplo.cl',
  contrasena: 'clave-de-diego-1',
  rol: 'docente',
};

export const RUTA_USUARIOS = '/api/v1/admin/administracion/usuarios-internos';

/** Escenario con un administrador y un docente ya creados. */
export async function conCuentas() {
  const escenario = crearEscenarioSesiones();
  const adminId = await escenario.crearCuenta(ADMIN);
  const docenteId = await escenario.crearCuenta(DOCENTE);
  return { ...escenario, adminId, docenteId };
}

/** Ingresa con la cuenta y devuelve sus tokens. */
export async function sesionDe(
  escenario: ReturnType<typeof crearEscenarioSesiones>,
  cuenta = ADMIN,
): Promise<{ tokenAcceso: string; tokenRenovacion: string }> {
  const respuesta = await escenario.ingresar(cuenta.correo, cuenta.contrasena);
  expect(respuesta.status).toBe(200);
  return respuesta.body.data as { tokenAcceso: string; tokenRenovacion: string };
}
