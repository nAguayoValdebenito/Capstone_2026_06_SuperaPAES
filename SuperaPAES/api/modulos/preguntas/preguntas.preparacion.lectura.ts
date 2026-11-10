// TEC-04.1: lectura conservadora. Una reparación solo se aplica si coincide exactamente una vez.
import { createHash } from 'node:crypto';
import { z } from 'zod';

export const esquemaReparacionBanco = z.object({
  archivo: z.string(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  antes: z.string().min(1),
  despues: z.string(),
  motivo: z.string().min(1),
});
export type ReparacionBanco = z.infer<typeof esquemaReparacionBanco>;

const esquemaOriginal = z.object({
  pregunta: z.string(),
  alternativas: z.array(z.string()),
  respuesta_correcta: z.string(),
  explicacion_respuesta: z.string(),
  habilidad_requerida: z.string(),
});
export type OriginalBanco = z.infer<typeof esquemaOriginal>;

export interface RegistroBanco {
  id: string;
  archivo: string;
  numero: number;
  original: OriginalBanco;
  clavesDuplicadas: string[];
}

export const huellaBanco = (texto: string | Buffer): string =>
  createHash('sha256').update(texto).digest('hex');

/** Conserva las claves duplicadas como incidencia: JSON.parse por sí solo las ocultaría. */
function objetosCrudos(texto: string): string[] {
  const objetos: string[] = [];
  let profundidad = 0;
  let inicio = 0;
  for (const token of texto.matchAll(/"(?:\\.|[^"\\])*"|[{}]/gs)) {
    if (token[0] === '{') {
      if (profundidad === 0) inicio = token.index;
      profundidad++;
    } else if (token[0] === '}') {
      profundidad--;
      if (profundidad === 0) objetos.push(texto.slice(inicio, token.index + 1));
    }
  }
  return objetos;
}

function clavesDuplicadas(texto: string): string[] {
  const vistas = new Set<string>();
  const repetidas = new Set<string>();
  for (const token of texto.matchAll(/"(?:\\.|[^"\\])*"/gs)) {
    if (
      !texto
        .slice(token.index + token[0].length)
        .trimStart()
        .startsWith(':')
    )
      continue;
    const clave: unknown = JSON.parse(token[0]);
    if (typeof clave !== 'string') continue;
    if (vistas.has(clave)) repetidas.add(clave);
    vistas.add(clave);
  }
  return [...repetidas];
}

export function repararBanco(original: string, reparaciones: readonly ReparacionBanco[]): string {
  let texto = original.replace(/^\uFEFF/, '');
  for (const reparacion of reparaciones) {
    if (huellaBanco(original) !== reparacion.sha256) {
      throw new Error('El archivo cambió respecto de la reparación revisada.');
    }
    if (texto.split(reparacion.antes).length !== 2) {
      throw new Error('La reparación no identifica un único fragmento.');
    }
    texto = texto.replace(reparacion.antes, () => reparacion.despues);
  }
  return texto;
}

export function leerBanco(texto: string, archivo: string): RegistroBanco[] {
  const datos: unknown = JSON.parse(texto);
  const originales = z.array(esquemaOriginal).parse(datos);
  const crudos = objetosCrudos(texto);
  if (crudos.length !== originales.length)
    throw new Error('El banco debe ser una lista de objetos planos.');
  return originales.map((original, i) => ({
    id: huellaBanco(`${archivo}\n${String(i + 1)}\n${crudos[i] ?? ''}`),
    archivo,
    numero: i + 1,
    original,
    clavesDuplicadas: clavesDuplicadas(crudos[i] ?? ''),
  }));
}
