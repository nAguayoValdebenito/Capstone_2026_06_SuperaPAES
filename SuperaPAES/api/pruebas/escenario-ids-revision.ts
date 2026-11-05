// Datos del escenario de ids para las rutas de revisión (HU-21, HU-22 y HU-23): un servicio de revisión
// falso con los ids BIGINT como texto, como los entrega la base, y el cuerpo de la revisión o del
// desempate del docente.
import { vi } from 'vitest';
import type { RevisionServicio } from '../modulos/revision/index.js';

const VENCE = '2026-11-05T12:00:00.000Z';

/** Pregunta enviada a revisión (HU-21). */
const envioARevision = {
  preguntaId: '7',
  ronda: 1,
  version: 1,
  revisores: [
    {
      asignacionId: '900',
      docente: { id: '21', nombre: 'Docente', correo: 'docente@superapaes.cl' },
      venceEn: VENCE,
    },
  ],
};

const pendiente = {
  id: '900',
  preguntaId: '7',
  ronda: 1,
  prueba: { codigo: 'M1', nombre: 'Matemática 1' },
  contenido: 'Ecuaciones',
  venceEn: VENCE,
};

/** La pregunta que abre el docente (HU-22), con sus alternativas. */
const preguntaARevisar = {
  ...pendiente,
  eje: 'Álgebra',
  habilidad: 'Resolver problemas',
  enunciado: 'Pregunta',
  explicacion: 'Explicación',
  alternativas: [
    { id: '101', letra: 'A', texto: 'Primera', explicacion: null, esCorrecta: true },
    { id: '102', letra: 'B', texto: 'Segunda', explicacion: null, esCorrecta: false },
  ],
  texto: null,
  pauta: [{ codigo: 'contenido', descripcion: 'Contenido' }],
  dificultades: [{ codigo: 'facil', nombre: 'Fácil' }],
  decisiones: [{ codigo: 'aprobar', nombre: 'Aprobar', requiereComentario: false }],
};

/** Servicio de revisión con las rutas que devuelven ids respondiendo datos fijos. */
export function revisionDePrueba(base: RevisionServicio): RevisionServicio {
  return {
    ...base,
    enviarARevision: vi.fn(() => Promise.resolve(envioARevision)),
    listarSeguimiento: vi.fn(() =>
      Promise.resolve({
        seguimiento: {
          preguntas: [
            {
              id: '7',
              prueba: 'M1',
              contenido: 'Contenido',
              estado: { codigo: 'en_revision', nombre: 'En revisión' },
              posibleConfusa: false,
              revisores: [],
              desempate: null,
              venceEn: null,
            },
          ],
          conteos: { en_curso: 1, en_desempate: 0, vencidas: 0, terminadas: 0 },
          sinDocentes: [],
          plazoDias: 3,
        },
        paginacion: { pagina: 1, porPagina: 20, total: 1 },
      }),
    ),
    listarMisRevisiones: vi.fn(() => Promise.resolve([pendiente])),
    obtenerMiRevision: vi.fn(() => Promise.resolve(preguntaARevisar)),
    entregarRevision: vi.fn(() =>
      Promise.resolve({
        asignacionId: '900',
        preguntaId: '7',
        decision: 'aprobar',
        dificultad: 'facil',
      }),
    ),
    listarDesempates: vi.fn(() => Promise.resolve([pendiente])),
    obtenerDesempate: vi.fn(() =>
      Promise.resolve({ ...preguntaARevisar, revisiones: [], posibleAmbigua: false }),
    ),
    entregarDesempate: vi.fn(() =>
      Promise.resolve({
        asignacionId: '900',
        preguntaId: '7',
        decision: 'aprobar',
        dificultad: 'facil',
        estado: 'aprobada' as const,
      }),
    ),
  };
}

/** Las rutas del docente revisor (D01 y D02) se piden con la sesión de un docente. */
export const esDelDocente = (ruta: string) => /\/revision\/(mis-revisiones|desempates)/.test(ruta);

/** Cuerpo de la revisión o del desempate que entrega el docente, o undefined si la ruta es otra. */
export function cuerpoDeRevision(contrato: string): Record<string, unknown> | undefined {
  if (/^POST .*\/desempates\/:id$/.test(contrato))
    return { dificultad: 'facil', decision: 'aprobar' };
  if (!/^POST .*\/mis-revisiones\/:id$/.test(contrato)) return undefined;
  return {
    criterios: [{ codigo: 'contenido', cumple: true }],
    dificultad: 'facil',
    decision: 'aprobar',
  };
}
