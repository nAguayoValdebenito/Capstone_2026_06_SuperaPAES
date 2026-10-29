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
const progresoDePrueba = {
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

/** Resultado de HU-61.1 de un mini-ensayo, con un eje y una habilidad (ids de la base en texto). */
const resultado = {
  id: '41',
  tipo: { codigo: 'mini_ensayo', nombre: 'Mini-ensayo' },
  prueba: { id: 2, codigo: 'M1', nombre: 'Competencia Matemática 1' },
  ejes: [{ id: 3, nombre: 'Números', preguntas: 6, correctas: 5 }],
  habilidades: [{ id: 7, nombre: 'Resolver problemas', preguntas: 6, correctas: 5 }],
};

/** Revisión de HU-61.1 con una pregunta respondida. */
const revision = {
  id: '41',
  preguntas: [
    {
      orden: 1,
      preguntaId: '900',
      eje: { id: 3, nombre: 'Números' },
      alternativaElegidaId: '102',
      alternativaCorrectaId: '101',
      alternativas: [
        { id: 101, letra: 'A' },
        { id: 102, letra: 'B' },
      ],
    },
  ],
};

/** Progreso (HU-38.2), resultado y revisión (HU-61.1) del servicio de evaluaciones. */
export function serviciosEvaluacionesEstudiante() {
  return {
    obtenerProgreso: vi.fn(() => Promise.resolve(progresoDePrueba)),
    obtenerResultado: vi.fn(() => Promise.resolve(resultado as never)),
    obtenerRevision: vi.fn(() => Promise.resolve(revision as never)),
  };
}

/** Puntajes de HU-41.1 con el permiso dado y un puntaje (sus ids llegan como texto de la base). */
const puntajes = {
  permiso: {
    documento: { id: 3, version: '1.0', texto: 'Permiso' },
    otorgado: true,
    otorgadoEn: fecha,
  },
  puntajes: [{ id: '12', pruebaId: 2, anioAdmision: 2026, puntaje: 650, creadoEn: fecha }],
};

/** «Descargar mis datos» de HU-07.1 con una evaluación respondida y un puntaje (ids de la base en texto). */
const datosDelEstudiante = {
  generadoEn: fecha,
  cuenta: { id: '84', nombre: 'Ana', correo: 'ana@ejemplo.cl', correoVerificado: true },
  consentimientos: [{ documento: 'terminos', version: '1.0', aceptadoEn: fecha, revocadoEn: null }],
  perfil: { pruebas: [1, 2], electivoId: 4, pruebaReforzarId: 2, areasCarrera: [1] },
  evaluaciones: [{ id: '41', tipo: 'practica', respuestas: [{ orden: 1, preguntaId: '900' }] }],
  puntajes: [{ id: '12', pruebaId: 2, anioAdmision: 2026, puntaje: 650 }],
};

/**
 * El servicio de privacidad con la descarga de datos. Solo trae los campos que el inventario de ids
 * revisa, así que no cumple todo el tipo del servicio.
 */
export const privacidadDePrueba = {
  exportarDatos: vi.fn(() => Promise.resolve(datosDelEstudiante as never)),
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
