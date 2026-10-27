// Banco de preguntas (C02, HU-11): carga las opciones de los filtros una vez y la página del banco cada
// vez que cambian los filtros o la página. Los filtros y la página viven en la URL (?prueba=2&pagina=3),
// así se mantienen al recargar o al volver. Elegir otra prueba limpia el eje, el contenido y la
// habilidad, y otro eje limpia el contenido; cambiar un filtro vuelve a la primera página. Cancela la
// carga al desmontar.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { consultaDelBanco, listarBanco, obtenerFiltrosBanco } from '../servicios/preguntas';
import type {
  FiltrosBanco,
  OpcionesFiltrosBanco,
  OrigenPregunta,
  PaginaDelBanco,
  Paginacion,
  PruebaTemario,
} from '../tipos';
import { mensajeDeError } from './usuarios-internos';

export type CargaBanco =
  | { tipo: 'cargando' }
  | { tipo: 'lista'; pagina: PaginaDelBanco }
  | { tipo: 'fallida'; codigo: string; mensaje: string };

export type CargaOpciones =
  | { tipo: 'cargando' }
  | { tipo: 'lista'; opciones: OpcionesFiltrosBanco }
  | { tipo: 'fallida'; codigo: string; mensaje: string };

/** Filtros que dependen de otro: al cambiar el de la izquierda se limpian los de la derecha. */
const DEPENDIENTES: Partial<Record<keyof FiltrosBanco, (keyof FiltrosBanco)[]>> = {
  prueba: ['eje', 'contenido', 'habilidad'],
  eje: ['contenido'],
};

/** Cambia un filtro (undefined lo quita) y limpia los que dependen de él. */
export function conFiltro<C extends keyof FiltrosBanco>(
  filtros: FiltrosBanco,
  campo: C,
  valor: FiltrosBanco[C] | undefined,
): FiltrosBanco {
  const siguiente: FiltrosBanco = { ...filtros };
  if (valor === undefined) delete siguiente[campo];
  else siguiente[campo] = valor;
  for (const dependiente of DEPENDIENTES[campo] ?? []) delete siguiente[dependiente];
  return siguiente;
}

const IDS = ['prueba', 'eje', 'contenido', 'habilidad'] as const;
const CODIGOS = ['estado', 'dificultad'] as const;
const ORIGENES: readonly string[] = ['manual', 'importacion', 'ia'] satisfies OrigenPregunta[];

const entero = (texto: string | null) =>
  texto !== null && /^[1-9]\d{0,9}$/.test(texto) ? Number(texto) : undefined;

/** Filtros y página guardados en la URL. Lo que no se entiende se ignora: la API valida el resto. */
export function leerBusqueda(busqueda: URLSearchParams): { filtros: FiltrosBanco; pagina: number } {
  const filtros: FiltrosBanco = {};
  for (const campo of IDS) {
    const valor = entero(busqueda.get(campo));
    if (valor !== undefined) filtros[campo] = valor;
  }
  for (const campo of CODIGOS) {
    const valor = busqueda.get(campo);
    if (valor !== null && /^[a-z_]{1,15}$/.test(valor)) filtros[campo] = valor;
  }
  const origen = busqueda.get('origen');
  if (origen !== null && ORIGENES.includes(origen)) filtros.origen = origen as OrigenPregunta;
  return { filtros, pagina: entero(busqueda.get('pagina')) ?? 1 };
}

/** La URL usa los mismos parámetros que la API, sin la página 1. */
export function busquedaDe(filtros: FiltrosBanco, pagina: number): URLSearchParams {
  return new URLSearchParams(consultaDelBanco(filtros, pagina));
}

/** Ejes que se pueden elegir: los de la prueba elegida (sin prueba, ninguno). */
export function ejesDisponibles(pruebas: readonly PruebaTemario[], filtros: FiltrosBanco) {
  return pruebas.find((p) => p.id === filtros.prueba)?.ejes ?? [];
}

/** Contenidos que se pueden elegir: los del eje elegido (sin eje, ninguno). */
export function contenidosDisponibles(pruebas: readonly PruebaTemario[], filtros: FiltrosBanco) {
  return ejesDisponibles(pruebas, filtros).find((e) => e.id === filtros.eje)?.contenidos ?? [];
}

/** Habilidades que se pueden elegir: las de la prueba elegida (sin prueba, ninguna). */
export function habilidadesDisponibles(pruebas: readonly PruebaTemario[], filtros: FiltrosBanco) {
  return pruebas.find((p) => p.id === filtros.prueba)?.habilidades ?? [];
}

export function totalDePaginas({ total, porPagina }: Paginacion): number {
  return porPagina > 0 ? Math.max(1, Math.ceil(total / porPagina)) : 1;
}

function useOpciones(): CargaOpciones {
  const [carga, setCarga] = useState<CargaOpciones>({ tipo: 'cargando' });
  useEffect(() => {
    const control = new AbortController();
    obtenerFiltrosBanco(control.signal).then(
      (opciones) => setCarga({ tipo: 'lista', opciones }),
      (error: unknown) => {
        if (!control.signal.aborted) setCarga({ tipo: 'fallida', ...mensajeDeError(error) });
      },
    );
    return () => control.abort();
  }, []);
  return carga;
}

const claveDe = (filtros: FiltrosBanco, pagina: number) => JSON.stringify([filtros, pagina]);

/** Mientras la respuesta guardada sea de otros filtros u otra página, la lista está cargando. */
function usePagina(filtros: FiltrosBanco, pagina: number): CargaBanco {
  const [resultado, setResultado] = useState<{ clave: string; carga: CargaBanco } | null>(null);
  useEffect(() => {
    const control = new AbortController();
    const clave = claveDe(filtros, pagina);
    listarBanco(filtros, pagina, control.signal).then(
      (respuesta) => setResultado({ clave, carga: { tipo: 'lista', pagina: respuesta } }),
      (error: unknown) => {
        if (control.signal.aborted) return;
        setResultado({ clave, carga: { tipo: 'fallida', ...mensajeDeError(error) } });
      },
    );
    return () => control.abort();
  }, [filtros, pagina]);
  return resultado?.clave === claveDe(filtros, pagina) ? resultado.carga : { tipo: 'cargando' };
}

export function useBanco() {
  const [busqueda, setBusqueda] = useSearchParams();
  // Mismos filtros mientras la URL no cambie: así la página no se vuelve a pedir en cada render.
  const texto = busqueda.toString();
  const { filtros, pagina } = useMemo(() => leerBusqueda(new URLSearchParams(texto)), [texto]);
  const opciones = useOpciones();
  const carga = usePagina(filtros, pagina);

  const cambiarFiltro = useCallback(
    <C extends keyof FiltrosBanco>(campo: C, valor: FiltrosBanco[C] | undefined) => {
      setBusqueda((actual) => busquedaDe(conFiltro(leerBusqueda(actual).filtros, campo, valor), 1));
    },
    [setBusqueda],
  );

  const limpiarFiltros = useCallback(() => setBusqueda(busquedaDe({}, 1)), [setBusqueda]);

  const irAPagina = useCallback(
    (siguiente: number) =>
      setBusqueda((actual) => busquedaDe(leerBusqueda(actual).filtros, siguiente)),
    [setBusqueda],
  );

  return { opciones, carga, filtros, cambiarFiltro, limpiarFiltros, irAPagina };
}
