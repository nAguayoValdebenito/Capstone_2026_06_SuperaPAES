// Acciones en lote del banco (C02), solo para llenar la app de preguntas y probarla: enviar a revisión
// hasta 10 preguntas de la página (las que admiten el envío: en borrador u observadas) y, con el modo de
// pruebas de la API (MODO_PRUEBAS_PREGUNTAS), publicar sin revisión hasta 10 borradores de la página.
// Cada una dice cuántas se hicieron y por qué no las demás; al terminar, el banco se vuelve a cargar.
import { useState } from 'react';
import { publicarSinRevision } from '../servicios/preguntas';
import { enviarLoteARevision } from '../servicios/revision';
import type { PreguntaDelBanco, PreguntaNoProcesada } from '../tipos';
import { type AvisoDelBanco, accionDe } from './acciones-banco';
import { mensajeDeError } from './usuarios-internos';

/** Lo máximo que se envía o publica en una sola acción (la API también lo limita). */
export const MAXIMO_LOTE = 10;

export type AccionEnLote = 'enviar' | 'publicar';

/** Hasta 10 preguntas de la página que se pueden enviar a revisión, en su orden. */
export const paraEnviar = (preguntas: readonly PreguntaDelBanco[]): number[] =>
  preguntas
    .filter((pregunta) => accionDe(pregunta) === 'enviar')
    .slice(0, MAXIMO_LOTE)
    .map((pregunta) => pregunta.id);

/** Hasta 10 borradores de la página, para publicarlos sin revisión. */
export const paraPublicar = (preguntas: readonly PreguntaDelBanco[]): number[] =>
  preguntas
    .filter((pregunta) => pregunta.estado.codigo === 'borrador')
    .slice(0, MAXIMO_LOTE)
    .map((pregunta) => pregunta.id);

const enPlural = (cantidad: number, una: string, varias: string) =>
  `${String(cantidad)} ${cantidad === 1 ? una : varias}`;

/** «No se pudo con la 85: Sin docentes. La 86: …». */
function motivos(noHechas: readonly PreguntaNoProcesada[]): string {
  if (noHechas.length === 0) return '';
  const detalle = noHechas.map(({ id, motivo }) => `la ${String(id)}: ${motivo}`).join(' ');
  return ` No se pudo con ${detalle}`;
}

/** El aviso de una acción en lote: cuántas se hicieron y por qué no las demás. */
export function avisoDeLote(
  accion: AccionEnLote,
  hechas: number,
  noHechas: readonly PreguntaNoProcesada[],
): AvisoDelBanco {
  const texto =
    accion === 'enviar'
      ? `${enPlural(hechas, 'pregunta quedó', 'preguntas quedaron')} en revisión.`
      : `${enPlural(hechas, 'pregunta quedó publicada', 'preguntas quedaron publicadas')} sin revisión: ya llegan a la app.`;
  return { tipo: hechas === 0 ? 'error' : 'exito', texto: `${texto}${motivos(noHechas)}` };
}

async function hacer(accion: AccionEnLote, ids: readonly number[]): Promise<AvisoDelBanco> {
  if (accion === 'enviar') {
    const { enviadas, noEnviadas } = await enviarLoteARevision(ids);
    return avisoDeLote(accion, enviadas.length, noEnviadas);
  }
  const { publicadas, noPublicadas } = await publicarSinRevision(ids);
  return avisoDeLote(accion, publicadas.length, noPublicadas);
}

export interface AccionesEnLote {
  enCurso: AccionEnLote | null;
  aviso: AvisoDelBanco | null;
  /** Publicar sin revisión se confirma antes, con su consecuencia. */
  porConfirmar: boolean;
  ejecutar(accion: AccionEnLote, ids: readonly number[]): void;
  confirmar(ids: readonly number[]): void;
  cancelar(): void;
}

/** De a una acción en lote; `alTerminar` vuelve a cargar el banco. */
export function useAccionesEnLote(alTerminar: () => void): AccionesEnLote {
  const [enCurso, setEnCurso] = useState<AccionEnLote | null>(null);
  const [aviso, setAviso] = useState<AvisoDelBanco | null>(null);
  const [porConfirmar, setPorConfirmar] = useState(false);

  const ahora = (accion: AccionEnLote, ids: readonly number[]) => {
    if (enCurso !== null || ids.length === 0) return;
    setEnCurso(accion);
    setAviso(null);
    hacer(accion, ids)
      .then(
        (resultado) => {
          setAviso(resultado);
          alTerminar();
        },
        (error: unknown) => setAviso({ tipo: 'error', texto: mensajeDeError(error).mensaje }),
      )
      .finally(() => setEnCurso(null));
  };

  return {
    enCurso,
    aviso,
    porConfirmar,
    ejecutar: (accion, ids) => {
      if (accion === 'publicar') setPorConfirmar(true);
      else ahora(accion, ids);
    },
    confirmar: (ids) => {
      setPorConfirmar(false);
      ahora('publicar', ids);
    },
    cancelar: () => setPorConfirmar(false),
  };
}
