// Textos de lectura sin PostgreSQL (HU-12.2): un repositorio en memoria con un texto guardado (el 12)
// y las etapas de las preguntas que usan cada texto, para probar cuándo se puede editar.
import { vi } from 'vitest';
import type {
  EtapaDeUso,
  FilaTexto,
  PreguntasTextosRepositorio,
} from '../modulos/preguntas/preguntas.textos.repositorio.js';
import type { DatosTexto } from '../modulos/preguntas/preguntas.validadores.js';

export const RUTA_TEXTOS = '/api/v1/admin/preguntas/textos';

const TIPOS = [
  { codigo: 'literario', nombre: 'Literario' },
  { codigo: 'no_literario', nombre: 'No literario' },
  { codigo: 'tabla', nombre: 'Tabla' },
];

/** Cuerpo de un texto válido, con cambios. */
export function cuerpoTexto(cambios: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    tipoTexto: 'literario',
    titulo: 'El faro del sur',
    contenido: 'Había una vez un faro con $2^{3}$ ventanas.',
    ...cambios,
  };
}

const fila = (id: string, datos: DatosTexto): FilaTexto => ({
  id,
  ...datos,
  preguntas: 0,
  creadoEn: new Date('2026-10-30T12:00:00Z'),
});

export function textosEnMemoria() {
  const textos = new Map<string, FilaTexto>([
    [
      '12',
      fila('12', {
        tipoTexto: 'no_literario',
        titulo: 'La migración de las aves',
        contenido: 'Cada otoño...',
        imagenUrl: null,
      }),
    ],
  ]);
  const etapas = new Map<string, EtapaDeUso[]>();
  let siguienteId = 13;
  const repositorio = {
    listar: vi.fn(
      ({ buscar, limite, desde }: { buscar: string | null; limite: number; desde: number }) => {
        const todos = [...textos.values()].filter(
          (texto) => !buscar || (texto.titulo ?? '').toLowerCase().includes(buscar.toLowerCase()),
        );
        const filas = todos.slice(desde, desde + limite).map(({ contenido, tipoTexto, ...t }) => ({
          ...t,
          tipoTexto: TIPOS.find((tipo) => tipo.codigo === tipoTexto) ?? TIPOS[0]!,
          resumen: contenido,
        }));
        return Promise.resolve({ filas, total: todos.length });
      },
    ),
    obtener: vi.fn((id: string) => Promise.resolve(textos.get(id) ?? null)),
    insertar: vi.fn((datos: DatosTexto) => {
      const id = String(siguienteId++);
      textos.set(id, fila(id, datos));
      return Promise.resolve(id);
    }),
    actualizar: vi.fn((id: string, datos: DatosTexto) => {
      const actual = textos.get(id);
      if (actual) textos.set(id, { ...actual, ...datos });
      return Promise.resolve();
    }),
    etapasQueLoUsan: vi.fn((id: string) => Promise.resolve(etapas.get(id) ?? [])),
    listarTipos: vi.fn(() => Promise.resolve(TIPOS)),
  } satisfies PreguntasTextosRepositorio;
  /** Una pregunta en la etapa indicada pasa a usar el texto. */
  const usarEn = (id: string, etapa: EtapaDeUso) => {
    etapas.set(id, [...(etapas.get(id) ?? []), etapa]);
  };
  return { repositorio, usarEn };
}
