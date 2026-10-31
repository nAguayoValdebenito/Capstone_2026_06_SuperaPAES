// HU-17.1 y HU-17.2: la revisión automática de cada propuesta de la IA. Devuelve todos los problemas que
// encuentra (el primero es el motivo de descarte); una lista vacía es una propuesta válida. Las reglas de
// tildes y de letras en las explicaciones son conservadoras: ante la duda, no descartan.
import { describe, expect, it } from 'vitest';
import { revisarPropuesta, LIMITES_REVISION } from '../modulos/generador/generador.revision.js';
import { conAlternativa, contextoM1, preguntaBuena } from './generador-de-prueba.js';

const motivos = (p: Parameters<typeof revisarPropuesta>[0], ctx = contextoM1) =>
  revisarPropuesta(p, ctx).map((problema) => problema.motivo);

describe('revisarPropuesta: propuesta válida', () => {
  it('no encuentra problemas en una propuesta bien hecha', () => {
    expect(revisarPropuesta(preguntaBuena(), contextoM1)).toEqual([]);
  });
});

describe('revisarPropuesta: formato y alternativas (RN-08)', () => {
  it.each(['enunciado', 'resolucion', 'explicacion'] as const)(
    'descarta si %s está vacío',
    (campo) => {
      expect(motivos(preguntaBuena({ [campo]: '   ' }))).toEqual(['formato_invalido']);
    },
  );

  it('descarta una alternativa con el texto o la explicación vacíos', () => {
    expect(motivos(conAlternativa(preguntaBuena(), 0, { texto: ' ' }))).toEqual([
      'formato_invalido',
    ]);
    expect(motivos(conAlternativa(preguntaBuena(), 1, { explicacion: '' }))).toEqual([
      'formato_invalido',
    ]);
  });

  it('descarta si hay menos o más alternativas que las de la prueba', () => {
    const base = preguntaBuena();
    expect(motivos({ ...base, alternativas: base.alternativas.slice(0, 3) })).toContain(
      'alternativas_incorrectas',
    );
    expect(
      motivos({
        ...base,
        alternativas: [...base.alternativas, { ...base.alternativas[0]!, letra: 'E' }],
      }),
    ).toContain('alternativas_incorrectas');
  });

  it('exige letras seguidas desde la A', () => {
    expect(motivos(conAlternativa(preguntaBuena(), 3, { letra: 'E' }))).toContain(
      'alternativas_incorrectas',
    );
  });

  it('exige una sola correcta: ninguna o dos', () => {
    expect(motivos(conAlternativa(preguntaBuena(), 2, { esCorrecta: false }))).toContain(
      'alternativas_incorrectas',
    );
    expect(motivos(conAlternativa(preguntaBuena(), 0, { esCorrecta: true }))).toContain(
      'alternativas_incorrectas',
    );
  });

  it('con cinco alternativas esperadas, una propuesta de cuatro se descarta', () => {
    expect(motivos(preguntaBuena(), { ...contextoM1, alternativas: 5 })).toContain(
      'alternativas_incorrectas',
    );
  });
});

describe('revisarPropuesta: habilidad válida (HU-17 esc. 1)', () => {
  it('descarta una habilidad distinta de la de la ficha', () => {
    expect(motivos(preguntaBuena({ habilidad: 'MOD' }))).toEqual(['habilidad_invalida']);
  });

  it('descarta una habilidad que no es de la prueba', () => {
    expect(motivos(preguntaBuena({ habilidad: 'LOC' }))).toEqual(['habilidad_invalida']);
  });
});

