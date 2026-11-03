// Datos de prueba de las bandejas del docente (D01, HU-22; D02, HU-23): las listas de dificultad y
// decisión, el estado de la bandeja sin acciones y la primera llamada que se hizo a la API.
import { vi } from 'vitest';
import { camposVacios } from '../estado/formulario-revision';

const sinAccion = () => undefined;

/** Las listas de opciones de la decisión, como las entrega la API. */
export const OPCIONES_DE_DECISION = {
  dificultades: [
    { codigo: 'facil', nombre: 'Fácil' },
    { codigo: 'media', nombre: 'Media' },
    { codigo: 'dificil', nombre: 'Difícil' },
  ],
  decisiones: [
    { codigo: 'aprobar', nombre: 'Aprobar', requiereComentario: false },
    { codigo: 'observar', nombre: 'Observar', requiereComentario: true },
    { codigo: 'rechazar', nombre: 'Rechazar', requiereComentario: true },
  ],
};

/** El formulario vacío y sin acciones; cada prueba pone la bandeja y la asignación abierta. */
export const formularioSinAcciones = () => ({
  campos: camposVacios(),
  errores: {},
  enviando: false,
  aviso: null,
  elegir: sinAccion,
  entregar: sinAccion,
  responder: sinAccion,
  observar: sinAccion,
  elegirDificultad: sinAccion,
  elegirDecision: sinAccion,
  escribirMotivo: sinAccion,
});

/** La primera llamada a fetch: la ruta bajo /api/v1, el método y el cuerpo. */
export function primeraLlamada() {
  const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
  return {
    url: (url as string).replace(/^.*\/api\/v1/, ''),
    metodo: init?.method ?? 'GET',
    cuerpo: init?.body,
  };
}
