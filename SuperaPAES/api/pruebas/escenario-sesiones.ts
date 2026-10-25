// Escenario de las pruebas de sesión y permisos (HU-02.1 consola, HU-03.3): la app con los servicios
// reales de cuentas y administracion sobre repositorios en memoria que imitan app.token_sesion y
// contenido.usuario_interno, y un reloj que se adelanta para simular el paso del tiempo sin esperar.
import { createHash } from 'node:crypto';
import request from 'supertest';
import { expect } from 'vitest';
import { crearApp, crearServicios, type Dependencias } from '../app.js';
import type { Audiencia } from '../comun/jwt.js';
import type { RolCuentaInterna } from '../comun/roles.js';
import type { Ejecutor, UnidadDeTrabajo } from '../db/transaccion.js';
import { crearAdministracionServicio } from '../modulos/administracion/index.js';
import type { CuentasRepositorio, NuevaSesion } from '../modulos/cuentas/cuentas.repositorio.js';
import { crearCuentasServicio, type CuentasServicio } from '../modulos/cuentas/index.js';
import { crearDependenciasDePrueba } from './ayudantes.js';
import { crearRepositorioFalso } from './escenario-usuarios-internos.js';
import { hashDeContrasena } from './estudiantes-de-prueba.js';

export const RUTA_INGRESO = '/api/v1/admin/cuentas/ingreso';
export const RUTA_RENOVAR = '/api/v1/admin/cuentas/renovar';
export const RUTA_CERRAR = '/api/v1/admin/cuentas/cerrar';
export const RUTA_YO = '/api/v1/admin/cuentas/yo';
export const RUTA_INGRESO_APP = '/api/v1/app/cuentas/ingreso';
export const RUTA_RENOVAR_APP = '/api/v1/app/cuentas/renovar';
export const RUTA_CERRAR_APP = '/api/v1/app/cuentas/cerrar';
/** Ruta de la app que exige sesión: todavía no tiene endpoints, así que autenticada responde 404. */
export const RUTA_APP_PROTEGIDA = '/api/v1/app/evaluaciones';

export const conToken = (token: string) => ({ Authorization: `Bearer ${token}` });
export const sha256 = (texto: string) => createHash('sha256').update(texto).digest('hex');

export interface FilaSesion extends NuevaSesion {
  id: string;
  revocadoEn: Date | null;
}

type Usuarios = ReturnType<typeof crearRepositorioFalso>['usuarios'];

/** Estudiante en memoria (app.estudiante); eliminado imita eliminado_en con fecha. */
export interface EstudianteEnMemoria {
  id: string;
  nombre: string;
  correo: string;
  correoVerificado: boolean;
  hash: string;
  eliminado: boolean;
}

const abierta = (fila: FilaSesion, ahora: Date) =>
  fila.revocadoEn === null && fila.expiraEn.getTime() > ahora.getTime();

