import { describe, expect, it } from 'vitest';
import {
  armarEvaluacion,
  type CandidataEstructura,
  type EstructuraConTiempo,
} from '../modulos/evaluaciones/evaluaciones.estructura.js';

describe('textos completos en el armado (HU-40.1)', () => {
  it('no completa el total recortando textos aunque las cuotas individuales alcancen', () => {
    const estructura: EstructuraConTiempo = {
      id: 1,
      pruebaId: 1,
      codigo: 'CL',
      cantidad: 6,
      duracionMin: 10,
      textos: 2,
      detalles: [
        { ejeId: null, habilidadId: 1, esElectivo: false, cantidad: 6, orden: 1, disponible: true },
      ],
    };
    const candidatas: CandidataEstructura[] = Array.from({ length: 9 }, (_, i) => ({
      preguntaId: String(i + 1),
      version: 1,
      ejeId: 1,
      habilidadId: 1,
      areaId: 1,
      dificultad: 'media',
      textoId: String(Math.floor(i / 3) + 1),
      ordenEnTexto: (i % 3) + 1,
    }));
    // 6 preguntas existen, pero pedir 4 exige cortar alguno de los bloques de 3.
    expect(
      armarEvaluacion({ ...estructura, cantidad: 4 }, candidatas, [
        { codigo: 'facil', objetivo: 0 },
        { codigo: 'media', objetivo: 100 },
        { codigo: 'dificil', objetivo: 0 },
      ]),
    ).toBeNull();
  });
});
