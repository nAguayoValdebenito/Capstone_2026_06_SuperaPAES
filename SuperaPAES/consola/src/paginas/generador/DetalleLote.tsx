// El lote elegido en C05: avance mientras se procesa y, al cerrar, las válidas y las descartadas con su
// motivo (CU-17 paso 7, HU-17.3). Las preguntas se revisan en el banco, con sus textos de lectura.
import { Link } from 'react-router';
import type { PruebaTemario } from '../../tipos';
import type { Lote } from '../../tipos/generador';
import {
  enlaceAlBanco,
  ESTADOS_LOTE,
  motivosLegibles,
  notaDeCierre,
  ubicarContenido,
} from '../../utilidades/generador';

function Motivos({ lote }: { lote: Lote }) {
  const motivos = motivosLegibles(lote);
  if (motivos.length === 0) return null;
  return (
    <>
      <h3>Motivos de descarte</h3>
      <ul className="generador__motivos">
        {motivos.map(({ texto, cantidad }) => (
          <li key={texto}>
            {texto}: <strong>{cantidad}</strong>
          </li>
        ))}
      </ul>
    </>
  );
}

function Avance({ lote }: { lote: Lote }) {
  return (
    <>
      <p>
        Procesadas {lote.procesadas} de {lote.cantidad}. Puedes salir de esta página: el lote sigue
        en proceso.
      </p>
      <progress value={lote.procesadas} max={lote.cantidad} aria-label="Avance del lote" />
    </>
  );
}

export function DetalleLote({
  lote,
  pruebas,
}: {
  lote: Lote | null;
  pruebas: readonly PruebaTemario[];
}) {
  if (!lote) {
    return (
      <section className="panel panel--ancho" aria-label="Resultado del lote">
        <h2>Resultado del lote</h2>
        <p>Todavía no hay lotes. Pide el primero con el formulario.</p>
      </section>
    );
  }
  const nota = notaDeCierre(lote);
  const nombre = ubicarContenido(pruebas, lote.contenidoId)?.contenido.nombre ?? 'Contenido';
  return (
    <section className="panel panel--ancho" aria-label="Resultado del lote" aria-live="polite">
      <div className="generador__titulo">
        <h2>
          Lote {lote.id} · {nombre}
        </h2>
        <span className={`etiqueta etiqueta--${lote.estado}`}>{ESTADOS_LOTE[lote.estado]}</span>
      </div>
      {lote.estado === 'pendiente' && <Avance lote={lote} />}
      <p>
        Válidas: <strong>{lote.validas}</strong> · Descartadas: <strong>{lote.descartadas}</strong>{' '}
        · Modelo: {lote.modelo}
        {lote.conTexto && ' · Con texto de lectura'}
      </p>
      {nota && <p className="estado__error">{nota}</p>}
      <Motivos lote={lote} />
      {lote.validas > 0 && (
        <Link to={enlaceAlBanco(pruebas, lote)}>Ver en el banco de preguntas</Link>
      )}
    </section>
  );
}
