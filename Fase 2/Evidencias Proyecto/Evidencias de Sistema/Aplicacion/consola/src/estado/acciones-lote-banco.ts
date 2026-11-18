// Acciones en lote del banco (C02), para llenar la app de preguntas y probarla: «Enviar a revisión» y
// «Aceptar y publicar» procesan 10 preguntas por clic con los filtros del banco, en todo el banco (no solo
// en la página); el clic siguiente toma las 10 siguientes, hasta que no quede ninguna. Los botones
// siempre están: muestran cuántas quedan (hasta 10) y, sin ninguna, quedan deshabilitados. Tras cada
// clic el aviso dice cuántas se hicieron y por qué no las demás, y se recargan el banco y la cuenta.
import { useEffect, useState } from 'react';
import { contarLote, publicarSinRevision } from '../servicios/preguntas';
import { enviarLoteARevision } from '../servicios/revision';
import type { ConteoDelLote, FiltrosBanco, PreguntaNoProcesada } from '../tipos';
import type { AvisoDelBanco } from './acciones-banco';
import { mensajeDeError } from './usuarios-internos';

/** Lo que se procesa en un clic (la API hace lo mismo). */
export const MAXIMO_LOTE = 10;

export type AccionEnLote = 'enviar' | 'publicar';

/** Cuántas procesa el próximo clic: las que quedan, hasta 10. */
export const delProximoClic = (quedan: number) => Math.min(quedan, MAXIMO_LOTE);

const enPlural = (cantidad: number, una: string, varias: string) =>
  `${String(cantidad)} ${cantidad === 1 ? una : varias}`;

/** Los motivos de las que no se pudo, hasta tres (las demás se cuentan). */
function motivos(noHechas: readonly PreguntaNoProcesada[]): string {
  if (noHechas.length === 0) return '';
  const detalle = noHechas
    .slice(0, 3)
    .map(({ id, motivo }) => `la ${String(id)}: ${motivo}`)
    .join(' ');
  const resto = noHechas.length > 3 ? ` (y ${String(noHechas.length - 3)} más)` : '';
  return ` No se pudo con ${detalle}${resto}`;
}

const HECHO: Record<AccionEnLote, [string, string, string]> = {
  enviar: [
    'pregunta enviada a revisión',
    'preguntas enviadas a revisión',
    'No quedan preguntas para enviar a revisión con estos filtros.',
  ],
  publicar: [
    'pregunta publicada',
    'preguntas publicadas',
    'No quedan preguntas para publicar con estos filtros.',
  ],
};

/** El aviso de una acción en lote: «10 preguntas publicadas.» y por qué no las demás. */
export function avisoDeLote(
  accion: AccionEnLote,
  hechas: number,
  noHechas: readonly PreguntaNoProcesada[],
): AvisoDelBanco {
  const [una, varias, ninguna] = HECHO[accion];
  if (hechas === 0 && noHechas.length === 0) return { tipo: 'exito', texto: ninguna };
  const texto = `${enPlural(hechas, una, varias)}.${motivos(noHechas)}`;
  return { tipo: hechas === 0 ? 'error' : 'exito', texto };
}

async function hacer(accion: AccionEnLote, filtros: FiltrosBanco): Promise<AvisoDelBanco> {
  if (accion === 'enviar') {
    const { enviadas, noEnviadas } = await enviarLoteARevision(filtros);
    return avisoDeLote(accion, enviadas.length, noEnviadas);
  }
  const { publicadas, noPublicadas } = await publicarSinRevision(filtros);
  return avisoDeLote(accion, publicadas.length, noPublicadas);
}

export interface AccionesEnLote {
  /** Cuántas hay para cada acción con los filtros; null mientras se cuentan. */
  conteo: ConteoDelLote | null;
  enCurso: AccionEnLote | null;
  aviso: AvisoDelBanco | null;
  /** Publicar sin revisión se confirma antes, con su consecuencia. */
  porConfirmar: boolean;
  ejecutar(accion: AccionEnLote): void;
  confirmar(): void;
  cancelar(): void;
}

/** Cuenta las que quedan con los filtros; vuelve a contar cuando el banco se recarga (`vuelta`). */
function useConteo(filtros: FiltrosBanco, vuelta: number): ConteoDelLote | null {
  const [conteo, setConteo] = useState<ConteoDelLote | null>(null);
  useEffect(() => {
    const control = new AbortController();
    contarLote(filtros, control.signal).then(setConteo, () => {
      if (!control.signal.aborted) setConteo(null);
    });
    return () => control.abort();
  }, [filtros, vuelta]);
  return conteo;
}

/**
 * De a una acción en lote con los filtros del banco; `alTerminar` recarga el banco (y con él la cuenta),
 * así el clic siguiente toma las 10 siguientes.
 */
export function useAccionesEnLote(
  filtros: FiltrosBanco,
  vuelta: number,
  alTerminar: () => void,
): AccionesEnLote {
  const conteo = useConteo(filtros, vuelta);
  const [enCurso, setEnCurso] = useState<AccionEnLote | null>(null);
  const [aviso, setAviso] = useState<AvisoDelBanco | null>(null);
  const [porConfirmar, setPorConfirmar] = useState(false);

  const ahora = (accion: AccionEnLote) => {
    if (enCurso !== null) return;
    setEnCurso(accion);
    setAviso(null);
    hacer(accion, filtros)
      .then(setAviso, (error: unknown) =>
        setAviso({ tipo: 'error', texto: mensajeDeError(error).mensaje }),
      )
      .finally(() => {
        setEnCurso(null);
        alTerminar();
      });
  };

  return {
    conteo,
    enCurso,
    aviso,
    porConfirmar,
    ejecutar: (accion) => {
      if (accion === 'publicar') setPorConfirmar(true);
      else ahora(accion);
    },
    confirmar: () => {
      setPorConfirmar(false);
      ahora('publicar');
    },
    cancelar: () => setPorConfirmar(false),
  };
}
