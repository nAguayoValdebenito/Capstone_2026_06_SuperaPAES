// Verificación del correo del estudiante (HU-05, RF-A03, RN-32, CU-02 y CU-02b) en el módulo cuentas.
// cuentas.servicio.ts la expone en su servicio: los demás módulos (el registro, por ejemplo) la usan a
// través de él, nunca de este archivo.
//
// Cada correo trae un enlace (32 bytes al azar, guardado como SHA-256) y un código de 6 dígitos
// (guardado como HMAC-SHA-256 con CLAVE_CODIGO_CORREO sobre el hash del enlace y el código, así el
// mismo código da un valor distinto en cada correo). La vigencia y los intentos salen de
// contenido.tipo_token_correo. Al emitir uno nuevo, el trigger tg_token_correo anula el anterior.
// Orden de bloqueo en todas las transacciones: primero el estudiante y después su correo.
import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto';
import type { MensajeCorreo, ProveedorCorreo } from '../../adaptadores/fabrica.js';
import type { ConfiguracionVerificacionCorreo } from '../../comun/configuracion.js';
import {
  ErrorNoEncontrado,
  ErrorVerificacionNoVigente,
  ErrorYaVerificado,
} from '../../comun/errores.js';
import { registro } from '../../comun/registro.js';
import type { Reloj } from '../../comun/reloj.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type {
  EstudianteVerificable,
  TokenVerificacion,
  VerificacionRepositorio,
} from './cuentas.verificacion.repositorio.js';

const BYTES_TOKEN_ENLACE = 32;
const CODIGOS_POSIBLES = 1_000_000;
const DIGITOS_CODIGO = 6;
const MILISEGUNDOS_POR_HORA = 60 * 60 * 1000;

export interface DependenciasVerificacion {
  repositorio: VerificacionRepositorio;
  unidadDeTrabajo: UnidadDeTrabajo;
  correo: ProveedorCorreo;
  administracion: AdministracionServicio;
  reloj: Reloj;
  configuracion: ConfiguracionVerificacionCorreo;
}

/** Quien ya había verificado recibe yaVerificado: true, sin error y sin que nada cambie. */
export interface ResultadoVerificacion {
  verificado: true;
  yaVerificado: boolean;
}

/** enviado: false si ya estaba verificado (no se emite nada) o si el proveedor de correo falló. */
export interface ResultadoEnvio {
  enviado: boolean;
  yaVerificado: boolean;
}

/** Estudiante para la consola (C15): id, nombre, correo, si está verificado y la fecha de creación. */
export type EstudianteConsola = EstudianteVerificable;

export interface VerificacionCorreo {
  /**
   * Emite el correo de verificación (CU-02 paso 1, 2.a) y lo envía después de confirmar la
   * transacción. Si el envío falla no lanza error: el correo queda emitido y se puede pedir otro.
   */
  emitirVerificacion(estudianteId: string): Promise<ResultadoEnvio>;
  /** CU-02 paso 3 con el enlace. Usado, anulado, vencido o inexistente: VERIFICACION_NO_VIGENTE. */
  verificarConEnlace(tokenEnlace: string): Promise<ResultadoVerificacion>;
  buscarEstudiantes(correo: string): Promise<EstudianteConsola[]>;
  /** CU-02b: confirma el correo, anula el correo pendiente y audita. Ya verificado: YA_VERIFICADO. */
  confirmarCorreo(administradorId: string, estudianteId: string): Promise<EstudianteConsola>;
}

type Resultado = 'verificado' | 'ya_verificado' | 'no_vigente';

const sha256 = (texto: string) => createHash('sha256').update(texto).digest('hex');

/** HMAC-SHA-256 del código, atado al correo por el hash del enlace. */
export function cifrarCodigo(clave: string, hashToken: string, codigo: string): string {
  return createHmac('sha256', clave).update(`${hashToken}:${codigo}`).digest('hex');
}

const estaVigente = (token: TokenVerificacion, ahora: Date) =>
  token.abierto && token.expiraEn.getTime() > ahora.getTime();

function resultadoDe(resultado: Resultado): ResultadoVerificacion {
  if (resultado === 'no_vigente') throw new ErrorVerificacionNoVigente();
  return { verificado: true, yaVerificado: resultado === 'ya_verificado' };
}

/**
 * Lo que pasa cada vez que un correo queda verificado: con el enlace, con el código o por el
 * administrador. Es el punto de extensión de CU-02a: el bono para quien invitó (HU-47) va aquí.
 */
async function marcarVerificado(
  { repositorio, reloj }: DependenciasVerificacion,
  estudianteId: string,
  tx: Ejecutor,
): Promise<void> {
  await repositorio.marcarCorreoVerificado(estudianteId, reloj(), tx);
}

interface CorreoPreparado {
  para: string;
  nombre: string;
  tokenEnlace: string;
  codigo: string;
  horasVigencia: number;
  intentosCodigo: number;
}

function mensajeDeVerificacion(urlConsola: string, correo: CorreoPreparado): MensajeCorreo {
  const enlace = `${urlConsola}/verificar-correo?token=${correo.tokenEnlace}`;
  const texto = [
    `Hola, ${correo.nombre}:`,
    '',
    'Para confirmar que este correo es tuyo, abre este enlace:',
    enlace,
    '',
    `O escribe este código en la app: ${correo.codigo}`,
    '',
    `El enlace y el código sirven una sola vez y vencen en ${String(correo.horasVigencia)} horas.`,
    `Tienes ${String(correo.intentosCodigo)} intentos para escribir el código; si se acaban, pide un correo nuevo desde la app.`,
    'Al verificar tu correo, aumenta la cantidad de preguntas que puedes responder cada día.',
    '',
    'Si no creaste una cuenta en Supera PAES, puedes ignorar este mensaje.',
  ].join('\n');
  return { para: correo.para, asunto: 'Verifica tu correo en Supera PAES', texto };
}

