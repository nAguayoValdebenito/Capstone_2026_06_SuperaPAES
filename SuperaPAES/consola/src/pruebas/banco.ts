// Pregunta del banco (C02) para las pruebas de la consola: una de M1 en revisión, con los cambios.
import type { PreguntaDelBanco } from '../tipos';

export const preguntaDelBanco = (cambios: Partial<PreguntaDelBanco> = {}): PreguntaDelBanco => ({
  id: 7,
  resumen: 'Si 2x + 3 = 11, ¿cuánto vale x?',
  prueba: { id: 2, codigo: 'M1', nombre: 'Matemática 1' },
  eje: { id: 11, nombre: 'Álgebra' },
  contenido: { id: 110, nombre: 'Ecuaciones' },
  estado: { codigo: 'en_revision', nombre: 'En revisión' },
  origen: 'importacion',
  dificultadSugerida: { codigo: 'facil', nombre: 'Fácil' },
  dificultadAsignada: null,
  posibleAmbigua: false,
  editable: false,
  actualizadoEn: '2026-10-20T12:00:00.000Z',
  ...cambios,
});
