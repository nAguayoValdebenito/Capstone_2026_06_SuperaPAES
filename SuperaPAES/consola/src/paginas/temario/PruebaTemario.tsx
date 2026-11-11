import type { ContenidoTemarioConsulta, PruebaTemarioConsulta } from '../../tipos/temario';

function Contenido({
  contenido: c,
  esLectura,
}: {
  contenido: ContenidoTemarioConsulta;
  esLectura: boolean;
}) {
  const curso = c.curso ?? (esLectura ? 'Sin restricción por curso' : 'Sin curso informado');
  return (
    <details className="temario__contenido">
      <summary>
        <span>{c.nombre}</span>
        <span className="temario__meta">
          {c.area.nombre} · {curso}
          {!c.activo && ' · Inactivo'}
        </span>
      </summary>
      <div className="temario__descriptores">
        <h4>Descriptores</h4>
        <p>{c.descriptores?.trim() || 'Este contenido no tiene descriptores registrados.'}</p>
        {!c.activo && <p className="pagina__aviso">Este contenido está inactivo.</p>}
      </div>
    </details>
  );
}

function Habilidades({ prueba }: { prueba: PruebaTemarioConsulta }) {
  return (
    <div className="temario__habilidades">
      <h3>Habilidades</h3>
      {prueba.habilidades.length === 0 && <p>No hay habilidades registradas para esta prueba.</p>}
      {prueba.habilidades.map((h) => (
        <details key={h.id}>
          <summary>
            {h.nombre} <span className="temario__codigo">{h.codigo}</span>
          </summary>
          <p className="temario__criterios">
            {h.criterios?.trim() || 'Sin criterios registrados.'}
          </p>
        </details>
      ))}
    </div>
  );
}

function Ejes({ prueba }: { prueba: PruebaTemarioConsulta }) {
  return (
    <div className="temario__ejes">
      <h3>Ejes y contenidos</h3>
      {prueba.ejes.length === 0 && <p>No hay ejes registrados para esta prueba.</p>}
      {prueba.ejes.map((e) => (
        <section key={e.id} className="temario__eje" aria-label={e.nombre}>
          <h4>
            {e.nombre} <span className="temario__cantidad">{e.contenidos.length} contenidos</span>
          </h4>
          {e.contenidos.length === 0 && <p>No hay contenidos registrados en este eje.</p>}
          {e.contenidos.map((c) => (
            <Contenido key={c.id} contenido={c} esLectura={prueba.codigo === 'CL'} />
          ))}
        </section>
      ))}
    </div>
  );
}

export function PruebaTemario({ prueba }: { prueba: PruebaTemarioConsulta }) {
  return (
    <article className="temario__prueba" aria-labelledby={`prueba-temario-${prueba.id}`}>
      <header className="temario__cabecera">
        <span className="temario__insignia">{prueba.codigo}</span>
        <h2 id={`prueba-temario-${prueba.id}`}>{prueba.nombre}</h2>
      </header>
      <div className="temario__columnas">
        <Ejes prueba={prueba} />
        <Habilidades prueba={prueba} />
      </div>
    </article>
  );
}
