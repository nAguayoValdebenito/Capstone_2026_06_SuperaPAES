// D03 · Clasificar dificultad (HU-25.2, CU-19a, RF-G12): una pregunta importada por vista, completa como
// en D01 (PreguntaRevisada), y la dificultad con un clic o con las teclas 1, 2 y 3. El clic entrega la
// revisión del docente con esa dificultad, la aprueba y da por cumplida la pauta; para observar o
// rechazar, «Revisar con la pauta» abre la misma asignación en Mis revisiones (D01). Se carga al abrir la
// sección (trae KaTeX, como D01). La lógica está en estado/clasificar-dificultad.ts.
import { Link } from 'react-router';
import { Alerta } from '../../componentes/Alerta';
import {
  type ClasificacionDocenteEstado,
  TECLAS_DIFICULTAD,
  textoQuedan,
  useClasificacionDocente,
} from '../../estado/clasificar-dificultad';
import type { PreguntaAClasificar } from '../../tipos';
import { PreguntaRevisada } from '../revision/PreguntaRevisada';
import './clasificar-dificultad.css';

const ID_INDICACION = 'clasificar-indicacion';

function Botones({
  pregunta,
  estado,
}: {
  pregunta: PreguntaAClasificar;
  estado: ClasificacionDocenteEstado;
}) {
  return (
    <section className="panel panel--ancho clasificar__panel" aria-label="Dificultad">
      <div className="clasificar__botones">
        {pregunta.dificultades.map((dificultad, posicion) => (
          <button
            key={dificultad.codigo}
            ref={posicion === 0 ? estado.primerBoton : undefined}
            type="button"
            className={`boton clasificar__boton clasificar__boton--${dificultad.codigo}`}
            aria-keyshortcuts={TECLAS_DIFICULTAD[posicion]}
            aria-describedby={ID_INDICACION}
            disabled={estado.guardando}
            onClick={() => estado.clasificar(dificultad)}
          >
            <span className="clasificar__nombre">{dificultad.nombre}</span>
            <kbd className="clasificar__tecla" aria-hidden="true">
              {TECLAS_DIFICULTAD[posicion]}
            </kbd>
          </button>
        ))}
      </div>
      <p id={ID_INDICACION} className="clasificar__indicacion">
        Al elegir, apruebas la pregunta con esa dificultad y das por cumplida la pauta. Pasa a la
        siguiente. Atajos: 1, 2 y 3.
      </p>
      {estado.errorAlGuardar && (
        <Alerta texto={estado.errorAlGuardar.mensaje} codigo={estado.errorAlGuardar.codigo} />
      )}
      <div className="clasificar__acciones">
        <button type="button" className="boton" disabled={estado.guardando} onClick={estado.saltar}>
          Saltar
        </button>
        <Link className="boton" to={`/revision?asignacion=${String(pregunta.id)}`}>
          Revisar con la pauta
        </Link>
      </div>
    </section>
  );
}

/** La pregunta abierta y sus botones, el vacío final, la carga o el error con reintento. */
export function ContenidoClasificacion({ estado }: { estado: ClasificacionDocenteEstado }) {
  const { vista } = estado;
  if (vista.tipo === 'cargando') return <p aria-live="polite">Cargando la pregunta…</p>;
  if (vista.tipo === 'fallida') {
    return (
      <div className="clasificar__error">
        <Alerta texto={vista.mensaje} codigo={vista.codigo} />
        <button type="button" className="boton" onClick={estado.reintentar}>
          Reintentar
        </button>
      </div>
    );
  }
  const { pregunta, quedan } = vista.datos;
  if (!pregunta) {
    return <p className="clasificar__vacio">No quedan preguntas por clasificar.</p>;
  }
  return (
    <>
      <p className="clasificar__contador">{textoQuedan(quedan)}</p>
      <PreguntaRevisada pregunta={pregunta} etiqueta="Importada" />
      <Botones pregunta={pregunta} estado={estado} />
    </>
  );
}

export function ClasificacionDocente() {
  const estado = useClasificacionDocente();
  return (
    <div className="clasificar">
      <p className="aviso aviso--exito clasificar__aviso" role="status">
        {estado.aviso}
      </p>
      <ContenidoClasificacion estado={estado} />
    </div>
  );
}
