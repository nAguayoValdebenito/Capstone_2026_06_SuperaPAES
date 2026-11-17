// En el teléfono las tablas se apilan y cada dato muestra el nombre de su columna (CSS con
// attr(data-th)). Este hook copia una sola vez para toda la consola el texto de cada cabecera a las
// celdas de su columna, también cuando una página dibuja o cambia filas. Solo agrega data-th, que
// React no maneja, así que no choca con lo que dibuja cada página.
import { useEffect, type RefObject } from 'react';

function etiquetarTabla(tabla: HTMLTableElement) {
  const cabeceras = [...tabla.querySelectorAll('thead th')].map((th) => th.textContent.trim());
  if (cabeceras.length === 0) return;
  for (const fila of tabla.querySelectorAll('tbody tr')) {
    [...fila.children].forEach((celda, indice) => {
      const etiqueta = cabeceras[indice] ?? '';
      if (celda.getAttribute('data-th') !== etiqueta) celda.setAttribute('data-th', etiqueta);
    });
  }
}

export function useEtiquetasDeTabla(raiz: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const elemento = raiz.current;
    if (!elemento || typeof MutationObserver === 'undefined') return;
    let pendiente = 0;
    const etiquetar = () => {
      pendiente = 0;
      elemento.querySelectorAll('table').forEach(etiquetarTabla);
    };
    const observador = new MutationObserver(() => {
      if (!pendiente) pendiente = requestAnimationFrame(etiquetar);
    });
    observador.observe(elemento, { childList: true, subtree: true, characterData: true });
    etiquetar();
    return () => {
      observador.disconnect();
      if (pendiente) cancelAnimationFrame(pendiente);
    };
  }, [raiz]);
}
