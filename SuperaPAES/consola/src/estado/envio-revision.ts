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

/** «Ana, Luis y Rosa». */
function enLista(nombres: readonly string[]): string {
  if (nombres.length <= 1) return nombres.join('');
  return `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1) ?? ''}`;
}

/** El aviso del banco: la pregunta y los docentes que la revisan. */
export function avisoDeEnvio({ preguntaId, revisores }: EnvioARevision): string {
  const nombres = revisores.map((revisor) => revisor.docente.nombre);
  return `La pregunta ${String(preguntaId)} quedó en revisión: la revisan ${enLista(nombres)}.`;
}

/** Envía de a una pregunta; `alEnviar` vuelve a cargar el banco para ver su nueva etapa. */
export function useEnvioARevision(alEnviar: () => void) {
  const [enviando, setEnviando] = useState<number | null>(null);
  const [aviso, setAviso] = useState<AvisoEnvio | null>(null);

  const enviar = (preguntaId: number) => {
    if (enviando !== null) return;
    setEnviando(preguntaId);
    setAviso(null);
    enviarARevision(preguntaId).then(
      (envio) => {
        setEnviando(null);
        setAviso({ tipo: 'exito', texto: avisoDeEnvio(envio) });
        alEnviar();
      },
      (error: unknown) => {
        setEnviando(null);
        setAviso({ tipo: 'error', texto: mensajeDeError(error).mensaje });
      },
    );
  };

  return { enviando, aviso, enviar };
}

export type EnvioDelBanco = ReturnType<typeof useEnvioARevision>;