describe('revisarPropuesta: repetidas (HU-17 esc. 2)', () => {
  it('descarta alternativas repetidas aunque cambien mayúsculas, espacios o tildes', () => {
    const base = conAlternativa(preguntaBuena(), 1, { texto: '$10$ ' });
    expect(motivos(base)).toContain('alternativa_repetida');
    const texto = conAlternativa(conAlternativa(preguntaBuena(), 0, { texto: 'Cuarenta' }), 1, {
      texto: ' cuarénta. ',
    });
    expect(motivos(texto)).toContain('alternativa_repetida');
  });

  it('no confunde alternativas que solo se parecen: 1,5 y 15', () => {
    const base = conAlternativa(conAlternativa(preguntaBuena(), 0, { texto: '$1,5$' }), 1, {
      texto: '$15$',
    });
    expect(motivos(base)).not.toContain('alternativa_repetida');
  });

  it('descarta un enunciado duplicado en el banco, sin contar mayúsculas, tildes ni signos', () => {
    const contexto = {
      ...contextoM1,
      enunciadosExistentes: ['cual es el valor de $x$ en la ecuacion $2x + 3 = 17$'],
    };
    expect(motivos(preguntaBuena(), contexto)).toContain('enunciado_duplicado');
  });

  it('un enunciado con otro signo no es duplicado: 2x + 3 y 2x - 3', () => {
    const contexto = {
      ...contextoM1,
      enunciadosExistentes: ['¿Cuál es el valor de $x$ en la ecuación $2x - 3 = 17$?'],
    };
    expect(motivos(preguntaBuena(), contexto)).not.toContain('enunciado_duplicado');
  });
});

describe('revisarPropuesta: explicaciones', () => {
  it('descarta una explicación de alternativa de más de 300 caracteres', () => {
    const larga = 'a'.repeat(LIMITES_REVISION.explicacionAlternativa + 1);
    expect(motivos(conAlternativa(preguntaBuena(), 0, { explicacion: larga }))).toContain(
      'explicacion_larga',
    );
  });

  it('descarta una explicación general de más de 500 caracteres', () => {
    expect(
      motivos(preguntaBuena({ explicacion: 'a'.repeat(LIMITES_REVISION.explicacionGeneral + 1) })),
    ).toContain('explicacion_larga');
  });

  it('descarta si el total de explicaciones pasa de 1.500 caracteres', () => {
    const casi = 'a'.repeat(LIMITES_REVISION.explicacionAlternativa - 1);
    const base = preguntaBuena({
      explicacion: 'b'.repeat(LIMITES_REVISION.explicacionGeneral - 1),
    });
    const pregunta = {
      ...base,
      alternativas: base.alternativas.map((alt) => ({ ...alt, explicacion: casi })),
    };
    expect(motivos(pregunta)).toContain('explicacion_larga');
  });

  it.each([
    'Recalculando: en realidad el resultado es otro.',
    'Corrigiendo el paso anterior, queda $x = 7$.',
    'Me equivoqué al restar, rehago el cálculo.',
    'Nota: este valor no calza con ninguna alternativa.',
    'Usemos otro método para comprobarlo.',
    'Un momento, veamos de nuevo.',
  ])('descarta una explicación con señales de borrador: %s', (explicacion) => {
    expect(motivos(conAlternativa(preguntaBuena(), 0, { explicacion }))).toContain(
      'borrador_en_explicacion',
    );
    expect(motivos(preguntaBuena({ explicacion }))).toContain('borrador_en_explicacion');
  });

  it('no descarta explicaciones normales que usan palabras parecidas', () => {
    const explicaciones = [
      'La nota final del curso es el promedio de las evaluaciones.',
      'Se corrige el signo al pasar el término al otro lado.',
      'Se espera que el estudiante reste antes de dividir.',
    ];
    for (const explicacion of explicaciones) {
      expect(motivos(conAlternativa(preguntaBuena(), 0, { explicacion }))).toEqual([]);
    }
  });
});

