// Confirmación antes de guardar la decisión del docente (D04, HU-26.1): explica qué pasa con la pregunta.
// Escape o Cancelar la cierran sin enviar nada; quien la abre devuelve el foco al botón que la abrió.
import { useEffect, useRef } from 'react';
import {
  alPresionarTecla,
  textoDeConfirmacion,
  type DecisionPendiente,
} from '../../estado/calibracion';

export function ConfirmarDecision({
  pendiente,
  enCurso,
  alConfirmar,
  alCancelar,
}: {
  pendiente: DecisionPendiente;
  enCurso: boolean;
  alConfirmar: () => void;
  alCancelar: () => void;
}) {
  const cancelar = useRef<HTMLButtonElement>(null);
  useEffect(() => cancelar.current?.focus(), []);
  const { item, dificultadCorresponde } = pendiente;
  const titulo = dificultadCorresponde
    ? '¿La dificultad está bien?'
    : '¿Confirmas que la dificultad no corresponde?';
  return (
    <div className="calibracion__fondo">
      <div
        className="panel calibracion__confirmacion"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="calibracion-titulo"
        aria-describedby="calibracion-efecto"
        onKeyDown={(evento) => alPresionarTecla(evento.key, alCancelar)}
      >
        <h2 id="calibracion-titulo">{titulo}</h2>
        <p id="calibracion-efecto">{textoDeConfirmacion(dificultadCorresponde, item)}</p>
        <div className="pagina__acciones">
          <button type="button" ref={cancelar} className="boton" onClick={alCancelar}>
            Cancelar
          </button>
          <button
            type="button"
            className="boton boton--primario"
            disabled={enCurso}
            onClick={alConfirmar}
          >
            {enCurso ? 'Guardando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
