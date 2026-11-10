// Preparación fuera de línea del banco original (TEC-04). No crea preguntas ni cambia estados.
import type { ContenidoParaGenerar } from '../temario/index.js';
import { normalizar } from './preguntas.csv.js';
import { COLUMNAS_PREGUNTAS } from './preguntas.plantilla.js';
import { proponerClasificacionBanco } from './preguntas.preparacion.clasificacion.js';
import type { RegistroBanco } from './preguntas.preparacion.lectura.js';
import {
  type DecisionBanco,
  problemasBanco,
  revisarDecisionBanco,
} from './preguntas.preparacion.revision.js';

const COLUMNAS_REVISION = [
  'id',
  'archivo',
  'numero',
  'estado',
  'revision',
  'incidencias',
  'enunciado',
  'candidatos',
  'alternativa_a',
  'alternativa_b',
  'alternativa_c',
  'alternativa_d',
  'alternativa_e',
  'correcta',
  'explicacion',
  'habilidad_original',
];

function intentarPreparar(
  registro: RegistroBanco,
  decision: DecisionBanco | undefined,
  temario: readonly ContenidoParaGenerar[],
  motivos: string[],
) {
  if (decision?.estado !== 'preparar') return null;
  try {
    if (motivos.length) throw new Error(motivos.join(' '));
    return filaImportable(revisarDecisionBanco(registro, decision, temario));
  } catch (error) {
    motivos.push(error instanceof Error ? error.message : 'No se pudo preparar la pregunta.');
    return null;
  }
}

/** Siempre entrecomillado: también neutraliza separadores y saltos de línea del banco. */
export function csvBanco(filas: readonly (readonly string[])[]): string {
  return (
    '\uFEFF' +
    filas.map((f) => f.map((c) => `"${c.replaceAll('"', '""')}"`).join(';')).join('\r\n') +
    '\r\n'
  );
}

function filaImportable(datos: ReturnType<typeof revisarDecisionBanco>): string[] {
  const { original: o, contenido: c, habilidad } = datos;
  const valores: Record<string, string> = {
    prueba: c.prueba.codigo,
    eje: c.eje.nombre,
    contenido: c.nombre,
    habilidad,
    tipo: 'seleccion_multiple',
    enunciado: o.pregunta,
    correcta: o.respuesta_correcta,
    explicacion: o.explicacion_respuesta,
  };
  o.alternativas.forEach((alternativa, i) => {
    valores[`alternativa_${String.fromCharCode(97 + i)}`] = alternativa;
  });
  return COLUMNAS_PREGUNTAS.map((columna) => valores[columna] ?? '');
}

function duplicados(registros: readonly RegistroBanco[]): Set<string> {
  const cantidades = new Map<string, number>();
  for (const r of registros) {
    const clave = normalizar(r.original.pregunta);
    cantidades.set(clave, (cantidades.get(clave) ?? 0) + 1);
  }
  return new Set([...cantidades].filter(([, n]) => n > 1).map(([clave]) => clave));
}

function prepararRegistro(
  registro: RegistroBanco,
  decision: DecisionBanco | undefined,
  temario: readonly ContenidoParaGenerar[],
  repetidos: Set<string>,
) {
  const motivos = problemasBanco(registro);
  if (repetidos.has(normalizar(registro.original.pregunta)))
    motivos.push('Enunciado repetido en el banco.');
  const fila = intentarPreparar(registro, decision, temario, motivos);
  const estado = fila ? 'preparada' : decision?.estado === 'excluir' ? 'excluida' : 'pendiente';
  const clasificacion = temario.find((c) => c.activo && c.contenidoId === decision?.contenidoId);
  return {
    ...registro,
    estado,
    motivos: [...new Set(motivos)],
    decision: decision ?? null,
    candidatos: proponerClasificacionBanco(registro.original, temario),
    clasificacion: clasificacion
      ? {
          prueba: clasificacion.prueba.codigo,
          eje: clasificacion.eje.nombre,
          contenido: clasificacion.nombre,
        }
      : null,
    fila,
  };
}

function filaRevision(r: ReturnType<typeof prepararRegistro>): string[] {
  return [
    r.id,
    r.archivo,
    String(r.numero),
    r.estado,
    r.decision?.motivo ?? '',
    r.motivos.join(' | '),
    r.original.pregunta,
    JSON.stringify(r.candidatos),
    ...Array.from({ length: 5 }, (_a, i) => r.original.alternativas[i] ?? ''),
    r.original.respuesta_correcta,
    r.original.explicacion_respuesta,
    r.original.habilidad_requerida,
  ];
}

export function prepararBanco(
  registros: readonly RegistroBanco[],
  temario: readonly ContenidoParaGenerar[],
  decisiones: readonly DecisionBanco[],
) {
  const ids = new Set(registros.map((r) => r.id));
  const porId = new Map(decisiones.map((d) => [d.id, d]));
  if (porId.size !== decisiones.length || decisiones.some((d) => !ids.has(d.id))) {
    throw new Error('Hay decisiones duplicadas o que no corresponden a este banco.');
  }
  const repetidos = duplicados(registros);
  const revision = registros.map((r) => prepararRegistro(r, porId.get(r.id), temario, repetidos));
  const filas = revision.flatMap((r) => (r.fila ? [r.fila] : []));
  const resumen = {
    total: revision.length,
    preparadas: filas.length,
    excluidas: revision.filter((r) => r.estado === 'excluida').length,
    pendientes: revision.filter((r) => r.estado === 'pendiente').length,
    ajustesAlternativas: revision.filter((r) => r.fila && r.decision?.eliminarAlternativa).length,
  };
  return {
    resumen,
    revision,
    importacion: csvBanco([COLUMNAS_PREGUNTAS, ...filas]),
    planilla: csvBanco([COLUMNAS_REVISION, ...revision.map(filaRevision)]),
  };
}
