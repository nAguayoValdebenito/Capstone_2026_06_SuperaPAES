// Recuperación de la contraseña del estudiante (HU-06.1, RF-A02, CU-04, RN-31) en el módulo cuentas.
// cuentas.servicio.ts la expone en su servicio.
//
// Pedirla: la respuesta es siempre la misma, exista o no la cuenta. Con una cuenta, en segundo plano
// (para que el tiempo de respuesta no delate el correo): un enlace de 32 bytes al azar guardado como
// SHA-256 y sin código, con la vigencia de contenido.tipo_token_correo (1 hora); el trigger tg_token_correo
// anula el anterior. El correo sale después de confirmar la transacción.
// Crear la contraseña nueva: en una transacción con la cuenta y el enlace bloqueados (primero la
// cuenta, como en la verificación). Una contraseña que no cumple RN-31 no consume el enlace.
import { createHash, randomBytes } from 'node:crypto';
import type { MensajeCorreo, ProveedorCorreo } from '../../adaptadores/fabrica.js';
import type { ConfiguracionVerificacionCorreo } from '../../comun/configuracion.js';
import { cifrarContrasena, validarContrasena } from '../../comun/contrasenas.js';
import { ErrorEnlaceNoVigente, ErrorValidacion } from '../../comun/errores.js';
import { registro } from '../../comun/registro.js';
import type { Reloj } from '../../comun/reloj.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type {
  CuentaDeRecuperacion,
  RecuperacionRepositorio,
} from './cuentas.recuperacion.repositorio.js';

const BYTES_TOKEN_ENLACE = 32;
const MILISEGUNDOS_POR_HORA = 60 * 60 * 1000;

export interface DependenciasRecuperacion {
  repositorio: RecuperacionRepositorio;
  unidadDeTrabajo: UnidadDeTrabajo;
  correo: ProveedorCorreo;
  reloj: Reloj;
  configuracion: ConfiguracionVerificacionCorreo;
  /** Revoca las sesiones abiertas del estudiante (token_sesion es del servicio de sesiones). */
  revocarSesionesEstudiante: (estudianteId: string, tx: Ejecutor) => Promise<void>;
  /** Ejecuta la tarea sin que la respuesta la espere; la propia tarea registra sus errores. */
  segundoPlano: (tarea: () => Promise<void>) => void;
}

export interface Recuperacion {
  /**
   * CU-04 pasos 1 y 2: pide el enlace. No dice si la cuenta existe: la respuesta es siempre igual y el
   * envío no se espera. Una cuenta con el correo sin verificar también recupera; no queda verificada.
   */
  solicitarRecuperacion(correo: string): Promise<void>;
  /**
   * CU-04 pasos 4 y 5: cambia la contraseña con el enlace. Enlace usado, anulado, vencido o inexistente:
   * 409 ENLACE_NO_VIGENTE, siempre con el mismo mensaje. Contraseña que no cumple RN-31: 400 VALIDACION
   * con su motivo, sin consumir el enlace. Cierra las sesiones abiertas; no inicia sesión.
   */
  restablecerContrasena(tokenEnlace: string, contrasena: string): Promise<void>;
}

const sha256 = (texto: string) => createHash('sha256').update(texto).digest('hex');

function mensajeDeRecuperacion(
  urlConsola: string,
  cuenta: CuentaDeRecuperacion,
  tokenEnlace: string,
  horasVigencia: number,
): MensajeCorreo {
  const enlace = `${urlConsola}/restablecer-contrasena?token=${tokenEnlace}`;
  const horas = horasVigencia === 1 ? '1 hora' : `${String(horasVigencia)} horas`;
  const texto = [
    `Hola, ${cuenta.nombre}:`,
    '',
    'Pediste crear una contraseña nueva para tu cuenta de Supera PAES. Abre este enlace:',
    enlace,
    '',
    `El enlace sirve una sola vez y vence en ${horas}. Si pides otro, este deja de servir.`,
    '',
    'Si no fuiste tú, ignora este mensaje: tu contraseña no cambia.',
  ].join('\n');
  return { para: cuenta.correo, asunto: 'Crea una contraseña nueva en Supera PAES', texto };
}

