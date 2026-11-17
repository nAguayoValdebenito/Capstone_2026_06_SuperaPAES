// Suscripciones (C16, HU-56): el resumen se carga una vez; la lista, cada vez que cambian los filtros o
// la página; la línea de tiempo, al elegir una suscripción, y la bandeja de avisos con error, al abrirla.
// Todo vive en la URL (?estado=activa&ver=12&avisos=1), así se mantiene al recargar o al volver. Cambiar
// un filtro vuelve a la primera página.
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { consultaDeListado } from '../servicios/paginacion';
import {
  listarAvisosConError,
  listarSuscripciones,
  obtenerResumenSuscripciones,
  obtenerSuscripcion,
} from '../servicios/suscripciones';
import type { FiltrosSuscripciones } from '../tipos/suscripciones';
import { entero } from '../utilidades/busqueda';
import { useCarga } from './carga';

export interface VistaSuscripciones {
  filtros: FiltrosSuscripciones;
  pagina: number;
  /** La suscripción cuya línea de tiempo se ve. */
  ver?: number;
  /** La bandeja de avisos con error abierta, en su página. */
  avisos?: number;
}

const fecha = (texto: string | null) =>
  texto !== null && /^\d{4}-\d{2}-\d{2}$/.test(texto) ? texto : undefined;

function leerFiltros(busqueda: URLSearchParams): FiltrosSuscripciones {
  const filtros: FiltrosSuscripciones = {};
  const estado = busqueda.get('estado');
  if (estado !== null && /^[a-z_]{1,10}$/.test(estado)) filtros.estado = estado;
  const plan = entero(busqueda.get('plan'));
  if (plan !== undefined) filtros.plan = plan;
  for (const campo of ['desde', 'hasta'] as const) {
    const valor = fecha(busqueda.get(campo));
    if (valor !== undefined) filtros[campo] = valor;
  }
  const correo = busqueda.get('correo')?.trim();
  if (correo) filtros.correo = correo.slice(0, 150);
  return filtros;
}

/** Lo que dice la URL. Lo que no se entiende se ignora: la API valida el resto. */
export function leerVista(busqueda: URLSearchParams): VistaSuscripciones {
  const vista: VistaSuscripciones = {
    filtros: leerFiltros(busqueda),
    pagina: entero(busqueda.get('pagina')) ?? 1,
  };
  const ver = entero(busqueda.get('ver'));
  if (ver !== undefined) vista.ver = ver;
  const avisos = entero(busqueda.get('avisos'));
  if (avisos !== undefined) vista.avisos = avisos;
  return vista;
}

/** La URL de una vista: los filtros como en la API, sin la página 1. */
export function busquedaDe({ filtros, pagina, ver, avisos }: VistaSuscripciones): URLSearchParams {
  const busqueda = new URLSearchParams(consultaDeListado(filtros, pagina));
  if (ver !== undefined) busqueda.set('ver', String(ver));
  if (avisos !== undefined) busqueda.set('avisos', String(avisos));
  return busqueda;
}

/** Cambia un filtro (vacío lo quita) y vuelve a la primera página. */
export function conFiltro<C extends keyof FiltrosSuscripciones>(
  vista: VistaSuscripciones,
  campo: C,
  valor: FiltrosSuscripciones[C] | undefined,
): VistaSuscripciones {
  const filtros: FiltrosSuscripciones = { ...vista.filtros };
  if (valor === undefined || valor === '') delete filtros[campo];
  else filtros[campo] = valor;
  return { ...vista, filtros, pagina: 1 };
}

/**
 * La lista depende solo de su consulta: elegir otra suscripción o abrir la bandeja cambia la URL, pero
 * no vuelve a pedir la lista.
 */
function useLista({ filtros, pagina }: VistaSuscripciones) {
  const consulta = consultaDeListado(filtros, pagina);
  return useCarga(
    useMemo(() => {
      const pedida = leerVista(new URLSearchParams(consulta));
      return (s: AbortSignal) => listarSuscripciones(pedida.filtros, pedida.pagina, s);
    }, [consulta]),
  );
}

function useCargas(vista: VistaSuscripciones) {
  const { ver, avisos } = vista;
  const resumen = useCarga(obtenerResumenSuscripciones);
  const lista = useLista(vista);
  const detalle = useCarga(
    useMemo(
      () => (ver === undefined ? null : (s: AbortSignal) => obtenerSuscripcion(ver, s)),
      [ver],
    ),
  );
  const bandeja = useCarga(
    useMemo(
      () => (avisos === undefined ? null : (s: AbortSignal) => listarAvisosConError(avisos, s)),
      [avisos],
    ),
  );
  return { resumen, lista, detalle, bandeja };
}

export function useSuscripciones() {
  const [busqueda, setBusqueda] = useSearchParams();
  // Misma vista mientras la URL no cambie: así no se vuelve a pedir en cada render.
  const texto = busqueda.toString();
  const vista = useMemo(() => leerVista(new URLSearchParams(texto)), [texto]);
  const cargas = useCargas(vista);

  // Un filtro reemplaza la entrada del historial: escribir una fecha no deja un paso por cada cifra.
  const cambiar = useCallback(
    (cambio: (actual: VistaSuscripciones) => VistaSuscripciones, reemplazar = false) =>
      setBusqueda((actual) => busquedaDe(cambio(leerVista(actual))), { replace: reemplazar }),
    [setBusqueda],
  );
  const acciones = useMemo(
    () => ({
      cambiarFiltro: <C extends keyof FiltrosSuscripciones>(
        campo: C,
        valor: FiltrosSuscripciones[C] | undefined,
      ) => cambiar((actual) => conFiltro(actual, campo, valor), true),
      limpiarFiltros: () => cambiar((actual) => ({ ...actual, filtros: {}, pagina: 1 })),
      irAPagina: (pagina: number) => cambiar((actual) => ({ ...actual, pagina })),
      ver: (id: number) => cambiar((actual) => ({ ...actual, ver: id })),
      alternarAvisos: () =>
        cambiar(({ avisos, ...actual }) =>
          avisos === undefined ? { ...actual, avisos: 1 } : actual,
        ),
      irAPaginaDeAvisos: (pagina: number) => cambiar((actual) => ({ ...actual, avisos: pagina })),
    }),
    [cambiar],
  );
  return { vista, ...cargas, acciones };
}

export type AccionesSuscripciones = ReturnType<typeof useSuscripciones>['acciones'];
