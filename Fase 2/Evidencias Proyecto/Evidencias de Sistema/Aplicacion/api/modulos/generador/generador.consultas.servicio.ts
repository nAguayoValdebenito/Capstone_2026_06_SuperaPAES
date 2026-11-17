// Lecturas del generador para C05: lo usado de los topes (RNF-03) y el resultado de un lote, pregunta por
// pregunta (HU-17.3). Las preguntas vienen del servicio de preguntas; lo descartado, de los motivos del lote,
// que nunca guardan el texto del modelo (HU-16.5).
import { ErrorNoEncontrado } from '../../comun/errores.js';
import type { Reloj } from '../../comun/reloj.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { PreguntaDeLote, PreguntasServicio } from '../preguntas/index.js';
import type { LotesRepositorio } from './generador.lotes.repositorio.js';
import { leerDetalle, type DescarteDePregunta } from './generador.motivos.js';
import type { UsoDeLaIa } from './generador.tipos.js';

export interface DependenciasConsultas {
  reloj: Reloj;
  lotes: Pick<LotesRepositorio, 'obtener' | 'usoDiario' | 'gastoMensual'>;
  preguntas: Pick<PreguntasServicio, 'preguntasDeLote'>;
  administracion: Pick<AdministracionServicio, 'obtenerParametroEntero' | 'obtenerParametroNumero'>;
}

export interface ResultadoDeLote {
  preguntas: PreguntaDeLote[];
  descartes: DescarteDePregunta[];
}

export interface Consultas {
  usoDeLaIa(): Promise<UsoDeLaIa>;
  resultadoDeLote(id: string): Promise<ResultadoDeLote>;
}

export function crearConsultas(d: DependenciasConsultas): Consultas {
  return {
    async usoDeLaIa() {
      const ahora = d.reloj();
      const [usadas, maximo, gasto, maximoUsd] = await Promise.all([
        d.lotes.usoDiario(ahora),
        d.administracion.obtenerParametroEntero('tope_diario_ia'),
        d.lotes.gastoMensual(ahora),
        d.administracion.obtenerParametroNumero('tope_mensual_ia_usd'),
      ]);
      return { hoy: { usadas, maximo }, mes: { gastadoUsd: gasto.gastado, maximoUsd } };
    },
    async resultadoDeLote(id) {
      const lote = await d.lotes.obtener(id);
      if (lote === null) throw new ErrorNoEncontrado('El lote no existe.');
      const preguntas = await d.preguntas.preguntasDeLote(id);
      return { preguntas, descartes: leerDetalle(lote.motivosDescarte) };
    },
  };
}
