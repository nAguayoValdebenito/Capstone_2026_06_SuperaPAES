// C05 · Generador con IA (HU-16.4, HU-17.3 y HU-18.3, CU-17): pedir un lote y ver cómo terminó.
import { SegunCarga } from '../../componentes/SegunCarga';
import { useGenerador } from '../../estado/generador';
import type { UsoIa } from '../../tipos/generador';
import { textosDeUso } from '../../utilidades/generador';
import { DetalleLote } from './DetalleLote';
import { FormularioLote } from './FormularioLote';
import { TablaLotes } from './TablaLotes';
import { TextosDelLote } from './TextosDelLote';
import './generador.css';

function TopesDeLaIa({ uso }: { uso: UsoIa }) {
  const { hoy, mes } = textosDeUso(uso);
  return (
    <ul className="generador__topes" aria-label="Uso de los topes de la IA">
      <li>{hoy}</li>
      <li>{mes}</li>
    </ul>
  );
}

export function PaginaGenerador() {
  const estado = useGenerador();
  const { temario, lotes, lote, uso, resultado } = estado;
  const { elegir, irAPagina, pedir, enviando, error } = estado;
  return (
    <section className="pagina pagina--ancha generador">
      <h1>Generador IA</h1>
      <div className="generador__encabezado">
        <p className="pagina__aviso">
          Pide un lote de preguntas de un contenido. Las válidas quedan como borrador con dificultad
          sugerida.
        </p>
        {uso && <TopesDeLaIa uso={uso} />}
      </div>
      <SegunCarga carga={temario} cargando="Cargando el temario…">
        {({ pruebas }) => (
          <>
            <div className="generador__columnas">
              <FormularioLote
                pruebas={pruebas}
                enviando={enviando}
                error={error}
                alPedir={(pedido) => void pedir(pedido)}
              />
              <DetalleLote lote={lote} resultado={resultado} pruebas={pruebas} />
            </div>
            {lote?.conTexto && lote.estado !== 'pendiente' && lote.validas > 0 && (
              <TextosDelLote key={lote.id} loteId={lote.id} pruebas={pruebas} />
            )}
            <SegunCarga carga={lotes} cargando="Cargando los lotes…">
              {(datos) => (
                <TablaLotes
                  datos={datos}
                  pruebas={pruebas}
                  elegidoId={lote?.id}
                  alElegir={elegir}
                  alCambiarPagina={irAPagina}
                />
              )}
            </SegunCarga>
          </>
        )}
      </SegunCarga>
    </section>
  );
}