/** app.token_sesion en memoria, con las mismas condiciones que el SQL de cuentas.repositorio.ts. */
function crearRepositorioCuentas(
  usuarios: Usuarios,
  estudiantes: Map<string, EstudianteEnMemoria>,
  sesiones: Map<string, FilaSesion>,
) {
  let siguienteId = 1;
  const buscar = (tipo: Audiencia, hashToken: string) =>
    [...sesiones.values()].find((f) => f.tipo === tipo && f.hashToken === hashToken);
  const vigente = (tipo: Audiencia, sid: string, cuentaId: string, ahora: Date) => {
    const fila = sesiones.get(sid);
    return fila?.tipo === tipo && fila.cuentaId === cuentaId && abierta(fila, ahora);
  };
  const estudianteEliminado = (fila: FilaSesion) =>
    fila.tipo === 'app' && estudiantes.get(fila.cuentaId)?.eliminado !== false;
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
    buscarCredencialesEstudiante: (correo) => {
      const e = [...estudiantes.values()].find(
        (x) => x.correo.toLowerCase() === correo.toLowerCase() && !x.eliminado,
      );
      if (!e) return Promise.resolve(null);
      const { id, nombre, correoVerificado, hash } = e;
      return Promise.resolve({
        id,
        nombre,
        correo: e.correo,
        correoVerificado,
        hashContrasena: hash,
      });
    },
    crearSesion: (sesion) => {
      const id = String(siguienteId++);
      sesiones.set(id, { ...sesion, id, revocadoEn: null });
      return Promise.resolve(id);
    },
    consumirSesion: (tipo, hashToken, ahora) => {
      const fila = buscar(tipo, hashToken);
      if (!fila || !abierta(fila, ahora) || estudianteEliminado(fila)) return Promise.resolve(null);
      fila.revocadoEn = ahora;
      return Promise.resolve({ tipo, cuentaId: fila.cuentaId, dispositivo: fila.dispositivo });
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
    // Solo la sesión: la cuenta la comprueba administracion.cuentaInternaVigente sobre `usuarios`.
    sesionInternaVigente: (sid, usuarioId, ahora) =>
      Promise.resolve(vigente('admin', sid, usuarioId, ahora)),
    sesionEstudianteVigente: (sid, estudianteId, ahora) => {
      const sinEliminar = estudiantes.get(estudianteId)?.eliminado === false;
      return Promise.resolve(sinEliminar && vigente('app', sid, estudianteId, ahora));
    },
  };
  return repositorio;
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
  const estudiantes = new Map<string, EstudianteEnMemoria>();
  const tx: Ejecutor = { query: () => Promise.reject(new Error('sin base')) };
  const unidadDeTrabajo: UnidadDeTrabajo = { enTransaccion: (trabajo) => trabajo(tx) };
  const dependencias = crearDependenciasDePrueba({ unidadDeTrabajo, reloj, ...cambios });
  // Comprobación real de la cuenta de cada token, sobre el repositorio en memoria de administracion.
  delete dependencias.verificarCuentaInterna;
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
    verificacionCorreo: dependencias.verificacionCorreo,
    cupoInvitaciones: crearServicios(dependencias).cupoInvitaciones,
    repositorio: crearRepositorioCuentas(falso.usuarios, estudiantes, sesiones),
  });
  const app = crearApp(dependencias, { ...crearServicios(dependencias), administracion, cuentas });

  async function crearCuenta(cuenta: CuentaDePrueba): Promise<string> {
    const { correo, rol, areas = rol === 'docente' ? [1, 2] : [], activo = true } = cuenta;
    const nombre = cuenta.nombre ?? correo.split('@')[0] ?? correo;
    const hashContrasena = await hashDeContrasena(cuenta.contrasena);
    const id = await falso.repositorio.crearUsuarioInterno({ nombre, correo, rol, hashContrasena });
    await falso.repositorio.reemplazarEspecialidades(id, areas);
    await falso.repositorio.cambiarActivoUsuarioInterno(id, activo);
    return id;
  }

  async function crearEstudiante(datos: {
    correo: string;
    contrasena: string;
    correoVerificado?: boolean;
  }): Promise<string> {
    const id = String(estudiantes.size + 1);
    const { correo, contrasena, correoVerificado = false } = datos;
    const hash = await hashDeContrasena(contrasena);
    estudiantes.set(id, {
      id,
      nombre: 'Eva Estudiante',
      correo,
      correoVerificado,
      hash,
      eliminado: false,
    });
    return id;
  }

  const ingresar = (correo: string, contrasena: string, ip = '198.51.100.1') =>
    request(app).post(RUTA_INGRESO).set('X-Forwarded-For', ip).send({ correo, contrasena });
  const ingresarApp = (correo: string, contrasena: string, ip = '198.51.100.1') =>
    request(app).post(RUTA_INGRESO_APP).set('X-Forwarded-For', ip).send({ correo, contrasena });

  return {
    app,
    cuentas,
    sesiones,
    usuarios: falso.usuarios,
    estudiantes,
    crearCuenta,
    crearEstudiante,
    ingresar,
    ingresarApp,
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
