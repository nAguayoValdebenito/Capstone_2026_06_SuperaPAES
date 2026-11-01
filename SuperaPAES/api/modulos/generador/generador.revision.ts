// Revisión automática de las propuestas de la IA (HU-17.1 y HU-17.2, RF-G04, CU-17b). Funciones puras: no
// leen la base ni llaman a la IA. Devuelven todos los problemas de una propuesta, en el orden de las reglas
// (el primero es su motivo de descarte), para poder contar cuántas descarta cada regla y afinarlas con la
// medición. Una lista vacía es una propuesta válida. Las reglas de tildes y de letras en las explicaciones
// son conservadoras: ante la duda, no descartan, porque revisar a mano es más barato que perder una buena.
import type { PreguntaPropuesta } from '../../adaptadores/ia/proveedor.js';
import { compararClave } from './generador.coherencia.js';
import { normalizarParaComparar } from './generador.normalizar.js';

export type MotivoDescarte =
  | 'formato_invalido'
  | 'alternativas_incorrectas'
  | 'habilidad_invalida'
  | 'alternativa_repetida'
  | 'enunciado_duplicado'
  | 'explicacion_larga'
  | 'borrador_en_explicacion'
  | 'clave_incoherente'
  | 'letras_en_explicacion'
  | 'sin_tildes'
  | 'signos_de_interrogacion'
  // El texto de lectura (HU-18.2)
  | 'texto_invalido'
  | 'texto_corto'
  | 'texto_largo';

export interface Problema {
  motivo: MotivoDescarte;
  detalle: string;
}

export interface ContextoRevision {
  /** RN-08: cuántas alternativas lleva la prueba. */
  alternativas: number;
  /** La habilidad de la ficha: la propuesta debe declarar esa. */
  habilidad: string;
  /** Los códigos de las habilidades de la prueba. */
  habilidadesValidas: readonly string[];
  /** Enunciados del mismo contenido en el banco (cualquier estado) y de las propuestas ya guardadas. */
  enunciadosExistentes: readonly string[];
  /** Pruebas de respuesta numérica (M1 y M2): solo ahí se compara la resolución con la clave. */
  numerica: boolean;
}

/** Valores iniciales, a afinar con ejemplos reales de la medición. */
export const LIMITES_REVISION = {
  explicacionAlternativa: 300,
  explicacionGeneral: 500,
  explicacionesTotal: 1500,
  /** Palabras (fuera de las fórmulas) desde las que un texto sin ninguna tilde se considera sospechoso. */
  palabrasParaExigirTildes: 40,
} as const;

/** Señales de que el modelo dejó su borrador o se corrigió dentro de una explicación. */
const SENALES_DE_BORRADOR = [
  /\brecalcul/u,
  /\bcorrigiendo\b/u,
  /\bcorrijo\b/u,
  /\bme equivoqu/u,
  /\bnota:/u,
  /\busemos\b/u,
  /\bno calza\b/u,
  /\bun momento\b/u,
  /\ben realidad\b/u,
  /\bmejor dicho\b/u,
  /\bhmm+\b/u,
  /\bveamos\b/u,
  /\bintentemos\b/u,
  /\bborrador\b/u,
  /\breconsider/u,
  /\bespera,/u,
] as const;

// Referencia clara a una letra: «la alternativa B», «la opción C», «la letra A». Las letras se mezclan al
// guardar, así que una explicación que nombra otra alternativa quedaría apuntando a la equivocada.
const LETRA_EN_EXPLICACION = /\b(?:[Aa]lternativa|[Oo]pci[oó]n|[Ll]etra)\s+[A-E]\b/u;
const CARACTERES_ACENTUADOS = /[áéíóúüñÁÉÍÓÚÜÑ]/u;
const FORMULAS = /\$[^$]*\$/gu;

const vacio = (texto: string): boolean => texto.trim() === '';

function sinAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function explicaciones(p: PreguntaPropuesta): string[] {
  return [p.explicacion, ...p.alternativas.map((alternativa) => alternativa.explicacion)];
}

function problemaDeFormato(p: PreguntaPropuesta): Problema | null {
  const campos = [p.enunciado, p.resolucion, p.explicacion];
  const alternativas = p.alternativas.flatMap((a) => [a.texto, a.explicacion]);
  const hayVacio = [...campos, ...alternativas].some(vacio);
  return hayVacio
    ? { motivo: 'formato_invalido', detalle: 'Hay un campo obligatorio vacío.' }
    : null;
}

