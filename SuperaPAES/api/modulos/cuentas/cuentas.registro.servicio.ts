// Registro del estudiante (HU-01.1, RF-A01, CU-01, RN-18, RN-30, RN-31, RN-33) en el módulo cuentas.
// cuentas.servicio.ts lo expone en su servicio: los demás módulos lo usan a través de él.
//
// En una sola transacción: la cuenta sin verificar (contraseña con bcrypt y su código de invitación
// propio), un consentimiento por documento aceptado, la invitación si vino un código y la sesión de la
// app. Después de confirmar, el correo de verificación (CU-02): si no sale, el registro igual termina.
import { cifrarContrasena } from '../../comun/contrasenas.js';
import { ErrorConflicto, ErrorValidacion } from '../../comun/errores.js';
import { registro } from '../../comun/registro.js';
import type { Reloj } from '../../comun/reloj.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio, DocumentoLegalVigente } from '../administracion/index.js';
import type { CupoInvitacionesServicio } from '../cupo-invitaciones/index.js';
import type { RegistroRepositorio } from './cuentas.registro.repositorio.js';
import type { DatosRegistro } from './cuentas.validadores.js';

/** Reintentos si el código de invitación propio sale repetido (1 en más de mil millones). */
const INTENTOS_CODIGO_PROPIO = 5;
const RESTRICCION_CORREO = 'ux_estudiante_correo';
const RESTRICCION_CODIGO = 'estudiante_codigo_invitacion_key';

interface Tokens {
  tokenAcceso: string;
  tokenRenovacion: string;
}

/** Igual que la respuesta del ingreso de la app: tokens y datos mínimos, nunca el hash. */
export interface CuentaRegistrada extends Tokens {
  estudiante: { id: string; nombre: string; correo: string; correoVerificado: boolean };
}

export interface DependenciasRegistro {
  repositorio: RegistroRepositorio;
  unidadDeTrabajo: UnidadDeTrabajo;
  administracion: AdministracionServicio;
  cupoInvitaciones: CupoInvitacionesServicio;
  reloj: Reloj;
  /** Abre la sesión de la app dentro de la transacción del registro (servicio de sesiones). */
  abrirSesionApp(estudianteId: string, tx: Ejecutor): Promise<Tokens>;
  /** Emite el correo de verificación después de confirmar (cuentas.verificacion.servicio.ts). */
  emitirVerificacion(estudianteId: string): Promise<unknown>;
  generarCodigo(): string;
}

function errorDeCampo(ruta: string, mensaje: string, motivo: string): ErrorValidacion {
  return new ErrorValidacion([{ lugar: 'cuerpo', ruta, mensaje, motivo }], mensaje);
}

/**
 * HU-01 esc. 1: lo aceptado debe ser exactamente la versión vigente de cada documento obligatorio
 * (términos y privacidad). Uno faltante, de más o de otra versión se rechaza.
 */
function comprobarDocumentos(vigentes: DocumentoLegalVigente[], aceptados: readonly number[]) {
  if (vigentes.length === 0) {
    throw new Error('No hay documentos legales vigentes: falta cargar la semilla 003.');
  }
  const recibidos = new Set(aceptados);
  const iguales = recibidos.size === vigentes.length && vigentes.every((d) => recibidos.has(d.id));
  if (!iguales) {
    const nombres = vigentes.map((d) => `${d.nombre} (versión ${d.version})`).join(' y ');
    throw errorDeCampo(
      'documentosAceptados',
      `Para crear tu cuenta debes aceptar la versión vigente de: ${nombres}.`,
      'documentos_no_vigentes',
    );
  }
}

interface ErrorDeBase {
  code?: unknown;
  constraint?: unknown;
}

const violaRestriccion = (error: unknown, restriccion: string) =>
  typeof error === 'object' &&
  error !== null &&
  (error as ErrorDeBase).code === '23505' &&
  (error as ErrorDeBase).constraint === restriccion;

/** HU-01 esc. 3: el código debe ser de un estudiante; si no, el registro no sigue. */
async function registrarInvitacion(
  dependencias: DependenciasRegistro,
  invitadoId: string,
  codigo: string,
  tx: Ejecutor,
): Promise<void> {
  const invitanteId = await dependencias.repositorio.buscarInvitantePorCodigo(codigo, tx);
  if (!invitanteId) {
    throw errorDeCampo(
      'codigoInvitacion',
      'No encontramos ese código de invitación. Revísalo o deja el campo vacío.',
      'codigo_invitacion_inexistente',
    );
  }
  const registradoEn = dependencias.reloj();
  await dependencias.cupoInvitaciones.registrarInvitacion(
    { invitanteId, invitadoId, registradoEn },
    tx,
  );
}

function crearCuenta(
  dependencias: DependenciasRegistro,
  datos: DatosRegistro,
  hashContrasena: string,
  codigoPropio: string,
): Promise<CuentaRegistrada> {
  const { repositorio, unidadDeTrabajo, reloj } = dependencias;
  const { nombre, correo } = datos;
  return unidadDeTrabajo.enTransaccion(async (tx) => {
    const creadoEn = reloj();
    const id = await repositorio.insertarEstudiante(
      { nombre, correo, hashContrasena, codigoInvitacion: codigoPropio, creadoEn },
      tx,
    );
    await repositorio.insertarConsentimientos(id, datos.documentosAceptados, creadoEn, tx);
    if (datos.codigoInvitacion) {
      await registrarInvitacion(dependencias, id, datos.codigoInvitacion, tx);
    }
    const tokens = await dependencias.abrirSesionApp(id, tx);
    return { ...tokens, estudiante: { id, nombre, correo, correoVerificado: false } };
  });
}

/** Reintenta con otro código propio si sale repetido; un correo repetido es 409 (CU-01 5.a). */
async function crearConCodigoPropio(
  dependencias: DependenciasRegistro,
  datos: DatosRegistro,
  hashContrasena: string,
): Promise<CuentaRegistrada> {
  for (let intento = 1; ; intento++) {
    try {
      return await crearCuenta(dependencias, datos, hashContrasena, dependencias.generarCodigo());
    } catch (error) {
      if (violaRestriccion(error, RESTRICCION_CORREO)) {
        throw new ErrorConflicto(
          'Ese correo ya tiene una cuenta. Inicia sesión o recupera tu contraseña.',
        );
      }
      if (!violaRestriccion(error, RESTRICCION_CODIGO) || intento >= INTENTOS_CODIGO_PROPIO)
        throw error;
    }
  }
}

async function registrar(
  dependencias: DependenciasRegistro,
  datos: DatosRegistro,
): Promise<CuentaRegistrada> {
  const vigentes = await dependencias.administracion.documentosLegalesVigentes(
    dependencias.reloj(),
  );
  comprobarDocumentos(vigentes, datos.documentosAceptados);
  const hashContrasena = await cifrarContrasena(datos.contrasena);
  const cuenta = await crearConCodigoPropio(dependencias, datos, hashContrasena);
  try {
    // Si el correo no sale, emitirVerificacion no falla: el estudiante lo pide de nuevo desde la app.
    await dependencias.emitirVerificacion(cuenta.estudiante.id);
  } catch (error) {
    // Solo el id y el tipo de error: nunca el correo ni la contraseña.
    registro.error('No se pudo emitir el correo de verificación del registro', {
      estudianteId: cuenta.estudiante.id,
      error: error instanceof Error ? error.name : 'desconocido',
    });
  }
  return cuenta;
}

export function crearRegistro(dependencias: DependenciasRegistro) {
  return {
    registrarEstudiante: (datos: DatosRegistro) => registrar(dependencias, datos),
  };
}