/** Crea el enlace y lo envía; todo error se registra sin el enlace ni el correo. */
async function emitirYEnviar(
  dependencias: DependenciasRecuperacion,
  cuenta: CuentaDeRecuperacion,
): Promise<void> {
  const { repositorio, unidadDeTrabajo, reloj, configuracion } = dependencias;
  try {
    const tokenEnlace = randomBytes(BYTES_TOKEN_ENLACE).toString('base64url');
    const emitido = await unidadDeTrabajo.enTransaccion(async (tx) => {
      // Primero la cuenta y después el enlace, igual que restablecer: el trigger bloquea el enlace
      // anterior al insertar y la clave foránea pide la cuenta; en otro orden dos peticiones a la vez
      // pueden quedar esperándose (deadlock). También serializa dos solicitudes simultáneas.
      if (!(await repositorio.bloquearCuenta(cuenta.id, tx))) return null;
      const tipo = await repositorio.tipoRecuperacion(tx);
      await repositorio.insertarToken(
        {
          estudianteId: cuenta.id,
          tipoId: tipo.id,
          hashToken: sha256(tokenEnlace),
          expiraEn: new Date(reloj().getTime() + tipo.horasVigencia * MILISEGUNDOS_POR_HORA),
        },
        tx,
      );
      return tipo;
    });
    // La cuenta se eliminó entre la consulta y el bloqueo: no hay nada que enviar.
    if (!emitido) return;
    await dependencias.correo.enviar(
      mensajeDeRecuperacion(configuracion.urlConsola, cuenta, tokenEnlace, emitido.horasVigencia),
    );
  } catch (error) {
    // Solo el id y el tipo de error: el mensaje del proveedor puede traer el correo.
    registro.error('No se pudo emitir el correo de recuperación', {
      estudianteId: cuenta.id,
      error: error instanceof Error ? error.name : 'desconocido',
    });
  }
}

async function solicitar(dependencias: DependenciasRecuperacion, correo: string): Promise<void> {
  const cuenta = await dependencias.repositorio.buscarCuentaPorCorreo(correo);
  if (cuenta) dependencias.segundoPlano(() => emitirYEnviar(dependencias, cuenta));
}

function errorDeContrasena(motivo: string, mensaje: string): ErrorValidacion {
  return new ErrorValidacion([{ lugar: 'cuerpo', ruta: 'contrasena', mensaje, motivo }], mensaje);
}

async function restablecer(
  dependencias: DependenciasRecuperacion,
  tokenEnlace: string,
  contrasena: string,
): Promise<void> {
  const { repositorio, unidadDeTrabajo, reloj } = dependencias;
  const hashToken = sha256(tokenEnlace);
  const cuentaId = await repositorio.cuentaDelEnlace(hashToken);
  if (!cuentaId) throw new ErrorEnlaceNoVigente();
  await unidadDeTrabajo.enTransaccion(async (tx) => {
    const cuenta = await repositorio.bloquearCuenta(cuentaId, tx);
    const token = await repositorio.bloquearToken(hashToken, tx);
    const vigente = token?.abierto === true && token.expiraEn.getTime() > reloj().getTime();
    if (!cuenta || !token || !vigente) throw new ErrorEnlaceNoVigente();
    // RN-31 con el correo de la cuenta. Nada se escribió todavía: el enlace sigue sirviendo.
    const problema = validarContrasena(contrasena, cuenta.correo);
    if (problema) throw errorDeContrasena(problema.motivo, problema.mensaje);
    await repositorio.actualizarContrasena(cuenta.id, await cifrarContrasena(contrasena), tx);
    await repositorio.marcarTokenUsado(token.id, reloj(), tx);
    await dependencias.revocarSesionesEstudiante(cuenta.id, tx);
  });
}

export function crearRecuperacion(dependencias: DependenciasRecuperacion): Recuperacion {
  return {
    solicitarRecuperacion: (correo) => solicitar(dependencias, correo),
    restablecerContrasena: (tokenEnlace, contrasena) =>
      restablecer(dependencias, tokenEnlace, contrasena),
  };
}
