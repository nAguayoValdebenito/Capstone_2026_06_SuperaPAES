// Desempates (D02, HU-23, CU-20): la bandeja del tercer docente (bandeja-docente.ts) con la pregunta,
// las dos revisiones de la ronda y su decisión: la dificultad final, aprobar, observar o rechazar, y el
// motivo al observar o rechazar.
import { entregarDesempate, listarDesempates, obtenerDesempate } from '../servicios/revision';
import type { DesempateAbierto } from '../tipos';
import { type ApiDeBandeja, type EstadoBandejaDocente, useBandejaDocente } from './bandeja-docente';
import { armarDecision, validarDecision } from './formulario-revision';

const DESEMPATES: ApiDeBandeja<DesempateAbierto> = {
  listar: listarDesempates,
  obtener: obtenerDesempate,
  validar: validarDecision,
  entregar: (campos, pregunta) => entregarDesempate(pregunta.id, armarDecision(campos)),
  aviso: (pregunta) => `Desempate de la pregunta ${String(pregunta.preguntaId)} entregado.`,
};

export const useDesempateDocente = () => useBandejaDocente(DESEMPATES);

export type DesempateDocente = EstadoBandejaDocente<DesempateAbierto>;
