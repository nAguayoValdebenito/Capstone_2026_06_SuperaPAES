// Estado de la cuenta del estudiante que consulta la app (DAS 2.5 y 4.3.3): si su correo está verificado,
// el cupo del día y las versiones aceptadas de los términos y de la política. Así la app se entera de una
// verificación hecha con el enlace sin volver a iniciar sesión. Los documentos aceptados también los usa
// privacidad para Mis datos (CU-14 paso 2), así que la regla vive aquí, una sola vez.
import type { CupoInvitacionesServicio } from '../cupo-invitaciones/index.js';
import type {
  ConsentimientoExportado,
  CuentaExportada,
} from './cuentas.exportacion.repositorio.js';

/** La última versión aceptada y sin revocar de un documento legal obligatorio. */
export interface DocumentoAceptado {
  documento: 'terminos' | 'privacidad';
  version: string;
  aceptadoEn: Date;
}

export interface EstadoDeCuenta {
  correoVerificado: boolean;
  cupo: Awaited<ReturnType<CupoInvitacionesServicio['cupoDeHoy']>>;
  documentosAceptados: DocumentoAceptado[];
}

export interface EstadoCuentaApp {
  /**
   * DAS 4.3.3: el correo verificado, el cupo del día y las versiones aceptadas de los términos y la
   * política del estudiante de la sesión. Nunca datos de otros usuarios. Cuenta eliminada: 404.
   */
  estadoDeLaCuenta(estudianteId: string): Promise<EstadoDeCuenta>;
  /** CU-14 paso 2: de los términos y la privacidad, la última versión aceptada sin revocar. */
  documentosAceptadosDe(estudianteId: string): Promise<DocumentoAceptado[]>;
}

const OBLIGATORIOS: readonly DocumentoAceptado['documento'][] = ['terminos', 'privacidad'];

/** De cada documento obligatorio, el último consentimiento sin revocar (vienen por fecha). */
function documentosAceptados(consentimientos: ConsentimientoExportado[]): DocumentoAceptado[] {
  return OBLIGATORIOS.flatMap((documento) => {
    const ultimo = consentimientos
      .filter((c) => c.documento === documento && c.revocadoEn === null)
      .at(-1);
    return ultimo ? [{ documento, version: ultimo.version, aceptadoEn: ultimo.aceptadoEn }] : [];
  });
}

export interface DependenciasEstadoCuenta {
  /** Lo que entrega ExportacionCuenta.exportarCuenta; se declara aquí para no importar la capa que lo usa. */
  exportarCuenta: (estudianteId: string) => Promise<{
    cuenta: Pick<CuentaExportada, 'correoVerificado'>;
    consentimientos: ConsentimientoExportado[];
  }>;
  cupoInvitaciones: Pick<CupoInvitacionesServicio, 'cupoDeHoy'>;
}

export function crearEstadoCuentaApp({
  exportarCuenta,
  cupoInvitaciones,
}: DependenciasEstadoCuenta): EstadoCuentaApp {
  return {
    documentosAceptadosDe: async (estudianteId) =>
      documentosAceptados((await exportarCuenta(estudianteId)).consentimientos),
    estadoDeLaCuenta: async (estudianteId) => {
      const { cuenta, consentimientos } = await exportarCuenta(estudianteId);
      return {
        correoVerificado: cuenta.correoVerificado,
        cupo: await cupoInvitaciones.cupoDeHoy(estudianteId),
        documentosAceptados: documentosAceptados(consentimientos),
      };
    },
  };
}
