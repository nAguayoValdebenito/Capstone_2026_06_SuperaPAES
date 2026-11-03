// Datos de prueba de las bandejas del docente (D01, HU-22; D02, HU-23): las listas de dificultad y
// decisión y el estado de la bandeja sin acciones.
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
