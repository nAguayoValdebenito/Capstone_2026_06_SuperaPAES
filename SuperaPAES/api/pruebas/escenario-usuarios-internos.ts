// Escenario de las pruebas de usuarios internos (HU-04): la app con el servicio de administración sobre
// un repositorio en memoria que imita las restricciones de la base, sin PostgreSQL.
import { crearApp, crearServicios } from '../app.js';
import type { Ejecutor, UnidadDeTrabajo } from '../db/transaccion.js';
import type {
  AdministracionRepositorio,
  EntradaAuditoria,
  UsuarioInterno,
} from '../modulos/administracion/administracion.repositorio.js';
import { crearAdministracionServicio } from '../modulos/administracion/index.js';
import { aceptarCualquierSesion, crearDependenciasDePrueba, tokenAdmin } from './ayudantes.js';

export const RUTA = '/api/v1/admin/administracion/usuarios-internos';
const AREAS_EXISTENTES = new Set([1, 2, 3]);

/** Repositorio en memoria con las restricciones de la base que el servicio traduce. */
export function crearRepositorioFalso() {
  const usuarios = new Map<string, UsuarioInterno & { hash: string }>();
  const auditoria: EntradaAuditoria[] = [];
  let siguienteId = 1;
  const sinHash = ({ hash: _hash, ...usuario }: UsuarioInterno & { hash: string }) => ({
    ...usuario,
  });
  const repositorio: AdministracionRepositorio = {
    listarUsuariosInternos: () => Promise.resolve([...usuarios.values()].map(sinHash)),
    buscarUsuarioInterno: (id) => {
      const usuario = usuarios.get(id);
      return Promise.resolve(usuario ? sinHash(usuario) : null);
    },
    crearUsuarioInterno: ({ nombre, correo, rol, hashContrasena }) => {
      if ([...usuarios.values()].some((u) => u.correo === correo)) {
        return Promise.reject(
          Object.assign(new Error('duplicado'), {
            code: '23505',
            constraint: 'ux_usuario_interno_correo',
          }),
        );
      }
      const id = String(siguienteId++);
      const creadoEn = new Date('2026-10-23T12:00:00Z');
      const nuevo = { id, nombre, correo, rol, activo: true, areas: [], creadoEn };
      usuarios.set(id, { ...nuevo, ultimoAcceso: null, hash: hashContrasena });
      return Promise.resolve(id);
    },
    actualizarUsuarioInterno: (id, { nombre, rol, hashContrasena }) => {
      const usuario = usuarios.get(id);
      if (usuario) Object.assign(usuario, { nombre, rol, hash: hashContrasena ?? usuario.hash });
      return Promise.resolve();
    },
    cambiarActivoUsuarioInterno: (id, activo) => {
      const usuario = usuarios.get(id);
      if (usuario) usuario.activo = activo;
      return Promise.resolve();
    },
    reemplazarEspecialidades: (id, areas) => {
      if (areas.some((area) => !AREAS_EXISTENTES.has(area))) {
        return Promise.reject(
          Object.assign(new Error('fk'), { code: '23503', table: 'docente_especialidad' }),
        );
      }
      const usuario = usuarios.get(id);
      if (usuario) usuario.areas = [...areas];
      return Promise.resolve();
    },
    leerParametro: () => Promise.resolve(undefined),
    documentosLegalesVigentes: () => Promise.resolve([]),
    registrarAuditoria: (entrada) => {
      auditoria.push(entrada);
      return Promise.resolve();
    },
    buscarRolActivo: (id) => {
      const usuario = usuarios.get(id);
      return Promise.resolve(usuario ? { rol: usuario.rol, activo: usuario.activo } : null);
    },
    bloquearAdministradoresActivos: () =>
      Promise.resolve(
        [...usuarios.values()].filter((u) => u.rol === 'admin' && u.activo).map((u) => u.id),
      ),
  };
  return { repositorio, usuarios, auditoria };
}

/**
 * Con `comprobarCuentas`, cada petición de la consola revisa la cuenta del token en el repositorio en
 * memoria, como en producción; sin él, la cuenta del token se da por vigente.
 */
export function crearEscenario({ comprobarCuentas = false } = {}) {
  const falso = crearRepositorioFalso();
  const tx: Ejecutor = { query: () => Promise.reject(new Error('sin base')) };
  let transacciones = 0;
  const unidadDeTrabajo: UnidadDeTrabajo = {
    enTransaccion: (trabajo) => {
      transacciones += 1;
      return trabajo(tx);
    },
  };
  /** Cuentas cuyas sesiones se cerraron, con la transacción en que se pidió. */
  const sesionesRevocadas: { id: string; tx: Ejecutor }[] = [];
  const dependencias = crearDependenciasDePrueba({ unidadDeTrabajo });
  // Sin el reemplazo de las pruebas, crearApp usa la comprobación real del servicio de administración.
  if (comprobarCuentas) delete dependencias.verificarCuentaInterna;
  const administracion = crearAdministracionServicio({
    bd: dependencias.bd,
    unidadDeTrabajo,
    repositorio: falso.repositorio,
    revocarSesionesUsuarioInterno: (id, txRevocar) => {
      sesionesRevocadas.push({ id, tx: txRevocar });
      return Promise.resolve();
    },
  });
  const app = crearApp(
    dependencias,
    aceptarCualquierSesion({ ...crearServicios(dependencias), administracion }),
  );
  return { ...falso, app, tx, sesionesRevocadas, transacciones: () => transacciones };
}

export const docente = (cambios: Record<string, unknown> = {}) => ({
  nombre: 'Diego Docente',
  correo: 'Diego@Ejemplo.cl',
  rol: 'docente',
  areas: [2, 1, 2],
  contrasena: 'clave-inicial-9',
  ...cambios,
});

export async function comoAdmin() {
  return { Authorization: `Bearer ${await tokenAdmin('admin', '7')}` };
}
