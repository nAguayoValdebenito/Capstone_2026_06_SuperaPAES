// Confirmación fuerte para anular una pregunta (HU-50 esc. 3, CU-26a): explica el efecto, muestra cuántas
// evaluaciones se recalcularán y pide marcar que se entiende que no se puede deshacer. Escape o Cancelar
// la cierran sin enviar nada; quien la abre devuelve el foco al botón «Anular pregunta».
import { useEffect, useRef, useState, type RefObject } from 'react';
import { alPresionarTecla, textoDeImpacto } from '../../estado/avisos-error';
import type { Carga } from '../../estado/carga';
import type { ImpactoDeAnular } from '../../tipos/avisos-error';

/** El efecto de anular y cuántas evaluaciones se recalcularán, que lee el lector de pantalla. */
function Explicacion({ impacto }: { impacto: Carga<ImpactoDeAnular> }) {
  return (
    <>
      <p id="anular-efecto">
        Deja de entregarse y no cuenta en los resultados de las evaluaciones donde apareció, que se
        recalculan. Los estudiantes verán su resultado marcado como recalculado. Sus avisos
        pendientes quedan resueltos. No se puede deshacer.
      </p>
      <p id="anular-impacto" aria-live="polite">
        <strong>{textoDeImpacto(impacto)}</strong>
      </p>
    </>
  );
}

function Botones({
  cancelar,
  habilitado,
  alConfirmar,
  alCancelar,
}: {
  cancelar: RefObject<HTMLButtonElement | null>;
  habilitado: boolean;
  alConfirmar: () => void;
  alCancelar: () => void;
}) {
  return (
    <div className="pagina__acciones">
      <button type="button" ref={cancelar} className="boton" onClick={alCancelar}>
        Cancelar
      </button>
      <button
        type="button"
        className="boton boton--peligro"
        disabled={!habilitado}
        onClick={alConfirmar}
      >
        Anular pregunta
      </button>
    </div>
  );
}

export function ConfirmarAnulacion({
  preguntaId,
  impacto,
  enCurso,
  alConfirmar,
  alCancelar,
}: {
  preguntaId: number;
  impacto: Carga<ImpactoDeAnular>;
  enCurso: boolean;
  alConfirmar: () => void;
  alCancelar: () => void;
}) {
  const [entendido, setEntendido] = useState(false);
  const cancelar = useRef<HTMLButtonElement>(null);
  useEffect(() => cancelar.current?.focus(), []);
  return (
    <div className="avisos__fondo">
      <div
        className="panel avisos__confirmacion"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="anular-titulo"
        aria-describedby="anular-efecto anular-impacto"
        onKeyDown={(evento) => alPresionarTecla(evento.key, alCancelar)}
      >
        <h2 id="anular-titulo">{`¿Anular la pregunta P-${String(preguntaId)}?`}</h2>
        <Explicacion impacto={impacto} />
        <label className="avisos__entendido">
          <input
            type="checkbox"
            checked={entendido}
            onChange={(evento) => setEntendido(evento.target.checked)}
          />
          Entiendo que la anulación no se puede deshacer.
        </label>
        <Botones
          cancelar={cancelar}
          habilitado={entendido && !enCurso}
          alConfirmar={alConfirmar}
          alCancelar={alCancelar}
        />
      </div>
    </div>
  );
}