async function prepararCorreo(
  dependencias: DependenciasVerificacion,
  estudianteId: string,
): Promise<CorreoPreparado | null> {
  const { repositorio, unidadDeTrabajo, reloj, configuracion } = dependencias;
  return unidadDeTrabajo.enTransaccion(async (tx) => {
    const estudiante = await repositorio.bloquearEstudiante(estudianteId, tx);
    if (!estudiante) throw new ErrorNoEncontrado('La cuenta no existe.');
    if (estudiante.correoVerificado) return null;
    const tipo = await repositorio.tipoVerificacion(tx);
    const tokenEnlace = randomBytes(BYTES_TOKEN_ENLACE).toString('base64url');
    const codigo = String(randomInt(CODIGOS_POSIBLES)).padStart(DIGITOS_CODIGO, '0');
    const hashToken = sha256(tokenEnlace);
    await repositorio.insertarToken(
      {
        estudianteId,
        tipoId: tipo.id,
        hashToken,
        hashCodigo: cifrarCodigo(configuracion.claveCodigo, hashToken, codigo),
        expiraEn: new Date(reloj().getTime() + tipo.horasVigencia * MILISEGUNDOS_POR_HORA),
      },
      tx,
    );
    const { horasVigencia, intentosCodigo } = tipo;
    const { correo: para, nombre } = estudiante;
    return { para, nombre, tokenEnlace, codigo, horasVigencia, intentosCodigo };
  });
}

async function emitir(
  dependencias: DependenciasVerificacion,
  estudianteId: string,
): Promise<ResultadoEnvio> {
  const preparado = await prepararCorreo(dependencias, estudianteId);
  if (!preparado) return { enviado: false, yaVerificado: true };
  try {
    await dependencias.correo.enviar(
      mensajeDeVerificacion(dependencias.configuracion.urlConsola, preparado),
    );
    return { enviado: true, yaVerificado: false };
  } catch (error) {
    // Solo el id y el tipo de error: el mensaje del proveedor puede traer el correo del estudiante.
    registro.error('No se pudo enviar el correo de verificación', {
      estudianteId,
      error: error instanceof Error ? error.name : 'desconocido',
    });
    return { enviado: false, yaVerificado: false };
  }
}

async function verificarEnlace(
  dependencias: DependenciasVerificacion,
  tokenEnlace: string,
): Promise<ResultadoVerificacion> {
  const { repositorio, unidadDeTrabajo, reloj } = dependencias;
  const hashToken = sha256(tokenEnlace);
  const estudianteId = await repositorio.estudianteDelEnlace(hashToken);
  if (!estudianteId) throw new ErrorVerificacionNoVigente();
  const resultado = await unidadDeTrabajo.enTransaccion(async (tx): Promise<Resultado> => {
    const estudiante = await repositorio.bloquearEstudiante(estudianteId, tx);
    if (!estudiante) return 'no_vigente';
    if (estudiante.correoVerificado) return 'ya_verificado';
    const token = await repositorio.bloquearTokenPorHash(hashToken, tx);
    if (!token || !estaVigente(token, reloj())) return 'no_vigente';
    await repositorio.marcarTokenUsado(token.id, reloj(), tx);
    await marcarVerificado(dependencias, estudiante.id, tx);
    return 'verificado';
  });
  return resultadoDe(resultado);
}

async function confirmar(
  dependencias: DependenciasVerificacion,
  administradorId: string,
  estudianteId: string,
): Promise<EstudianteConsola> {
  const { repositorio, unidadDeTrabajo, reloj, administracion } = dependencias;
  return unidadDeTrabajo.enTransaccion(async (tx) => {
    const estudiante = await repositorio.bloquearEstudiante(estudianteId, tx);
    if (!estudiante) throw new ErrorNoEncontrado('El estudiante no existe.');
    if (estudiante.correoVerificado) throw new ErrorYaVerificado();
    await repositorio.anularVerificacionPendiente(estudianteId, reloj(), tx);
    await marcarVerificado(dependencias, estudianteId, tx);
    await administracion.registrarAuditoria(
      {
        usuarioId: administradorId,
        accion: 'confirmar_cuenta',
        entidad: 'estudiante',
        entidadId: estudianteId,
        antes: { correo_verificado: false },
        despues: { correo_verificado: true },
      },
      tx,
    );
    return { ...estudiante, correoVerificado: true };
  });
}

export function crearVerificacionCorreo(
  dependencias: DependenciasVerificacion,
): VerificacionCorreo {
  return {
    emitirVerificacion: (estudianteId) => emitir(dependencias, estudianteId),
    verificarConEnlace: (tokenEnlace) => verificarEnlace(dependencias, tokenEnlace),
    buscarEstudiantes: (correo) => dependencias.repositorio.buscarEstudiantesPorCorreo(correo),
    confirmarCorreo: (administradorId, estudianteId) =>
      confirmar(dependencias, administradorId, estudianteId),
  };
}
