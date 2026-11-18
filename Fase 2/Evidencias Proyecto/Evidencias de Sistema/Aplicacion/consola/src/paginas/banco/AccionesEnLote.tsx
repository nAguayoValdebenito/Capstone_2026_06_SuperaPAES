// Los dos botones de las acciones en lote del banco (C02), en la barra de acciones junto a «Importar
// archivo» y «Nueva pregunta»: «Enviar a revisión» y «Aceptar y publicar», 10 preguntas por clic con los
// filtros del banco. Siempre están; dicen cuántas toma el próximo clic y, sin ninguna, quedan
// deshabilitados con el motivo. Publicar sin revisión se confirma antes.
import { DialogoConfirmacion } from '../../componentes/DialogoConfirmacion';
import {
  type AccionEnLote,
  type AccionesEnLote,
  delProximoClic,
} from '../../estado/acciones-lote-banco';

const TEXTOS: Record<AccionEnLote, { boton: string; durante: string; sinNinguna: string }> = {
  enviar: {
    boton: 'Enviar a revisión',
    durante: 'Enviando…',
    sinNinguna:
      'No hay preguntas en borrador u observadas para enviar a revisión con estos filtros.',
  },
  publicar: {
    boton: 'Aceptar y publicar',
    durante: 'Publicando…',
    sinNinguna:
      'No hay preguntas en borrador, observadas o aprobadas para publicar con estos filtros.',
  },
};

function BotonLote({
  accion,
  quedan,
  acciones,
}: {
  accion: AccionEnLote;
  /** Cuántas quedan; null mientras se cuentan. */
  quedan: number | null;
  acciones: AccionesEnLote;
}) {
  const { boton, durante, sinNinguna } = TEXTOS[accion];
  const cantidad = quedan === null ? '' : ` (${String(delProximoClic(quedan))})`;
  return (
    <button
      type="button"
      className={accion === 'publicar' ? 'boton boton--peligro' : 'boton'}
      disabled={acciones.enCurso !== null || quedan === 0}
      title={
        quedan === 0 ? sinNinguna : 'Procesa hasta 10 preguntas por clic con los filtros puestos.'
      }
      onClick={() => acciones.ejecutar(accion)}
    >
      {acciones.enCurso === accion ? durante : `${boton}${cantidad}`}
    </button>
  );
}

export function BotonesEnLote({ acciones }: { acciones: AccionesEnLote }) {
  const { conteo } = acciones;
  const publicar = delProximoClic(conteo?.paraPublicar ?? 0);
  return (
    <>
      <BotonLote accion="enviar" quedan={conteo?.paraRevision ?? null} acciones={acciones} />
      <BotonLote accion="publicar" quedan={conteo?.paraPublicar ?? null} acciones={acciones} />
      <DialogoConfirmacion
        abierto={acciones.porConfirmar}
        titulo={`¿Aceptar y publicar ${String(publicar)} sin revisión?`}
        textoConfirmar="Aceptar y publicar"
        peligro
        alConfirmar={() => acciones.confirmar()}
        alCancelar={() => acciones.cancelar()}
      >
        <p>
          Llegan a la app sin pasar por los docentes, con su dificultad sugerida. Úsalo para probar
          la app; puedes retirarlas desde el banco.
        </p>
      </DialogoConfirmacion>
    </>
  );
}