function problemasDeAlternativas(p: PreguntaPropuesta, ctx: ContextoRevision): Problema[] {
  const problemas: Problema[] = [];
  const letras = 'ABCDE'.slice(0, ctx.alternativas);
  if (p.alternativas.length !== ctx.alternativas) {
    problemas.push({
      motivo: 'alternativas_incorrectas',
      detalle: `Debe tener ${String(ctx.alternativas)} alternativas y trae ${String(p.alternativas.length)}.`,
    });
  } else if (p.alternativas.some((alternativa, i) => alternativa.letra !== letras[i])) {
    problemas.push({
      motivo: 'alternativas_incorrectas',
      detalle: 'Las letras no van seguidas desde la A.',
    });
  }
  const correctas = p.alternativas.filter((alternativa) => alternativa.esCorrecta).length;
  if (correctas !== 1) {
    problemas.push({
      motivo: 'alternativas_incorrectas',
      detalle: `Debe tener una sola correcta y trae ${String(correctas)}.`,
    });
  }
  return problemas;
}

function problemasDeRepetidas(p: PreguntaPropuesta, ctx: ContextoRevision): Problema[] {
  const problemas: Problema[] = [];
  const textos = p.alternativas.map((alternativa) => normalizarParaComparar(alternativa.texto));
  if (new Set(textos).size !== textos.length) {
    problemas.push({ motivo: 'alternativa_repetida', detalle: 'Hay alternativas repetidas.' });
  }
  const enunciado = normalizarParaComparar(p.enunciado);
  if (ctx.enunciadosExistentes.some((otro) => normalizarParaComparar(otro) === enunciado)) {
    problemas.push({
      motivo: 'enunciado_duplicado',
      detalle: 'Ya hay una pregunta con el mismo enunciado en este contenido.',
    });
  }
  return problemas;
}

function problemasDeExplicaciones(p: PreguntaPropuesta): Problema[] {
  const problemas: Problema[] = [];
  const porAlternativa = p.alternativas.map((alternativa) => alternativa.explicacion.length);
  const total = explicaciones(p).reduce((suma, texto) => suma + texto.length, 0);
  if (
    p.explicacion.length > LIMITES_REVISION.explicacionGeneral ||
    porAlternativa.some((largo) => largo > LIMITES_REVISION.explicacionAlternativa) ||
    total > LIMITES_REVISION.explicacionesTotal
  ) {
    problemas.push({ motivo: 'explicacion_larga', detalle: 'Una explicación es demasiado larga.' });
  }
  if (
    explicaciones(p).some((texto) => SENALES_DE_BORRADOR.some((s) => s.test(sinAcentos(texto))))
  ) {
    problemas.push({
      motivo: 'borrador_en_explicacion',
      detalle: 'Una explicación parece un borrador o una autocorrección.',
    });
  }
  return problemas;
}

function problemasDeClave(p: PreguntaPropuesta, ctx: ContextoRevision): Problema[] {
  const correcta = p.alternativas.find((alternativa) => alternativa.esCorrecta);
  if (!ctx.numerica || correcta === undefined) return [];
  return compararClave(p.resolucion, correcta.texto) === 'incoherente'
    ? [
        {
          motivo: 'clave_incoherente',
          detalle: 'La clave no coincide con el resultado de la resolución.',
        },
      ]
    : [];
}

function problemasDeRedaccion(p: PreguntaPropuesta): Problema[] {
  const problemas: Problema[] = [];
  if (explicaciones(p).some((texto) => LETRA_EN_EXPLICACION.test(texto))) {
    problemas.push({
      motivo: 'letras_en_explicacion',
      detalle: 'Una explicación nombra una letra de alternativa.',
    });
  }
  const visibles = [p.enunciado, ...explicaciones(p), ...p.alternativas.map((a) => a.texto)];
  const texto = visibles.join(' ').replace(FORMULAS, ' ');
  const palabras = texto.match(/\p{L}{2,}/gu)?.length ?? 0;
  if (palabras >= LIMITES_REVISION.palabrasParaExigirTildes && !CARACTERES_ACENTUADOS.test(texto)) {
    problemas.push({ motivo: 'sin_tildes', detalle: 'El texto no trae ninguna tilde.' });
  }
  const enunciado = p.enunciado.replace(FORMULAS, ' ');
  if (enunciado.includes('?') && !enunciado.includes('¿')) {
    problemas.push({
      motivo: 'signos_de_interrogacion',
      detalle: 'Falta el signo de interrogación de apertura.',
    });
  }
  return problemas;
}

/** Los problemas de la propuesta en el orden de las reglas; vacío si es válida. */
export function revisarPropuesta(p: PreguntaPropuesta, ctx: ContextoRevision): Problema[] {
  const formato = problemaDeFormato(p);
  if (formato !== null) return [formato];
  const habilidad: Problema[] =
    p.habilidad === ctx.habilidad && ctx.habilidadesValidas.includes(p.habilidad)
      ? []
      : [
          {
            motivo: 'habilidad_invalida',
            detalle: 'La habilidad no es la pedida para esta prueba.',
          },
        ];
  return [
    ...problemasDeAlternativas(p, ctx),
    ...habilidad,
    ...problemasDeRepetidas(p, ctx),
    ...problemasDeExplicaciones(p),
    ...problemasDeClave(p, ctx),
    ...problemasDeRedaccion(p),
  ];
}
