// Panel del administrador (C01, HU-48, CU-25): indicadores del período elegido, en hora de Chile. No cambia datos.
import type { Reloj } from '../../comun/reloj.js';
import type {
  Cantidad,
  PanelRepositorio,
  Periodo,
  Rango,
  RespuestasDelDia,
} from './administracion.panel.repositorio.js';

export interface DependenciasPanel {
  reloj: Reloj;
  repositorio: PanelRepositorio;
}

export interface IndicadoresPanel {
  periodo: Periodo;
  rango: Rango;
  estudiantes: { registrados: number; activos: number };
  preguntas: { porEstado: Cantidad[]; porDificultad: Cantidad[] };
  respuestasPorDia: RespuestasDelDia[];
  suscripciones: { vigentes: number; nuevas: number; canceladas: number };
  /** tasa: porcentaje de 0 a 100; null si en el período no se revisó ninguna pregunta de la IA. */
  ia: { revisadas: number; aprobadas: number; tasa: number | null };
}

export interface PanelAdministracion {
  obtenerPanel(periodo: Periodo): Promise<IndicadoresPanel>;
}

export function tasaDeAprobacion(aprobadas: number, revisadas: number): number | null {
  return revisadas === 0 ? null : Math.round((aprobadas / revisadas) * 100);
}

export function crearPanel({ reloj, repositorio }: DependenciasPanel): PanelAdministracion {
  return {
    async obtenerPanel(periodo) {
      const rango = await repositorio.rango(reloj(), periodo);
      const [estudiantes, suscripciones, ia, porEstado, porDificultad, respuestasPorDia] =
        await Promise.all([
          repositorio.estudiantes(rango),
          repositorio.suscripciones(rango),
          repositorio.revisionIa(rango),
          repositorio.preguntasPorEstado(),
          repositorio.preguntasPorDificultad(),
          repositorio.respuestasPorDia(rango),
        ]);
      return {
        periodo,
        rango,
        estudiantes,
        preguntas: { porEstado, porDificultad },
        respuestasPorDia,
        suscripciones,
        ia: { ...ia, tasa: tasaDeAprobacion(ia.aprobadas, ia.revisadas) },
      };
    },
  };
}
