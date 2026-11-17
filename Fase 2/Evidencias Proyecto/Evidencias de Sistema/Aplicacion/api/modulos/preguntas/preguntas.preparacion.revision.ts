// TEC-04.3 y 04.4: decisiones explícitas, sin sustituir la revisión docente ni la declaración RN-29.
import { z } from 'zod';
import type { ContenidoParaGenerar } from '../temario/index.js';
import { normalizar } from './preguntas.csv.js';
import type { OriginalBanco, RegistroBanco } from './preguntas.preparacion.lectura.js';
import { LETRAS } from './preguntas.validadores.js';

export const esquemaDecisionBanco = z.object({
  id: z.string(),
  estado: z.enum(['preparar', 'excluir', 'pendiente']),
  motivo: z.string().trim().min(1),
  contenidoId: z.number().int().positive().optional(),
  habilidad: z.string().optional(),
  eliminarAlternativa: z.enum(LETRAS).optional(),
});
export type DecisionBanco = z.infer<typeof esquemaDecisionBanco>;

function claveAlternativa(texto: string): string {
  const normal = normalizar(texto);
  const numero = /^([+-]?\d+(?:[.,]\d+)?)(?:\s*\/\s*([+-]?\d+(?:[.,]\d+)?))?$/.exec(normal);
  if (!numero) return normal;
  const denominador = Number((numero[2] ?? '1').replace(',', '.'));
  if (!denominador) return normal;
  return String(Number((numero[1] ?? '').replace(',', '.')) / denominador);
}

export function problemasBanco(registro: RegistroBanco): string[] {
  const o = registro.original;
  const motivos: string[] = [];
  if (registro.clavesDuplicadas.length)
    motivos.push(`Claves duplicadas: ${registro.clavesDuplicadas.join(', ')}.`);
  if (!o.pregunta.trim() || !o.explicacion_respuesta.trim())
    motivos.push('Falta enunciado o explicación.');
  if (o.alternativas.some((a) => !a.trim())) motivos.push('Hay alternativas vacías.');
  if (new Set(o.alternativas.map(claveAlternativa)).size !== o.alternativas.length)
    motivos.push('Alternativas repetidas.');
  if (
    !/^[A-E]$/.test(o.respuesta_correcta) ||
    o.respuesta_correcta.charCodeAt(0) - 65 >= o.alternativas.length
  ) {
    motivos.push('La correcta no identifica una alternativa.');
  }
  return motivos;
}

/** Solo retira el distractor elegido al revisar; conserva la correcta y registra su nueva letra. */
export function ajustarAlternativasBanco(original: OriginalBanco, eliminar: string): OriginalBanco {
  const indice = LETRAS.findIndex((letra) => letra === eliminar);
  const correcta = LETRAS.findIndex((letra) => letra === original.respuesta_correcta);
  if (original.alternativas.length !== 5 || indice < 0 || correcta < 0 || indice === correcta) {
    throw new Error('Solo se puede retirar un distractor de una pregunta de cinco alternativas.');
  }
  if (/\b(?:opci[oó]n|alternativa|respuesta)\s*\(?[A-E]\b/i.test(original.explicacion_respuesta)) {
    throw new Error(
      'La explicación menciona letras: requiere corrección manual antes de retirar alternativas.',
    );
  }
  return {
    ...original,
    alternativas: original.alternativas.filter((_a, i) => i !== indice),
    respuesta_correcta: LETRAS[correcta > indice ? correcta - 1 : correcta] ?? '',
  };
}

export function revisarDecisionBanco(
  registro: RegistroBanco,
  decision: DecisionBanco,
  temario: readonly ContenidoParaGenerar[],
): { original: OriginalBanco; contenido: ContenidoParaGenerar; habilidad: string } {
  const problemas = problemasBanco(registro);
  if (problemas.length) throw new Error(problemas.join(' '));
  const contenido = temario.find((c) => c.activo && c.contenidoId === decision.contenidoId);
  if (!contenido) throw new Error('La clasificación no identifica un contenido activo.');
  const habilidad = contenido.prueba.habilidades.find((h) => h.codigo === decision.habilidad);
  if (!habilidad) throw new Error('Falta una habilidad oficial de la prueba.');
  if (contenido.prueba.requiereTexto)
    throw new Error('Falta separar y revisar el texto de lectura de CL.');
  if (!contenido.prueba.tiposPregunta.includes('seleccion_multiple'))
    throw new Error('La prueba no admite selección múltiple.');
  const original = decision.eliminarAlternativa
    ? ajustarAlternativasBanco(registro.original, decision.eliminarAlternativa)
    : registro.original;
  const cantidad = original.alternativas.length;
  if (cantidad < 4 || cantidad > contenido.prueba.opcionesMax)
    throw new Error('Cantidad de alternativas incompatible con RN-08.');
  return { original, contenido, habilidad: habilidad.nombre };
}
