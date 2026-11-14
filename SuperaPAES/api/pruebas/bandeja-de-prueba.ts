// Repositorio falso de la bandeja del docente (D01, HU-22; D02, HU-23) para las pruebas por HTTP sin
// PostgreSQL: una asignación pendiente (900) de la pregunta 7 con dos alternativas, la pauta y las
// listas de dificultad y decisión, y la app con el servicio real de revision sin base.
import { vi } from 'vitest';
import { crearRevisionServicio } from '../modulos/revision/index.js';
import type { BandejaRepositorio } from '../modulos/revision/revision.bandeja.repositorio.js';
import type { DependenciasRevisionServicio } from '../modulos/revision/revision.servicio.js';
import { crearAppDePrueba, tokenAdmin } from './ayudantes.js';

export const AHORA = new Date('2026-11-03T15:00:00.000Z');
export const VENCE = new Date('2026-11-05T12:00:00.000Z');

export const PAUTA = [
  { codigo: 'contenido', descripcion: 'La pregunta evalúa el contenido.' },
  { codigo: 'enunciado', descripcion: 'El enunciado es claro.' },
];

export const PENDIENTE = {
  id: '900',
  preguntaId: '7',
  ronda: 1,
  prueba: { codigo: 'M1', nombre: 'Competencia Matemática 1' },
  contenido: 'Ecuaciones',
  venceEn: VENCE,
};

/** La bandeja; `estado` es el de la asignación al entregarla (null si no es del docente). */
export function bandejaDePrueba(estado: string | null = 'pendiente') {
  return {
    listarPendientes: vi.fn(() => Promise.resolve([PENDIENTE])),
    obtenerPendiente: vi.fn((id: string) =>
      Promise.resolve(
        id === '900'
          ? {
              ...PENDIENTE,
              eje: 'Álgebra',
              habilidad: 'Resolver problemas',
              copia: {
                enunciado: 'Si $2x = 8$, ¿cuánto vale $x$?',
                explicacion: 'Se divide por 2.',
                alternativas: [
                  { id: 101, letra: 'A', texto: '2', explicacion: null },
                  { id: 102, letra: 'B', texto: '4', explicacion: null },
                ],
              },
              correctaId: '102',
              texto: null,
            }
          : null,
      ),
    ),
    listarCriterios: vi.fn(() => Promise.resolve(PAUTA)),
    listarDificultades: vi.fn(() =>
      Promise.resolve([
        { codigo: 'facil', nombre: 'Fácil' },
        { codigo: 'media', nombre: 'Media' },
        { codigo: 'dificil', nombre: 'Difícil' },
      ]),
    ),
    listarDecisiones: vi.fn(() =>
      Promise.resolve([
        { codigo: 'aprobar', nombre: 'Aprobar', requiereComentario: false },
        { codigo: 'observar', nombre: 'Observar', requiereComentario: true },
        { codigo: 'rechazar', nombre: 'Rechazar', requiereComentario: true },
      ]),
    ),
    reservarAsignacion: vi.fn(() =>
      Promise.resolve(estado === null ? null : { estado, preguntaId: PENDIENTE.preguntaId }),
    ),
    guardarRevision: vi.fn(() => Promise.resolve()),
  } satisfies BandejaRepositorio;
}

/** Cabecera de la sesión de un docente de la consola. */
export const comoDocente = async (id = '21') => ({
  Authorization: `Bearer ${await tokenAdmin('docente', id)}`,
});

/** La app con el servicio real de revision sin base: reloj fijo, parámetros y preguntas falsos. */
export function appDeRevision(cambios: Partial<DependenciasRevisionServicio>) {
  const tx = { query: () => Promise.reject(new Error('sin base')) };
  const revision = crearRevisionServicio({
    bd: tx,
    unidadDeTrabajo: { enTransaccion: (trabajo) => trabajo(tx) },
    reloj: () => AHORA,
    administracion: {
      obtenerParametroEntero: () => Promise.resolve(2),
      registrarAuditoria: () => Promise.resolve(),
    },
    preguntas: {
      pasarARevision: () => Promise.reject(new Error('no se usa')),
      resolverRevision: () => Promise.resolve(),
    },
    evaluaciones: { estadisticasFueraDeRango: () => Promise.resolve([]) },
    ...cambios,
  });
  return { app: crearAppDePrueba({}, { revision }), tx };
}
