// C05 · Generador con IA (HU-16.4, HU-17.3 y HU-18.3, CU-17): pedir un lote y ver cómo terminó.
import { SegunCarga } from '../../componentes/SegunCarga';
import { useGenerador } from '../../estado/generador';
import { DetalleLote } from './DetalleLote';
import { FormularioLote } from './FormularioLote';
import { TablaLotes } from './TablaLotes';
import './generador.css';

export function PaginaGenerador() {
  const { temario, lotes, lote, elegir, irAPagina, pedir, enviando, error } = useGenerador();
  return (
    <section className="pagina pagina--ancha generador">
      <h1>Generador IA</h1>
      <p className="pagina__aviso">
        Pide un lote de preguntas de un contenido. Las válidas quedan como borrador con dificultad
        sugerida.
      </p>
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
              <DetalleLote lote={lote} pruebas={pruebas} />
            </div>
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
