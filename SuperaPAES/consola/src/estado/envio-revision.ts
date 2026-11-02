// Enviar una pregunta a revisión desde el banco (C02, HU-21, CU-18): la API la pasa a en revisión y le
// asigna sus dos revisores (RN-10). Al terminar, el banco se vuelve a cargar y muestra quiénes la
// revisan; si el área no tiene docentes disponibles, muestra el aviso de la API (HU-21 esc. 3).
import { useState } from 'react';
import { enviarARevision } from '../servicios/revision';
import type { EnvioARevision } from '../tipos';
import { mensajeDeError } from './usuarios-internos';

export interface AvisoEnvio {
  tipo: 'exito' | 'error';
  texto: string;
}

/**
 * La acción de enviar que usa la tabla del banco: de a una pregunta. Las ya enviadas no se vuelven a
 * enviar mientras el banco se recarga y muestra su nueva etapa.
 */
export interface AccionEnvio {
  enviando: number | null;
  enviadas: ReadonlySet<number>;
  enviar(preguntaId: number): void;
}

/** «Ana, Luis y Rosa». */
const enLista = new Intl.ListFormat('es', { type: 'conjunction' });

/** El aviso del banco: la pregunta y los docentes que la revisan. */
export function avisoDeEnvio({ preguntaId, revisores }: EnvioARevision): string {
  const nombres = enLista.format(revisores.map((revisor) => revisor.docente.nombre));
  return `La pregunta ${String(preguntaId)} quedó en revisión: la revisan ${nombres}.`;
}

/**
 * Envía de a una pregunta; `alEnviar` vuelve a cargar el banco para ver su nueva etapa. El aviso parte
 * con el que dejó la página anterior (por ejemplo, la importación) y lo reemplaza el del envío.
 */
export function useEnvioARevision(alEnviar: () => void, avisoInicial: string | null) {
  const [enviando, setEnviando] = useState<number | null>(null);
  const [enviadas, setEnviadas] = useState<ReadonlySet<number>>(new Set());
  const [aviso, setAviso] = useState<AvisoEnvio | null>(
    avisoInicial === null ? null : { tipo: 'exito', texto: avisoInicial },
  );

  const enviar = (preguntaId: number) => {
    if (enviando !== null || enviadas.has(preguntaId)) return;
    setEnviando(preguntaId);
    setAviso(null);
    enviarARevision(preguntaId)
      .then(
        (envio) => {
          setEnviadas((actuales) => new Set(actuales).add(preguntaId));
          setAviso({ tipo: 'exito', texto: avisoDeEnvio(envio) });
          alEnviar();
        },
        (error: unknown) => setAviso({ tipo: 'error', texto: mensajeDeError(error).mensaje }),
      )
      .finally(() => setEnviando(null));
  };

  return { enviando, enviadas, aviso, enviar };
}
