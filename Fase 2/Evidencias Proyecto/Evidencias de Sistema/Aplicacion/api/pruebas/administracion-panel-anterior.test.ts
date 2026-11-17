// El Panel (C01) entrega también el período anterior, de la misma duración y justo antes, para comparar las
// cifras. Sin PostgreSQL: el servicio real con un repositorio en memoria.
import { describe, expect, it, vi } from 'vitest';
import { crearPanel } from '../modulos/administracion/administracion.panel.servicio.js';
import type {
  PanelRepositorio,
  Rango,
} from '../modulos/administracion/administracion.panel.repositorio.js';

const ACTUAL: Rango = { desde: '2026-10-16', hasta: '2026-11-14' };
const ANTERIOR: Rango = { desde: '2026-09-16', hasta: '2026-10-15' };

function repositorio() {
  const porRango = <T>(actual: T, anterior: T) =>
    vi.fn(({ desde }: Rango) => Promise.resolve(desde === ACTUAL.desde ? actual : anterior));
  return {
    rango: vi.fn(() => Promise.resolve(ACTUAL)),
    rangoAnterior: vi.fn(() => Promise.resolve(ANTERIOR)),
    estudiantes: porRango(
      { registrados: 3482, activos: 1916 },
      { registrados: 9999, activos: 1700 },
    ),
    suscripciones: porRango(
      { vigentes: 214, nuevas: 40, canceladas: 12 },
      { vigentes: 999, nuevas: 30, canceladas: 15 },
    ),
    revisionIa: porRango({ revisadas: 10, aprobadas: 7 }, { revisadas: 8, aprobadas: 6 }),
    registradosAntesDe: vi.fn(() => Promise.resolve(2950)),
    vigentesAl: vi.fn(() => Promise.resolve(190)),
    preguntasPorEstado: vi.fn(() => Promise.resolve([])),
    preguntasPorDificultad: vi.fn(() => Promise.resolve([])),
    respuestasPorDia: vi.fn(() => Promise.resolve([])),
  } satisfies PanelRepositorio;
}

describe('Panel: período anterior', () => {
  it('trae las cifras del período anterior y lo acumulado al empezar el período', async () => {
    const repo = repositorio();
    const panel = await crearPanel({ reloj: () => new Date(), repositorio: repo }).obtenerPanel(
      '30d',
    );

    expect(panel.rango).toEqual(ACTUAL);
    expect(panel.anterior.rango).toEqual(ANTERIOR);
    // Registrados y vigentes no son los de hoy: son los que había cuando empezó el período.
    expect(panel.estudiantes.registrados).toBe(3482);
    expect(panel.anterior.estudiantes).toEqual({ registrados: 2950, activos: 1700 });
    expect(panel.suscripciones.vigentes).toBe(214);
    expect(panel.anterior.suscripciones).toEqual({ vigentes: 190, nuevas: 30, canceladas: 15 });
    expect(repo.registradosAntesDe).toHaveBeenCalledWith(ACTUAL.desde);
    expect(repo.vigentesAl).toHaveBeenCalledWith(ANTERIOR.hasta);
  });

  it('la tasa de la IA del período anterior se calcula igual que la actual', async () => {
    const panel = await crearPanel({
      reloj: () => new Date(),
      repositorio: repositorio(),
    }).obtenerPanel('30d');

    expect(panel.ia).toEqual({ revisadas: 10, aprobadas: 7, tasa: 70 });
    expect(panel.anterior.ia).toEqual({ revisadas: 8, aprobadas: 6, tasa: 75 });
  });
});
