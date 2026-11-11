// C07: consulta de los datos cargados (HU-10); la edición de HU-14 sigue fuera del alcance.
import { SegunCarga } from '../../componentes/SegunCarga';
import { contarTemario, filtrarTemario, useTemario } from '../../estado/temario';
import type { ConsultaTemario } from '../../tipos/temario';
import { FiltrosTemario } from './FiltrosTemario';
import { PruebaTemario } from './PruebaTemario';
import './temario.css';

function Areas({ datos }: { datos: ConsultaTemario }) {
  return (
    <details className="temario__areas">
      <summary>{`Áreas de especialidad (${datos.areas.length})`}</summary>
      {datos.areas.length > 0 ? (
        <ul>
          {datos.areas.map((a) => (
            <li key={a.id}>{a.nombre}</li>
          ))}
        </ul>
      ) : (
        <p>No hay áreas registradas.</p>
      )}
    </details>
  );
}

function Vacio({ sinDatos }: { sinDatos: boolean }) {
  return (
    <div className="temario__vacio">
      <h2>{sinDatos ? 'Sin temario cargado' : 'No hay coincidencias'}</h2>
      <p>
        {sinDatos
          ? 'Todavía no hay pruebas registradas en la base de datos.'
          : 'Prueba con otra búsqueda o limpia los filtros.'}
      </p>
    </div>
  );
}

function Resultados({
  datos,
  estado,
}: {
  datos: ConsultaTemario;
  estado: ReturnType<typeof useTemario>;
}) {
  const pruebas = filtrarTemario(datos.pruebas, estado.filtros);
  const cantidades = contarTemario(pruebas);
  return (
    <>
      <FiltrosTemario
        datos={datos}
        filtros={estado.filtros}
        alFiltrar={estado.filtrar}
        alLimpiar={estado.limpiar}
      />
      <p className="temario__resumen" role="status">
        {`${cantidades.pruebas} pruebas · ${cantidades.ejes} ejes · ${cantidades.contenidos} contenidos`}
      </p>
      {pruebas.map((p) => (
        <PruebaTemario key={p.id} prueba={p} />
      ))}
      {pruebas.length === 0 && <Vacio sinDatos={datos.pruebas.length === 0} />}
      <Areas datos={datos} />
    </>
  );
}

export function PaginaTemario() {
  const estado = useTemario();
  return (
    <section className="pagina pagina--ancha temario">
      <header className="temario__titulo">
        <div>
          <h1>Temario</h1>
          <p>
            Consulta las pruebas, sus ejes, contenidos y habilidades. Abre un contenido para ver sus
            descriptores, área y curso.
          </p>
        </div>
        <button
          className="boton"
          type="button"
          onClick={estado.reintentar}
          disabled={estado.carga.tipo === 'cargando'}
        >
          Actualizar
        </button>
      </header>
      <SegunCarga carga={estado.carga} cargando="Cargando el temario…">
        {(datos) => <Resultados datos={datos} estado={estado} />}
      </SegunCarga>
      {estado.carga.tipo === 'fallida' && (
        <button className="boton" type="button" onClick={estado.reintentar}>
          Reintentar
        </button>
      )}
    </section>
  );
}
