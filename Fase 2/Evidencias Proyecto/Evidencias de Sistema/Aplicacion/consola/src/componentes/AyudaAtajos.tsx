// Ayuda de atajos de teclado de la consola (tecla «?»). Lista solo los atajos que existen hoy.
import { useDialogoModal } from '../estado/dialogo-confirmacion';

const ATAJOS: readonly { teclas: readonly string[]; texto: string }[] = [
  { teclas: ['Ctrl', 'K'], texto: 'Buscar secciones y preguntas' },
  { teclas: ['?'], texto: 'Ver esta lista de atajos' },
  { teclas: ['Esc'], texto: 'Cerrar un diálogo, la búsqueda o el menú' },
  { teclas: ['S', 'N'], texto: 'Revisión docente: responder Sí o No al criterio enfocado' },
  { teclas: ['1', '2', '3'], texto: 'Clasificar dificultad: Fácil, Media o Difícil' },
  {
    teclas: ['←', '→'],
    texto: 'Pestañas: cambiar de pestaña (Inicio y Fin: la primera y la última)',
  },
];

export function AyudaAtajos({ abierta, alCerrar }: { abierta: boolean; alCerrar: () => void }) {
  const dialogo = useDialogoModal(abierta, alCerrar);
  return (
    <dialog ref={dialogo} className="dialogo" aria-labelledby="ayuda-atajos-titulo">
      {abierta && (
        <div className="dialogo__cuerpo">
          <h2 id="ayuda-atajos-titulo">Atajos de teclado</h2>
          <dl className="atajos">
            {ATAJOS.map(({ teclas, texto }) => (
              <div key={texto} className="atajos__fila">
                <dt>
                  {teclas.map((tecla) => (
                    <kbd key={tecla}>{tecla}</kbd>
                  ))}
                </dt>
                <dd>{texto}</dd>
              </div>
            ))}
          </dl>
          <div className="dialogo__acciones">
            <button type="button" className="boton" onClick={alCerrar} autoFocus>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
