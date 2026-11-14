// El acta del docente, común a Mis revisiones (D01, HU-22) y Desempates (D02, HU-23): el folio con el
// código de la pregunta, la ronda y la fecha límite; la firma con quién decide y la fecha de hoy; y en
// D01 cuántos criterios de la pauta faltan y los atajos S y N para el criterio enfocado. Solo interfaz:
// la validación sigue en formulario-revision.ts.
import { type KeyboardEvent, useState } from 'react';
import type { CriterioPauta, RevisionPendiente } from '../tipos';
import { codigoDePregunta, fechaLimite } from '../utilidades/revision';
import type { TeclaPulsada } from './clasificar-dificultad';
import { useSesion } from './contexto-sesion';
import type { RespuestaCriterio } from './formulario-revision';

/** Quién firma el acta y la fecha de hoy, ya escrita. */
export interface Firma {
  quien: string;
  fecha: string;
}

const fechaLarga = new Intl.DateTimeFormat('es-CL', { dateStyle: 'long' });

/** La firma cuando el acta se dibuja sin sesión (las pruebas): «Docente», sin fecha. */
export const FIRMA_SIN_SESION: Firma = { quien: 'Docente', fecha: '' };

/** La firma con el nombre del docente (el token puede no traerlo: entonces «Docente») y la fecha. */
export const firmaDe = (nombre: string | undefined, hoy: Date): Firma => ({
  quien: nombre?.trim() || 'Docente',
  fecha: fechaLarga.format(hoy),
});

/** La firma del docente con sesión: su nombre y la fecha del día en que abrió la sección. */
export function useFirma(): Firma {
  const { usuario } = useSesion();
  const [hoy] = useState(() => new Date());
  return firmaDe(usuario?.nombre, hoy);
}

/** Los datos del folio: el código, la ronda, la fecha de asignación y la fecha límite. */
export const folioDe = (
  asignacion: Pick<RevisionPendiente, 'preguntaId' | 'ronda' | 'asignadoEn' | 'venceEn'>,
) => ({
  codigo: codigoDePregunta(asignacion.preguntaId),
  ronda: String(asignacion.ronda),
  asignada: fechaLimite(asignacion.asignadoEn),
  vence: fechaLimite(asignacion.venceEn),
});

/** Cuántos criterios de la pauta faltan por responder y cuántos se cumplen, con su texto. */
export function avanceDeLaPauta(
  pauta: readonly CriterioPauta[],
  criterios: Readonly<Record<string, RespuestaCriterio>>,
) {
  const total = pauta.length;
  const faltan = pauta.filter(({ codigo }) => criterios[codigo]?.cumple == null).length;
  const cumplen = pauta.filter(({ codigo }) => criterios[codigo]?.cumple === true).length;
  const texto =
    faltan === 0
      ? `Pauta completa: ${String(cumplen)} de ${String(total)} se cumplen`
      : `${faltan === 1 ? 'Falta' : 'Faltan'} ${String(faltan)} de ${String(total)} criterios`;
  return { faltan, total, cumplen, texto };
}

/** Campos donde se escribe texto: ahí S y N son letras, no atajos (los radios sí admiten atajos). */
const ESCRIBE_TEXTO =
  'input:not([type="radio"]):not([type="checkbox"]), textarea, select, [contenteditable="true"]';

/**
 * La respuesta del atajo: S marca «Sí» (true) y N marca «No» (false), en mayúscula o minúscula; null
 * con Ctrl, Alt o Meta, mientras se escribe en un campo o con otra tecla.
 */
export function respuestaDeTecla(tecla: TeclaPulsada): boolean | null {
  if (tecla.ctrlKey || tecla.altKey || tecla.metaKey) return null;
  if (tecla.target instanceof Element && tecla.target.closest(ESCRIBE_TEXTO)) return null;
  const letra = tecla.key.toLowerCase();
  if (letra === 's') return true;
  if (letra === 'n') return false;
  return null;
}

/** Las teclas que anuncia cada opción del criterio (aria-keyshortcuts). */
export const TECLAS_SI_NO = { si: 'S', no: 'N' } as const;

/**
 * La pauta del acta (D01): el avance para la línea «Faltan N de M criterios» y el manejador de teclado
 * de cada criterio, que responde el criterio enfocado con S o N.
 */
export function pautaDelActa(
  pauta: readonly CriterioPauta[],
  revision: {
    campos: { criterios: Record<string, RespuestaCriterio> };
    responder: (codigo: string, cumple: boolean) => void;
  },
) {
  return {
    avance: avanceDeLaPauta(pauta, revision.campos.criterios),
    alPresionarTecla: (codigo: string, evento: KeyboardEvent<HTMLElement>) => {
      const cumple = respuestaDeTecla(evento);
      if (cumple === null) return;
      evento.preventDefault();
      revision.responder(codigo, cumple);
    },
  };
}
