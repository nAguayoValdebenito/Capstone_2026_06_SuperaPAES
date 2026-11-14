// Clasificar dificultad (D03, HU-25.2, CU-19a, RF-G12): la siguiente pregunta importada que el docente
// tiene asignada como revisor, el clic (o las teclas 1, 2 y 3) que entrega su revisión con esa
// dificultad y pasa a la siguiente que devuelve la API, saltar y reintentar. Mientras guarda no se
// guarda otra vez (un clic y una tecla a la vez cuentan una sola). Al cargar otra pregunta el foco
// vuelve al primer botón. A ciegas: la API no entrega la dificultad sugerida.
import { type RefObject, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { clasificarDificultad, siguienteAClasificar } from '../servicios/revision';
import type { Opcion, PreguntaAClasificar, SiguienteAClasificar } from '../tipos';
import { type Carga, useCarga } from './carga';
import { mensajeDeError } from './usuarios-internos';

/** Las teclas de los atajos, en el orden de las dificultades (fácil, media, difícil). */
export const TECLAS_DIFICULTAD = ['1', '2', '3'] as const;

/** Lo que trae un evento de teclado para decidir el atajo. */
export interface TeclaPulsada {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  target: EventTarget | null;
}

const ESCRIBE_TEXTO = 'input, textarea, select, [contenteditable="true"]';

/**
 * La dificultad del atajo: 1, 2 o 3 sin Ctrl, Alt ni Meta, y nunca mientras se escribe en un campo;
 * null si la tecla no es un atajo.
 */
export function dificultadDeTecla(tecla: TeclaPulsada, dificultades: readonly Opcion[]) {
  if (tecla.ctrlKey || tecla.altKey || tecla.metaKey) return null;
  if (tecla.target instanceof Element && tecla.target.closest(ESCRIBE_TEXTO)) return null;
  const posicion = TECLAS_DIFICULTAD.indexOf(tecla.key as (typeof TECLAS_DIFICULTAD)[number]);
  return posicion === -1 ? null : (dificultades[posicion] ?? null);
}

/** Cuántas quedan, en singular o plural. */
export const textoQuedan = (quedan: number) =>
  quedan === 1 ? 'Queda 1 por clasificar' : `Quedan ${String(quedan)} por clasificar`;

/**
 * Qué se pide a la API: la primera (despuesDe null) o la que sigue a una asignación; `vuelta` vuelve a
 * pedir lo mismo (reintentar).
 */
interface Pedido {
  despuesDe: number | null;
  vuelta: number;
}

type Cargar = (senal: AbortSignal) => Promise<SiguienteAClasificar>;

/** La pregunta abierta: la que cargó el pedido o la siguiente que devolvió la última clasificación. */
function useVista() {
  const [pedido, setPedido] = useState<Pedido>({ despuesDe: null, vuelta: 0 });
  const cargar = useMemo<Cargar>(
    () => (senal) => siguienteAClasificar(pedido.despuesDe, senal),
    [pedido],
  );
  const carga = useCarga(cargar);
  const [tras, setTras] = useState<{ de: Cargar; datos: SiguienteAClasificar } | null>(null);
  const vista: Carga<SiguienteAClasificar> =
    tras?.de === cargar ? { tipo: 'lista', datos: tras.datos } : carga;
  return {
    vista,
    pedir: (despuesDe: number | null) =>
      setPedido((actual) => ({ despuesDe, vuelta: actual.vuelta + 1 })),
    reintentar: () => setPedido((actual) => ({ ...actual, vuelta: actual.vuelta + 1 })),
    mostrar: (datos: SiguienteAClasificar) => setTras({ de: cargar, datos }),
  };
}

/** Las teclas 1, 2 y 3 clasifican la pregunta abierta mientras la sección está abierta. */
function useAtajos(pregunta: PreguntaAClasificar | null, clasificar: (d: Opcion) => void) {
  const alPresionarTecla = useEffectEvent((evento: KeyboardEvent) => {
    if (!pregunta) return;
    const dificultad = dificultadDeTecla(evento, pregunta.dificultades);
    if (!dificultad) return;
    evento.preventDefault();
    clasificar(dificultad);
  });
  useEffect(() => {
    const escuchar = (evento: KeyboardEvent) => alPresionarTecla(evento);
    document.addEventListener('keydown', escuchar);
    return () => document.removeEventListener('keydown', escuchar);
  }, []);
}

/** Cada pregunta nueva empieza con el foco en el primer botón (Fácil). */
function useFocoAlCambiar(
  id: number | undefined,
  primerBoton: RefObject<HTMLButtonElement | null>,
) {
  useEffect(() => {
    if (id !== undefined) primerBoton.current?.focus();
  }, [id, primerBoton]);
}

/**
 * Guardar la dificultad de la pregunta abierta: mientras guarda no guarda otra vez (`ocupado` lo sabe al
 * tiro, sin esperar a React); al guardar muestra la siguiente y el aviso; si falla, el error.
 */
function useGuardado(
  pregunta: PreguntaAClasificar | null,
  mostrar: (datos: SiguienteAClasificar) => void,
) {
  const [guardando, setGuardando] = useState(false);
  const ocupado = useRef(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorAlGuardar, setErrorAlGuardar] = useState<{ codigo: string; mensaje: string } | null>(
    null,
  );
  const limpiar = () => {
    setAviso(null);
    setErrorAlGuardar(null);
  };
  const clasificar = (dificultad: Opcion) => {
    if (!pregunta || ocupado.current) return;
    ocupado.current = true;
    setGuardando(true);
    limpiar();
    clasificarDificultad(pregunta.id, dificultad.codigo)
      .then(
        (clasificada) => {
          mostrar(clasificada.siguiente);
          setAviso(`Pregunta ${String(pregunta.preguntaId)} guardada como ${dificultad.nombre}.`);
        },
        (error: unknown) => setErrorAlGuardar(mensajeDeError(error)),
      )
      .finally(() => {
        ocupado.current = false;
        setGuardando(false);
      });
  };
  return { guardando, ocupado, aviso, errorAlGuardar, limpiar, clasificar };
}

export function useClasificacionDocente() {
  const { vista, pedir, reintentar, mostrar } = useVista();
  const pregunta = vista.tipo === 'lista' ? vista.datos.pregunta : null;
  const { ocupado, limpiar, ...guardado } = useGuardado(pregunta, mostrar);
  const primerBoton = useRef<HTMLButtonElement>(null);
  useAtajos(pregunta, guardado.clasificar);
  useFocoAlCambiar(pregunta?.id, primerBoton);

  return {
    vista,
    ...guardado,
    primerBoton,
    saltar: () => {
      if (!pregunta || ocupado.current) return;
      limpiar();
      pedir(pregunta.id);
    },
    reintentar: () => {
      limpiar();
      reintentar();
    },
  };
}

export type ClasificacionDocenteEstado = ReturnType<typeof useClasificacionDocente>;
