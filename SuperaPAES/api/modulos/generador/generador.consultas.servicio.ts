// Lecturas del generador para C05: lo usado de los topes (RNF-03).
import type { Reloj } from '../../comun/reloj.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { LotesRepositorio } from './generador.lotes.repositorio.js';
import type { UsoDeLaIa } from './generador.tipos.js';

export interface DependenciasConsultas {
  reloj: Reloj;
  lotes: Pick<LotesRepositorio, 'usoDiario' | 'gastoMensual'>;
  administracion: Pick<AdministracionServicio, 'obtenerParametroEntero' | 'obtenerParametroNumero'>;
}

export interface Consultas {
  usoDeLaIa(): Promise<UsoDeLaIa>;
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
  };
}
