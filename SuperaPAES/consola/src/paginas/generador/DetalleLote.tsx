// El lote elegido en C05: avance mientras se procesa y, al cerrar, cada pregunta con su resultado
// (CU-17 paso 7, HU-17.3).
import { Link } from 'react-router';
import { SegunCarga } from '../../componentes/SegunCarga';
import type { Carga } from '../../estado/carga';
import type { PruebaTemario } from '../../tipos';
import type { Lote, ResultadoLote } from '../../tipos/generador';
import {
  enlaceAlBanco,
  ESTADOS_LOTE,
  faltaDetalle,
  motivosLegibles,
  notaDeCierre,
  ubicarContenido,
} from '../../utilidades/generador';
import { ResultadoDelLote } from './ResultadoDelLote';

/** Los motivos agrupados: los lotes antiguos no tienen el detalle, y un texto rechazado no es una fila. */
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

function Resultado({ lote, carga }: { lote: Lote; carga: Carga<ResultadoLote> }) {
  if (lote.estado === 'pendiente') return <Avance lote={lote} />;
  return (
    <SegunCarga carga={carga} cargando="Cargando el resultado…">
      {(resultado) => (
        <>
          <ResultadoDelLote resultado={resultado} />
          {faltaDetalle(lote, resultado) && <Motivos lote={lote} />}
        </>
      )}
    </SegunCarga>
  );
}

export function DetalleLote({
  lote,
  resultado,
  pruebas,
}: {
  lote: Lote | null;
  resultado: Carga<ResultadoLote>;
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
      <p>
        Válidas: <strong>{lote.validas}</strong> · Descartadas: <strong>{lote.descartadas}</strong>{' '}
        · Modelo: {lote.modelo}
        {lote.conTexto && ' · Con texto de lectura'}
      </p>
      {nota && <p className="estado__error">{nota}</p>}
      <Resultado lote={lote} carga={resultado} />
      {lote.validas > 0 && (
        <Link to={enlaceAlBanco(pruebas, lote)}>Ver en el banco de preguntas</Link>
      )}
    </section>
  );
}
