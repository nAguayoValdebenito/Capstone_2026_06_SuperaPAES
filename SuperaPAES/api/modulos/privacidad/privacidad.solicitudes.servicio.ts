// Solicitudes sobre los datos personales desde la app (HU-09.1, RF-A21, CU-14 3.b, pantalla A40).
// El plazo de respuesta es el parámetro plazo_derechos_dias (DAS 2.4, 30 días corridos), que entrega
// el servicio de administracion; se fija al recibir la solicitud, así un cambio del parámetro solo
// rige para las nuevas. El DAS no limita cuántas solicitudes ni de qué tipo (plan HU-55, D3).
import { ErrorValidacion } from '../../comun/errores.js';
import type { Reloj } from '../../comun/reloj.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type {
  FilaSolicitudPropia,
  PrivacidadRepositorio,
  TipoDerecho,
} from './privacidad.repositorio.js';

/** Parámetro de contenido.configuracion con los días corridos para responder. */
export const PARAMETRO_PLAZO_DERECHOS = 'plazo_derechos_dias';

const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

/** Lo que envía el estudiante (ya validado): el código del derecho y, si quiere, su detalle. */
export interface EnvioSolicitud {
  tipo: string;
  detalle: string | null;
}

export interface SolicitudesApp {
  /** Los derechos de la Ley 21.719 que se pueden pedir, con su explicación (A40). */
  tiposDerecho(): Promise<TipoDerecho[]>;
  /** HU-09 esc. 1: la solicitud queda pendiente con su fecha límite. Tipo inexistente: 400. */
  crearSolicitud(estudianteId: string, envio: EnvioSolicitud): Promise<FilaSolicitudPropia>;
  /** HU-09 esc. 2: las solicitudes del estudiante con su estado y su respuesta. */
  solicitudesDe(estudianteId: string): Promise<FilaSolicitudPropia[]>;
}

export interface DependenciasSolicitudesApp {
  repositorio: PrivacidadRepositorio;
  administracion: Pick<AdministracionServicio, 'obtenerParametroEntero'>;
  reloj: Reloj;
}

export function crearSolicitudesApp(dependencias: DependenciasSolicitudesApp): SolicitudesApp {
  const { repositorio, administracion, reloj } = dependencias;
  return {
    tiposDerecho: () => repositorio.tiposDerecho(),
    crearSolicitud: async (estudianteId, envio) => {
      const plazo = await administracion.obtenerParametroEntero(PARAMETRO_PLAZO_DERECHOS);
      const solicitadoEn = reloj();
      const venceEn = new Date(solicitadoEn.getTime() + plazo * MILISEGUNDOS_POR_DIA);
      const creada = await repositorio.crearSolicitud({
        estudianteId,
        tipo: envio.tipo,
        detalle: envio.detalle,
        solicitadoEn,
        venceEn,
      });
      if (!creada)
        throw new ErrorValidacion([
          { lugar: 'cuerpo', ruta: 'tipo', mensaje: 'Elige un tipo de solicitud válido.' },
        ]);
      return creada;
    },
    solicitudesDe: (estudianteId) => repositorio.solicitudesDe(estudianteId),
  };
}
