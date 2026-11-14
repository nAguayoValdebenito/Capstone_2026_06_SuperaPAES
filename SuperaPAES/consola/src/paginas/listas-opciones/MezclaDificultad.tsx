// La mezcla global de dificultad en C09 (D1, RN-09, HU-64): la tabla vigente y su edición. El administrador
// cambia mínimo, objetivo y máximo de cada dificultad; los objetivos deben sumar 100. Una sola mezcla
// para todo el sistema (Panel y Generador la leen); no hay mezcla por tipo de evaluación.
import { Alerta } from '../../componentes/Alerta';
import { EncabezadoTabla } from '../../componentes/EncabezadoTabla';
import {
  sumaDeMezcla,
  useMezclaDificultad,
  type CampoMezcla,
  type EdicionMezcla,
} from '../../estado/mezcla-dificultad';
import type { DificultadLista } from '../../tipos/temario';
import { TablaDificultades } from './TablasListas';

const CAMPOS: readonly { campo: CampoMezcla; texto: string }[] = [
  { campo: 'minimo', texto: 'Mínimo' },
  { campo: 'objetivo', texto: 'Objetivo' },
  { campo: 'maximo', texto: 'Máximo' },
];

function FilaEditable({ edicion, indice }: { edicion: EdicionMezcla; indice: number }) {
  const fila = edicion.filas?.[indice];
  if (!fila) return null;
  return (
    <tr>
      <th scope="row">{fila.nombre}</th>
      {CAMPOS.map(({ campo, texto }) => (
        <td key={campo}>
          <input
            className="control mezcla__campo"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            aria-label={`${texto} de ${fila.nombre}, en porcentaje`}
            value={Number.isNaN(fila[campo]) ? '' : fila[campo]}
            disabled={edicion.guardando}
            onChange={(e) => edicion.cambiar(fila.codigo, campo, e.target.valueAsNumber)}
          />
        </td>
      ))}
    </tr>
  );
}

/** La suma de cada columna, con el estado del objetivo (debe ser 100) con marca de forma. */
function Totales({ edicion }: { edicion: EdicionMezcla }) {
  const filas = edicion.filas ?? [];
  const objetivos = sumaDeMezcla(filas, 'objetivo');
  return (
    <tr className="mezcla__totales">
      <th scope="row">Suma</th>
      <td>{sumaDeMezcla(filas, 'minimo')} %</td>
      <td>
        <span className={`etiqueta etiqueta--${objetivos === 100 ? 'activa' : 'atencion'}`}>
          {objetivos} de 100 %
        </span>
      </td>
      <td>{sumaDeMezcla(filas, 'maximo')} %</td>
    </tr>
  );
}

function FormularioMezcla({ edicion }: { edicion: EdicionMezcla }) {
  const { filas, problemas, guardando, error } = edicion;
  return (
    <form
      className="mezcla"
      noValidate
      onSubmit={(evento) => {
        evento.preventDefault();
        edicion.guardar();
      }}
    >
      <div className="tabla-desplazable">
        <table className="tabla listas-opciones__tabla">
          <caption>Editar la mezcla global de dificultad (RN-09)</caption>
          <EncabezadoTabla columnas={['Dificultad', 'Mínimo (%)', 'Objetivo (%)', 'Máximo (%)']} />
          <tbody>
            {(filas ?? []).map((fila, indice) => (
              <FilaEditable key={fila.codigo} edicion={edicion} indice={indice} />
            ))}
            <Totales edicion={edicion} />
          </tbody>
        </table>
      </div>
      {problemas.length > 0 && (
        <div className="aviso aviso--advertencia" role="status">
          <ul className="mezcla__problemas">
            {problemas.map((problema) => (
              <li key={problema}>{problema}</li>
            ))}
          </ul>
        </div>
      )}
      {error && <Alerta texto={error} />}
      <div className="panel__acciones">
        <button type="button" className="boton" onClick={edicion.cancelar} disabled={guardando}>
          Cancelar
        </button>
        <button
          type="submit"
          className="boton boton--primario"
          disabled={guardando || problemas.length > 0}
          aria-busy={guardando}
        >
          {guardando ? 'Guardando…' : 'Guardar mezcla'}
        </button>
      </div>
    </form>
  );
}

export function MezclaDificultad({
  dificultades,
  alGuardar,
}: {
  dificultades: readonly DificultadLista[];
  alGuardar: () => void;
}) {
  const edicion = useMezclaDificultad(dificultades, alGuardar);
  return (
    <>
      <div className="mezcla__barra">
        <p className="campo__ayuda">
          Una sola mezcla para todo el sistema: el Panel la muestra y el Generador la pide. Los
          objetivos deben sumar 100.
        </p>
        {!edicion.filas && dificultades.length > 0 && (
          <button type="button" className="boton" onClick={edicion.abrir}>
            Editar mezcla
          </button>
        )}
      </div>
      {edicion.guardada && (
        <p className="aviso aviso--exito" role="status">
          Mezcla guardada. El cambio quedó registrado en la auditoría.
        </p>
      )}
      {edicion.filas ? (
        <FormularioMezcla edicion={edicion} />
      ) : (
        <TablaDificultades dificultades={dificultades} />
      )}
    </>
  );
}
