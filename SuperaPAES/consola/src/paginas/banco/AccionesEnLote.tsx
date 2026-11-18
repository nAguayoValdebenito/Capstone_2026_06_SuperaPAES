// Acciones en lote del banco (C02), para llenar la app de preguntas y probarla: «Enviar a revisión» las
// preguntas de la página que lo admiten y, con el modo de pruebas de la API, «Aceptar y publicar sin
// revisión» los borradores de la página; hasta 10 por clic. Publicar sin revisión se confirma antes.
import { DialogoConfirmacion } from '../../componentes/DialogoConfirmacion';
import {
  type AccionEnLote,
  type AccionesEnLote as Acciones,
  MAXIMO_LOTE,
  paraEnviar,
  paraPublicar,
} from '../../estado/acciones-lote-banco';
import type { PreguntaDelBanco } from '../../tipos';

/** El texto de cada botón: antes y mientras se hace. */
const TEXTOS: Record<AccionEnLote, [string, string]> = {
  enviar: ['Enviar a revisión', 'Enviando…'],
  publicar: ['Aceptar y publicar sin revisión', 'Publicando…'],
};

function BotonLote({
  accion,
  ids,
  acciones,
}: {
  accion: AccionEnLote;
  ids: readonly number[];
  acciones: Acciones;
}) {
  if (ids.length === 0) return null;
  const [antes, durante] = TEXTOS[accion];
  return (
    <button
      type="button"
      className={accion === 'publicar' ? 'boton boton--peligro' : 'boton'}
      disabled={acciones.enCurso !== null}
      onClick={() => acciones.ejecutar(accion, ids)}
    >
      {acciones.enCurso === accion ? durante : `${antes} (${String(ids.length)})`}
    </button>
  );
}

export function AccionesEnLote({
  preguntas,
  modoPruebas,
  acciones,
}: {
  preguntas: readonly PreguntaDelBanco[];
  modoPruebas: boolean;
  acciones: Acciones;
}) {
  const enviar = paraEnviar(preguntas);
  const publicar = modoPruebas ? paraPublicar(preguntas) : [];
  const { aviso } = acciones;
  if (enviar.length === 0 && publicar.length === 0 && !aviso) return null;
  return (
    <section className="lote" aria-label="Acciones en lote">
      <p className="lote__nota">
        {`Actúan sobre las preguntas de esta página, hasta ${String(MAXIMO_LOTE)} por clic.`}
      </p>
      <div className="lote__botones">
        <BotonLote accion="enviar" ids={enviar} acciones={acciones} />
        <BotonLote accion="publicar" ids={publicar} acciones={acciones} />
      </div>
      {aviso && (
        <p
          className={`aviso aviso--${aviso.tipo}`}
          role={aviso.tipo === 'error' ? 'alert' : 'status'}
        >
          {aviso.texto}
        </p>
      )}
      <DialogoConfirmacion
        abierto={acciones.porConfirmar}
        titulo={`¿Publicar ${String(publicar.length)} sin revisión?`}
        textoConfirmar="Publicar sin revisión"
        peligro
        alConfirmar={() => acciones.confirmar(publicar)}
        alCancelar={() => acciones.cancelar()}
      >
        <p>
          Modo de pruebas: los borradores de esta página llegan a la app sin pasar por los docentes,
          con su dificultad sugerida. Úsalo solo para probar la app; puedes retirarlas desde el
          banco.
        </p>
      </DialogoConfirmacion>
    </section>
  );
}
