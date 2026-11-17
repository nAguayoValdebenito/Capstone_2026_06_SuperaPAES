// Búsqueda global (Ctrl K, D5): un diálogo con combobox y lista de resultados. Busca las secciones del
// rol (rutas/secciones.ts, sin distinguir tildes) y, para el administrador, preguntas por ID o texto.
// Flechas recorren, Enter abre, Escape cierra. También maneja «?» (ayuda de atajos).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { buscarPreguntas, type PreguntaEncontrada } from '../servicios/busqueda-global';
import { seccionesDelRol } from '../rutas/secciones';
import type { RolCuentaInterna } from '../tipos';
import { codigoDePregunta } from '../utilidades/revision';
import { contiene } from '../utilidades/texto';

export interface Resultado {
  clave: string;
  grupo: 'Secciones' | 'Preguntas';
  titulo: string;
  detalle: string;
  ruta: string;
}

const MILISEGUNDOS_DE_ESPERA = 250;

/** Las secciones del rol cuyo título o grupo coincide con el texto (todas si no hay texto). */
export function seccionesQueCoinciden(rol: RolCuentaInterna, texto: string): Resultado[] {
  return seccionesDelRol(rol)
    .filter((s) => texto === '' || contiene(s.titulo, texto) || contiene(s.grupo, texto))
    .map((s) => ({
      clave: `seccion:${s.ruta}`,
      grupo: 'Secciones',
      titulo: s.titulo,
      detalle: s.grupo,
      ruta: s.ruta,
    }));
}

const dePregunta = (p: PreguntaEncontrada): Resultado => ({
  clave: `pregunta:${String(p.id)}`,
  grupo: 'Preguntas',
  titulo: `${codigoDePregunta(p.id)} · ${p.resumen}`,
  detalle: `${p.prueba.codigo} · ${p.estado.nombre}`,
  ruta: `/banco/${String(p.id)}`,
});

/** Las preguntas que encuentra la API para el texto, tras una pausa al escribir; vacío si falla. */
function usePreguntasEncontradas(texto: string, activa: boolean): Resultado[] {
  const [encontradas, cambiar] = useState<{ de: string; lista: Resultado[] }>({
    de: '',
    lista: [],
  });
  const buscado = texto.trim();
  useEffect(() => {
    if (!activa || buscado.length < 2) return;
    const control = new AbortController();
    const espera = setTimeout(() => {
      buscarPreguntas(buscado, control.signal).then(
        (lista) => {
          if (!control.signal.aborted) cambiar({ de: buscado, lista: lista.map(dePregunta) });
        },
        () => undefined,
      );
    }, MILISEGUNDOS_DE_ESPERA);
    return () => {
      clearTimeout(espera);
      control.abort();
    };
  }, [buscado, activa]);
  return activa && encontradas.de === buscado ? encontradas.lista : [];
}

/** Si el foco está donde se escribe: ahí «?» es un carácter y no abre la ayuda. */
function escribiendo(destino: EventTarget | null): boolean {
  return (
    destino instanceof HTMLElement &&
    (destino.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(destino.tagName))
  );
}

/** Ctrl K abre la búsqueda desde cualquier lugar; «?» abre la ayuda si no se está escribiendo. */
function useAtajosGlobales(
  activos: boolean,
  buscando: boolean,
  abrir: () => void,
  ayuda: () => void,
) {
  useEffect(() => {
    if (!activos) return;
    const alPresionar = (evento: KeyboardEvent) => {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
        evento.preventDefault();
        abrir();
      } else if (evento.key === '?' && !escribiendo(evento.target) && !buscando) {
        ayuda();
      }
    };
    document.addEventListener('keydown', alPresionar);
    return () => document.removeEventListener('keydown', alPresionar);
  }, [activos, buscando, abrir, ayuda]);
}

/** La lista de resultados y cuál está activa; el índice vuelve a 0 al cambiar el texto. */
function useResultados(rol: RolCuentaInterna | null, abierto: boolean) {
  const [texto, cambiarTexto] = useState('');
  const [indice, cambiarIndice] = useState(0);
  const preguntas = usePreguntasEncontradas(texto, abierto && rol === 'admin');
  const resultados = useMemo(
    () => (rol ? [...seccionesQueCoinciden(rol, texto), ...preguntas] : []),
    [rol, texto, preguntas],
  );
  const reiniciar = useCallback(() => {
    cambiarTexto('');
    cambiarIndice(0);
  }, []);
  const escribir = useCallback((nuevo: string) => {
    cambiarTexto(nuevo);
    cambiarIndice(0);
  }, []);
  const mover = useCallback(
    (paso: number) => {
      cambiarIndice((actual) =>
        resultados.length === 0 ? 0 : (actual + paso + resultados.length) % resultados.length,
      );
    },
    [resultados.length],
  );
  return { texto, indice, resultados, reiniciar, escribir, mover };
}

export function useBusquedaGlobal(rol: RolCuentaInterna | null) {
  const navegar = useNavigate();
  const [abierto, cambiarAbierto] = useState(false);
  const [ayuda, cambiarAyuda] = useState(false);
  const { texto, indice, resultados, reiniciar, escribir, mover } = useResultados(rol, abierto);

  const abrir = useCallback(() => {
    reiniciar();
    cambiarAyuda(false);
    cambiarAbierto(true);
  }, [reiniciar]);
  const abrirAyuda = useCallback(() => cambiarAyuda(true), []);
  const elegirResultado = useCallback(
    (resultado: Resultado | undefined) => {
      if (!resultado) return;
      cambiarAbierto(false);
      void navegar(resultado.ruta);
    },
    [navegar],
  );
  useAtajosGlobales(rol !== null, abierto, abrir, abrirAyuda);

  return {
    abierto,
    ayuda,
    texto,
    indice,
    resultados,
    abrir,
    cerrar: () => cambiarAbierto(false),
    cerrarAyuda: () => cambiarAyuda(false),
    escribir,
    mover,
    elegir: () => elegirResultado(resultados[indice]),
    elegirResultado,
  };
}

export type BusquedaGlobal = ReturnType<typeof useBusquedaGlobal>;
