// Las acciones de cada pregunta en el banco (C02): enviar a revisión una en borrador u observada (HU-21,
// CU-18), publicar una aprobada, retirar una publicada y volver a borrador una retirada (HU-24, CU-21,
// RF-G09). De a una pregunta: al terminar, el banco se vuelve a cargar con la nueva etapa y el aviso dice
// qué pasó; si la API no lo permite (por ejemplo, el área sin docentes), muestra su motivo.
import { useState } from 'react';
import { ErrorApi } from '../api/cliente';
import { cambiarEtapa } from '../servicios/preguntas';
import { enviarARevision } from '../servicios/revision';
import type { CambioDeEtapa, EnvioARevision, PreguntaDelBanco } from '../tipos';
import { mensajeDeError } from './usuarios-internos';

export type AccionDelBanco = 'enviar' | CambioDeEtapa;

export interface AvisoDelBanco {
  tipo: 'exito' | 'error';
  texto: string;
}

/**
 * Las acciones que usa la tabla del banco: de a una pregunta. Una acción hecha (por su clave, la pregunta
 * y la acción) no se repite mientras el banco se recarga; la siguiente acción de esa pregunta sí se puede.
 */
export interface AccionesDelBanco {
  enCurso: number | null;
  hechas: ReadonlySet<string>;
  ejecutar(preguntaId: number, accion: AccionDelBanco): void;
}

/** La clave de una acción hecha: la pregunta y la acción. */
export const claveDeAccion = (preguntaId: number, accion: AccionDelBanco) =>
  `${String(preguntaId)}:${accion}`;

const POR_ETAPA: Partial<Record<string, CambioDeEtapa>> = {
  aprobada: 'publicar',
  publicada: 'retirar',
  retirada: 'borrador',
};

/** La acción de la pregunta según su etapa (la API dice cuáles son editables); null si no tiene. */
export const accionDe = ({
  editable,
  estado,
}: Pick<PreguntaDelBanco, 'editable' | 'estado'>): AccionDelBanco | null =>
  editable ? 'enviar' : (POR_ETAPA[estado.codigo] ?? null);

/** «Ana, Luis y Rosa». */
const enLista = new Intl.ListFormat('es', { type: 'conjunction' });

/** El aviso del envío: la pregunta y los docentes que la revisan. */
export function avisoDeEnvio({ preguntaId, revisores }: EnvioARevision): string {
  const nombres = enLista.format(revisores.map((revisor) => revisor.docente.nombre));
  return `La pregunta ${String(preguntaId)} quedó en revisión: la revisan ${nombres}.`;
}

const AVISOS: Record<CambioDeEtapa, (id: string) => string> = {
  publicar: (id) => `La pregunta ${id} quedó publicada: ya llega a la app.`,
  retirar: (id) => `La pregunta ${id} quedó retirada: ya no llega a la app.`,
  borrador: (id) => `La pregunta ${id} volvió a borrador: puedes corregirla y enviarla a revisión.`,
};

/** El aviso al publicar, retirar o volver a borrador la pregunta. */
export const avisoDeEtapa = (cambio: CambioDeEtapa, preguntaId: number) =>
  AVISOS[cambio](String(preguntaId));

/** Hace la acción en la API y devuelve el aviso. */
async function hacer(preguntaId: number, accion: AccionDelBanco): Promise<string> {
  if (accion === 'enviar') return avisoDeEnvio(await enviarARevision(preguntaId));
  await cambiarEtapa(preguntaId, accion);
  return avisoDeEtapa(accion, preguntaId);
}

/**
 * Hace de a una acción; `alTerminar` vuelve a cargar el banco para ver la nueva etapa. El aviso parte
 * con el que dejó la página anterior (por ejemplo, la importación) y lo reemplaza el de la acción.
 */
export function useAccionesDelBanco(alTerminar: () => void, avisoInicial: string | null) {
  const [enCurso, setEnCurso] = useState<number | null>(null);
  const [hechas, setHechas] = useState<ReadonlySet<string>>(new Set());
  const [aviso, setAviso] = useState<AvisoDelBanco | null>(
    avisoInicial === null ? null : { tipo: 'exito', texto: avisoInicial },
  );

  const ejecutar = (preguntaId: number, accion: AccionDelBanco) => {
    if (enCurso !== null || hechas.has(claveDeAccion(preguntaId, accion))) return;
    setEnCurso(preguntaId);
    setAviso(null);
    hacer(preguntaId, accion)
      .then(
        (texto) => {
          setHechas((actuales) => new Set(actuales).add(claveDeAccion(preguntaId, accion)));
          setAviso({ tipo: 'exito', texto });
          alTerminar();
        },
        (error: unknown) => {
          setAviso({ tipo: 'error', texto: mensajeDeError(error).mensaje });
          // 409: la pregunta cambió de etapa en otra parte; el banco se recarga para mostrar la real.
          if (error instanceof ErrorApi && error.estadoHttp === 409) alTerminar();
        },
      )
      .finally(() => setEnCurso(null));
  };

  return { enCurso, hechas, aviso, ejecutar };
}
