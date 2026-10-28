// Datos del escenario de ids (escenario-ids.ts) para el progreso (HU-38.2) y los puntajes PAES
// (HU-41.1) del estudiante: cada campo de id lleva un valor para que el inventario lo compruebe.
import { vi } from 'vitest';

const fecha = new Date('2026-01-01T00:00:00.000Z');

/** Progreso de HU-38.2 con un eje, una habilidad y un ensayo. */
const grupoProgreso = {
  respondidas: 10,
  correctas: 5,
  aciertoPonderado: 45.7,
  aciertoPorDificultad: { media: 80, dificil: 20 },
  aReforzar: true,
};
export const progresoDePrueba = {
  pruebas: [
    {
      pruebaId: 2,
      codigo: 'M1',
      nombre: 'Competencia Matemática 1',
      respondidas: 10,
      correctas: 5,
      acierto: 50,
      aciertoPonderado: 45.7,
      aciertoPorDificultad: { media: 80, dificil: 20 },
      ejes: [{ id: 3, nombre: 'Números', ...grupoProgreso }],
      habilidades: [{ id: 7, nombre: 'Resolver problemas', ...grupoProgreso }],
      semanas: [{ semana: '2026-10-26', respondidas: 10, acierto: 50 }],
      ensayos: [{ id: '41', cerradaEn: fecha, puntaje: 650 }],
    },
  ],
};

/** Puntajes de HU-41.1 con el permiso dado y un puntaje (sus ids llegan como texto de la base). */
const puntajes = {
  permiso: {
    documento: { id: 3, version: '1.0', texto: 'Permiso' },
    otorgado: true,
    otorgadoEn: fecha,
  },
  puntajes: [{ id: '12', pruebaId: 2, anioAdmision: 2026, puntaje: 650, creadoEn: fecha }],
};

/** Las rutas de los puntajes del servicio de cuentas, que responden todas lo mismo. */
export function serviciosPuntajes() {
  const responder = () => vi.fn(() => Promise.resolve(puntajes));
  return {
    obtenerPuntajes: responder(),
    guardarPuntaje: responder(),
    otorgarPermisoPuntajes: responder(),
    retirarPermisoPuntajes: responder(),
    borrarPuntaje: responder(),
  };
}

/** Cuerpo de las rutas de los puntajes que lo piden. */
export function cuerpoPuntajes(ruta: string): Record<string, unknown> | undefined {
  if (ruta === 'PUT /api/v1/app/cuentas/puntajes')
    return { pruebaId: 2, anioAdmision: 2026, puntaje: 650 };
  if (ruta === 'POST /api/v1/app/cuentas/puntajes/permiso') return { documentoId: 3 };
  return undefined;
}
