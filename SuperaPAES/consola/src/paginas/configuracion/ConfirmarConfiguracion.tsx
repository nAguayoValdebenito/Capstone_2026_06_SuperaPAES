import { useEffect, useRef, type RefObject } from 'react';
import { manejarTeclaConfiguracion } from '../../estado/configuracion-teclado';
import type { ParametroConfiguracion } from '../../tipos/configuracion';

function useControlesConfirmacion() {
  const cancelar = useRef<HTMLButtonElement>(null);
  const aceptar = useRef<HTMLButtonElement>(null);
  useEffect(() => cancelar.current?.focus(), []);
  return { cancelar, aceptar };
}

function BotonesConfirmacion({
  cancelar,
  aceptar,
  guardando,
  alCancelar,
  alConfirmar,
}: {
  cancelar: RefObject<HTMLButtonElement | null>;
  aceptar: RefObject<HTMLButtonElement | null>;
  guardando: boolean;
  alCancelar: () => void;
  alConfirmar: () => void;
}) {
  return (
    <div className="pagina__acciones">
      <button
        ref={cancelar}
        type="button"
        className="boton"
        disabled={guardando}
        onClick={alCancelar}
      >
        Cancelar
      </button>
      <button
        ref={aceptar}
        type="button"
        className="boton boton--primario"
        disabled={guardando}
        onClick={alConfirmar}
      >
        {guardando ? 'Guardando…' : 'Guardar cambio'}
      </button>
    </div>
  );
}

export function ConfirmarConfiguracion({
  parametro,
  valor,
  guardando,
  alConfirmar,
  alCancelar,
}: {
  parametro: ParametroConfiguracion;
  valor: number;
  guardando: boolean;
  alConfirmar: () => void;
  alCancelar: () => void;
}) {
  const { cancelar, aceptar } = useControlesConfirmacion();
  return (
    <div className="configuracion__fondo">
      <div
        className="panel configuracion__confirmacion"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="configuracion-confirmar-titulo"
        aria-describedby="configuracion-confirmar-detalle"
        onKeyDown={(evento) =>
          manejarTeclaConfiguracion(evento, { cancelar, aceptar }, guardando, alCancelar)
        }
      >
        <h2 id="configuracion-confirmar-titulo">Confirmar cambio</h2>
        <p id="configuracion-confirmar-detalle">
          {parametro.nombre}: de{' '}
          <strong>
            {String(parametro.valor)} {parametro.unidad}
          </strong>{' '}
          a{' '}
          <strong>
            {valor} {parametro.unidad}
          </strong>
          .
        </p>
        <BotonesConfirmacion
          cancelar={cancelar}
          aceptar={aceptar}
          guardando={guardando}
          alCancelar={alCancelar}
          alConfirmar={alConfirmar}
        />
      </div>
    </div>
  );
}
