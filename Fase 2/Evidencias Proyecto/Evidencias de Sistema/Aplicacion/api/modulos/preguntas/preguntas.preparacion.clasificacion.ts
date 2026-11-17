// TEC-04.2: candidatos por coincidencias con el temario vigente. El puntaje no es una aprobación.
import type { ContenidoParaGenerar } from '../temario/index.js';
import { normalizar } from './preguntas.csv.js';
import type { OriginalBanco } from './preguntas.preparacion.lectura.js';

export interface CandidatoBanco {
  contenidoId: number;
  prueba: string;
  eje: string;
  contenido: string;
  puntaje: number;
  coincidencias: string[];
}

const VACIAS = new Set(
  'para como cual cuales una uno unos unas los las del por con que son sus entre sobre este esta esto estas estos siguiente siguientes clase pregunta respuesta ejemplo ejemplos practica practicar identifica identificar resolver problema problemas texto textos'.split(
    ' ',
  ),
);

function palabras(texto: string): Set<string> {
  const lista = normalizar(texto).match(/[a-z]{4,}/g) ?? [];
  return new Set(lista.filter((p) => !VACIAS.has(p)).map((p) => p.replace(/(?:es|s)$/, '')));
}

function puntuar(original: OriginalBanco, contenido: ContenidoParaGenerar): CandidatoBanco {
  const consulta = palabras(`${original.pregunta} ${original.habilidad_requerida}`);
  const nombre = palabras(contenido.nombre);
  const detalles = palabras(contenido.descriptores ?? '');
  const coincidencias = [...consulta].filter((p) => nombre.has(p) || detalles.has(p));
  const puntaje = coincidencias.reduce((total, p) => total + (nombre.has(p) ? 3 : 1), 0);
  return {
    contenidoId: contenido.contenidoId,
    prueba: contenido.prueba.codigo,
    eje: contenido.eje.nombre,
    contenido: contenido.nombre,
    puntaje,
    coincidencias,
  };
}

export function proponerClasificacionBanco(
  original: OriginalBanco,
  temario: readonly ContenidoParaGenerar[],
): CandidatoBanco[] {
  return temario
    .filter((c) => c.activo)
    .map((c) => puntuar(original, c))
    .filter((c) => c.puntaje > 0)
    .sort((a, b) => b.puntaje - a.puntaje || a.contenidoId - b.contenidoId)
    .slice(0, 3);
}