describe('revisarPropuesta: coherencia entre la resolución y la clave', () => {
  it('descarta una clave que no coincide con el resultado de la resolución', () => {
    const pregunta = preguntaBuena({ resolucion: 'Se despeja: $2x = 12$, luego $x = 6$.' });
    expect(motivos(pregunta)).toEqual(['clave_incoherente']);
  });

  it('no la comprueba en pruebas de respuesta no numérica', () => {
    const pregunta = preguntaBuena({ resolucion: 'Se despeja: $2x = 12$, luego $x = 6$.' });
    expect(motivos(pregunta, { ...contextoM1, numerica: false })).toEqual([]);
  });

  it('no descarta lo que no se puede comprobar', () => {
    const pregunta = conAlternativa(
      preguntaBuena({ resolucion: 'Se factoriza y queda $(x+1)(x-1)$.' }),
      2,
      { texto: '$x^2 - 1$' },
    );
    expect(motivos(pregunta)).toEqual([]);
  });
});

describe('revisarPropuesta: letras en las explicaciones (conservadora)', () => {
  it.each([
    'La alternativa B es incorrecta porque suma.',
    'Como dice la opción C, el resultado es otro.',
    'Se descarta la letra A.',
  ])('descarta una explicación que nombra una letra: %s', (explicacion) => {
    expect(motivos(conAlternativa(preguntaBuena(), 0, { explicacion }))).toContain(
      'letras_en_explicacion',
    );
  });

  it.each([
    'Es la alternativa más sencilla de calcular.',
    'Se obtiene a partir de la opción que resta primero.',
    'Parte de la letra a minúscula del enunciado.',
    'El punto A del plano es el origen.',
  ])('no descarta si no hay una referencia clara: %s', (explicacion) => {
    expect(motivos(conAlternativa(preguntaBuena(), 0, { explicacion }))).toEqual([]);
  });
});

describe('revisarPropuesta: tildes y signos (conservadora)', () => {
  const sinAcentos = Array.from({ length: 45 }, () => 'numero').join(' ');

  it('descarta un texto largo en español sin ningún carácter acentuado', () => {
    const pregunta = preguntaBuena({ enunciado: `Considere el siguiente caso ${sinAcentos}.` });
    expect(motivos(pregunta)).toContain('sin_tildes');
  });

  it('no descarta un texto corto sin tildes', () => {
    expect(motivos(preguntaBuena({ enunciado: 'Cuanto vale $x$ si $x + 1 = 8$' }))).toEqual([]);
  });

  it('no descarta un texto largo con al menos un carácter acentuado', () => {
    const pregunta = preguntaBuena({ enunciado: `Considere el siguiente caso ${sinAcentos} más.` });
    expect(motivos(pregunta)).not.toContain('sin_tildes');
  });

  it('no cuenta las fórmulas como palabras', () => {
    const formulas = Array.from({ length: 60 }, (_, i) => `$x_{${String(i)}} + y$`).join(' ');
    expect(motivos(preguntaBuena({ enunciado: `Sea ${formulas}` }))).not.toContain('sin_tildes');
  });

  it('descarta una pregunta con «?» y sin «¿»', () => {
    expect(motivos(preguntaBuena({ enunciado: 'Cuanto vale $x$ si $x + 1 = 8$?' }))).toContain(
      'signos_de_interrogacion',
    );
  });

  it('no descarta un enunciado sin pregunta o con los dos signos', () => {
    expect(motivos(preguntaBuena({ enunciado: 'Calcule $x$ si $x + 1 = 8$.' }))).toEqual([]);
    expect(motivos(preguntaBuena({ enunciado: '¿Cuánto vale $x$ si $x + 1 = 8$?' }))).toEqual([]);
  });
});

describe('revisarPropuesta: varios problemas a la vez', () => {
  it('los devuelve todos, en el orden de las reglas, para llevar la cuenta de cada una', () => {
    const base = conAlternativa(preguntaBuena({ habilidad: 'MOD' }), 0, {
      explicacion: 'Recalculando todo de nuevo.',
    });
    expect(motivos(base)).toEqual(['habilidad_invalida', 'borrador_en_explicacion']);
  });

  it('si el formato falla, no sigue con las demás reglas', () => {
    expect(motivos(preguntaBuena({ enunciado: '', habilidad: 'MOD' }))).toEqual([
      'formato_invalido',
    ]);
  });
});
