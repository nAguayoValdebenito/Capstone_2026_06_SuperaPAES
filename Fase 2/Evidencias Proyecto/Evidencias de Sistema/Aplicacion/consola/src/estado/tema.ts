// Tema claro u oscuro de la consola (D4): sigue la preferencia del sistema hasta que la persona elige
// otro con el botón de la barra superior, y se recuerda en este navegador. La elección va en
// data-tema de <html>; sin elección, el CSS usa prefers-color-scheme.
import { useCallback, useEffect, useState } from 'react';

export type Tema = 'claro' | 'oscuro';

const CLAVE = 'consola-tema';
const CONSULTA_OSCURO = '(prefers-color-scheme: dark)';

/** La elección guardada, o null si no hay o el navegador no deja leerla. */
export function temaGuardado(): Tema | null {
  try {
    const valor = localStorage.getItem(CLAVE);
    return valor === 'claro' || valor === 'oscuro' ? valor : null;
  } catch {
    return null;
  }
}

function guardarTema(tema: Tema) {
  try {
    localStorage.setItem(CLAVE, tema);
  } catch {
    // Sin almacenamiento (ventana privada o bloqueado): la elección dura hasta recargar.
  }
}

function sistemaEsOscuro(): boolean {
  return typeof matchMedia === 'function' && matchMedia(CONSULTA_OSCURO).matches;
}

/** Pone en <html> el tema guardado. Se llama antes de dibujar, para no mostrar el otro un instante. */
export function aplicarTemaGuardado() {
  const tema = temaGuardado();
  if (tema) document.documentElement.dataset.tema = tema;
}

/** El tema que se ve y la acción para pasar al otro. */
export function useTema(): { tema: Tema; alternar: () => void } {
  const [tema, cambiarTema] = useState<Tema>(
    () => temaGuardado() ?? (sistemaEsOscuro() ? 'oscuro' : 'claro'),
  );

  // Mientras no haya elección, sigue los cambios del sistema.
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const consulta = matchMedia(CONSULTA_OSCURO);
    const alCambiar = () => {
      if (!temaGuardado()) cambiarTema(consulta.matches ? 'oscuro' : 'claro');
    };
    consulta.addEventListener('change', alCambiar);
    return () => consulta.removeEventListener('change', alCambiar);
  }, []);

  const alternar = useCallback(() => {
    cambiarTema((actual) => {
      const nuevo: Tema = actual === 'oscuro' ? 'claro' : 'oscuro';
      document.documentElement.dataset.tema = nuevo;
      guardarTema(nuevo);
      return nuevo;
    });
  }, []);

  return { tema, alternar };
}
