// Datos de las pruebas del generador (HU-16 a HU-18): una propuesta de IA bien hecha de M1 y el contexto
// con que se revisa. Cada prueba parte de aquí y cambia solo lo que quiere probar.
import type { PreguntaPropuesta } from '../adaptadores/ia/proveedor.js';
import type { ContextoRevision } from '../modulos/generador/generador.revision.js';

export const HABILIDADES_M1 = ['RP', 'MOD', 'REP', 'ARG'] as const;

export const contextoM1: ContextoRevision = {
  alternativas: 4,
  habilidad: 'RP',
  habilidadesValidas: HABILIDADES_M1,
  enunciadosExistentes: [],
  numerica: true,
};

/** Una propuesta correcta: la clave (C, $7$) coincide con el resultado de la resolución. */
export function preguntaBuena(cambios: Partial<PreguntaPropuesta> = {}): PreguntaPropuesta {
  return {
    enunciado: '¿Cuál es el valor de $x$ en la ecuación $2x + 3 = 17$?',
    resolucion: 'Se resta $3$ a ambos lados: $2x = 14$. Se divide por $2$: $x = 7$.',
    habilidad: 'RP',
    alternativas: [
      { letra: 'A', texto: '$10$', esCorrecta: false, explicacion: 'Suma $3$ en vez de restarlo.' },
      { letra: 'B', texto: '$14$', esCorrecta: false, explicacion: 'Olvida dividir por $2$.' },
      {
        letra: 'C',
        texto: '$7$',
        esCorrecta: true,
        explicacion: 'Con $x = 7$: $2 \\cdot 7 + 3 = 17$.',
      },
      {
        letra: 'D',
        texto: '$20$',
        esCorrecta: false,
        explicacion: 'Suma $3$ y $17$ sin despejar.',
      },
    ],
    explicacion: 'Se despeja $x$ restando $3$ y dividiendo por $2$.',
    dificultadSugerida: 'facil',
    ...cambios,
  };
}

/** La propuesta con la alternativa indicada reemplazada. */
export function conAlternativa(
  base: PreguntaPropuesta,
  indice: number,
  cambios: Partial<PreguntaPropuesta['alternativas'][number]>,
): PreguntaPropuesta {
  return {
    ...base,
    alternativas: base.alternativas.map((alt, i) => (i === indice ? { ...alt, ...cambios } : alt)),
  };
}
