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

/** Las cifras que se comparan con el período anterior. */
export interface CifrasDelPeriodo {
  estudiantes: { registrados: number; activos: number };
  suscripciones: { vigentes: number; nuevas: number; canceladas: number };
  /** tasa: porcentaje de 0 a 100; null si en el período no se revisó ninguna pregunta de la IA. */
  ia: { revisadas: number; aprobadas: number; tasa: number | null };
}

export interface IndicadoresPanel extends CifrasDelPeriodo {
  periodo: Periodo;
  rango: Rango;
  preguntas: { porEstado: Cantidad[]; porDificultad: Cantidad[] };
  respuestasPorDia: RespuestasDelDia[];
  /**
   * El período anterior, de la misma duración y justo antes (para las variaciones): `registrados` y
   * `vigentes` son los que había al empezar el período, y no los de hoy.
   */
  anterior: CifrasDelPeriodo & { rango: Rango };
}

export interface PanelAdministracion {
  obtenerPanel(periodo: Periodo): Promise<IndicadoresPanel>;
}

export function tasaDeAprobacion(aprobadas: number, revisadas: number): number | null {
  return revisadas === 0 ? null : Math.round((aprobadas / revisadas) * 100);
}

/** Las cifras de un período; `estudiantes.registrados` y `suscripciones.vigentes` son los de hoy. */
async function cifrasDe(repositorio: PanelRepositorio, rango: Rango): Promise<CifrasDelPeriodo> {
  const [estudiantes, suscripciones, ia] = await Promise.all([
    repositorio.estudiantes(rango),
    repositorio.suscripciones(rango),
    repositorio.revisionIa(rango),
  ]);
  return {
    estudiantes,
    suscripciones,
    ia: { ...ia, tasa: tasaDeAprobacion(ia.aprobadas, ia.revisadas) },
  };
}

/** Las cifras del período anterior; lo acumulado (registrados, vigentes) es lo que había al empezar. */
async function cifrasAnteriores(
  repositorio: PanelRepositorio,
  rango: Rango,
): Promise<IndicadoresPanel['anterior']> {
  const anterior = await repositorio.rangoAnterior(rango);
  const [cifras, registrados, vigentes] = await Promise.all([
    cifrasDe(repositorio, anterior),
    repositorio.registradosAntesDe(rango.desde),
    repositorio.vigentesAl(anterior.hasta),
  ]);
  return {
    rango: anterior,
    estudiantes: { ...cifras.estudiantes, registrados },
    suscripciones: { ...cifras.suscripciones, vigentes },
    ia: cifras.ia,
  };
}

export function crearPanel({ reloj, repositorio }: DependenciasPanel): PanelAdministracion {
  return {
    async obtenerPanel(periodo) {
      const rango = await repositorio.rango(reloj(), periodo);
      const [cifras, anterior, porEstado, porDificultad, respuestasPorDia] = await Promise.all([
        cifrasDe(repositorio, rango),
        cifrasAnteriores(repositorio, rango),
        repositorio.preguntasPorEstado(),
        repositorio.preguntasPorDificultad(),
        repositorio.respuestasPorDia(rango),
      ]);
      return {
        periodo,
        rango,
        ...cifras,
        preguntas: { porEstado, porDificultad },
        respuestasPorDia,
        anterior,
      };
    },
  };
}
