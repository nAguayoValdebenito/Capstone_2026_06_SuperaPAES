// Preguntas de ejemplo de Historia y Ciencias: 12 por prueba, 4 por eje, para que alcancen para practicar. Son
// preguntas inventadas y sencillas, no material del DEMRE (RN-29).
import { preguntaDe, type DatosPregunta, type PreguntaDeEjemplo } from './tipos.js';

type Fila = readonly [
  dificultad: DatosPregunta['dificultad'],
  enunciado: string,
  explicacion: string,
  correcta: string,
  errores: readonly [string, string, string],
];

/** Una línea por pregunta: la explicación de la correcta sirve también para las incorrectas. */
const preguntasDe = (prueba: string, eje: string, filas: readonly Fila[]): PreguntaDeEjemplo[] =>
  filas.map(([dificultad, enunciado, explicacion, correcta, [uno, dos, tres]]) =>
    preguntaDe(prueba, {
      dificultad,
      enunciado,
      explicacion,
      eje,
      correcta: [correcta, `Correcta. ${explicacion}`],
      errores: [
        [uno, `No es correcta. ${explicacion}`],
        [dos, `No es correcta. ${explicacion}`],
        [tres, `No es correcta. ${explicacion}`],
      ],
    }),
  );

export const PREGUNTAS_HISTORIA: readonly PreguntaDeEjemplo[] = [
  ...preguntasDe('HCS', 'Historia: Mundo, América y Chile', [
    [
      'facil',
      '¿En qué año se proclamó la Independencia de Chile?',
      'El Acta de la Independencia se proclamó en 1818.',
      '1818',
      ['1810', '1891', '1973'],
    ],
    [
      'media',
      '¿Qué proceso impulsó la máquina de vapor en Europa entre los siglos XVIII y XIX?',
      'La máquina de vapor fue central en la Revolución Industrial.',
      'La Revolución Industrial',
      ['El Renacimiento', 'La Reforma protestante', 'La Guerra Fría'],
    ],
    [
      'media',
      '¿Qué producto fue la principal exportación de Chile a fines del siglo XIX?',
      'El salitre del norte fue la principal exportación de la época.',
      'El salitre',
      ['El trigo', 'El vino', 'La lana'],
    ],
    [
      'dificil',
      '¿Qué tratado de 1494 dividió entre España y Portugal las tierras por descubrir?',
      'El Tratado de Tordesillas fijó esa división en 1494.',
      'El Tratado de Tordesillas',
      ['El Tratado de Versalles', 'El Tratado de Ancón', 'La Paz de Westfalia'],
    ],
  ]),
  ...preguntasDe('HCS', 'Formación ciudadana', [
    [
      'facil',
      '¿Qué poder del Estado aprueba las leyes en Chile?',
      'El Congreso Nacional ejerce el Poder Legislativo.',
      'El Poder Legislativo',
      ['El Poder Judicial', 'Las municipalidades', 'El Banco Central'],
    ],
    [
      'media',
      '¿Desde qué edad se puede votar en Chile?',
      'La ciudadanía se adquiere a los 18 años.',
      '18 años',
      ['14 años', '16 años', '21 años'],
    ],
    [
      'media',
      '¿Cuántos años dura el mandato presidencial en Chile?',
      'El período presidencial dura 4 años.',
      '4 años',
      ['2 años', '6 años', '8 años'],
    ],
    [
      'dificil',
      '¿Qué institución controla la legalidad de los actos de la administración del Estado?',
      'Esa función corresponde a la Contraloría General de la República.',
      'La Contraloría General de la República',
      ['El Tribunal Calificador de Elecciones', 'El Senado', 'El Consejo de Rectores'],
    ],
  ]),
  ...preguntasDe('HCS', 'Sistema económico', [
    [
      'facil',
      '¿Cómo se llama el aumento general y sostenido de los precios?',
      'Ese fenómeno se llama inflación.',
      'Inflación',
      ['Ahorro', 'Exportación', 'Desempleo'],
    ],
    [
      'media',
      'Si sube el precio de un bien y lo demás no cambia, ¿qué suele pasar con su cantidad demandada?',
      'Según la ley de la demanda, a mayor precio se demanda menos.',
      'Disminuye',
      ['Aumenta', 'Se mantiene siempre igual', 'Llega a cero de inmediato'],
    ],
    [
      'media',
      '¿Qué institución chilena tiene como objetivo cuidar la estabilidad de los precios?',
      'Ese objetivo corresponde al Banco Central de Chile.',
      'El Banco Central',
      ['El Servicio de Impuestos Internos', 'La Tesorería', 'El Registro Civil'],
    ],
    [
      'dificil',
      '¿Qué mide el Producto Interno Bruto (PIB)?',
      'El PIB mide el valor de los bienes y servicios finales producidos en un país en un período.',
      'El valor de los bienes y servicios finales producidos en un país',
      ['El dinero guardado en los bancos', 'La cantidad de habitantes', 'La deuda de las familias'],
    ],
  ]),
];

export const PREGUNTAS_CIENCIAS: readonly PreguntaDeEjemplo[] = [
  ...preguntasDe('CIE', 'Biología', [
    [
      'facil',
      '¿Qué organelo produce la mayor parte de la energía de la célula?',
      'La mitocondria produce la mayor parte del ATP.',
      'La mitocondria',
      ['El ribosoma', 'La vacuola', 'El aparato de Golgi'],
    ],
    [
      'media',
      '¿Qué molécula guarda la información genética?',
      'La información genética se guarda en el ADN.',
      'El ADN',
      ['La glucosa', 'El colesterol', 'El almidón'],
    ],
    [
      'media',
      '¿Qué tipo de célula no tiene un núcleo definido?',
      'Las células procariontes no tienen núcleo definido.',
      'La procarionte',
      ['La neurona', 'La célula vegetal', 'El glóbulo blanco'],
    ],
    [
      'dificil',
      '¿Qué proceso reduce a la mitad el número de cromosomas al formar gametos?',
      'La meiosis reduce a la mitad el número de cromosomas.',
      'La meiosis',
      ['La mitosis', 'La fotosíntesis', 'La traducción'],
    ],
  ]),
  ...preguntasDe('CIE', 'Física', [
    [
      'facil',
      '¿Cuál es la unidad de fuerza en el Sistema Internacional?',
      'La fuerza se mide en newton.',
      'El newton',
      ['El joule', 'El watt', 'El pascal'],
    ],
    [
      'media',
      'Un auto recorre 100 km en 2 horas a rapidez constante. ¿Cuál es su rapidez?',
      'La rapidez es distancia dividida por tiempo: 100 : 2 = 50 km/h.',
      '50 km/h',
      ['25 km/h', '100 km/h', '200 km/h'],
    ],
    [
      'media',
      '¿Qué magnitud eléctrica se mide en ohm?',
      'La resistencia eléctrica se mide en ohm.',
      'La resistencia',
      ['La corriente', 'La potencia', 'La carga'],
    ],
    [
      'dificil',
      'Un objeto de 2 kg acelera a 3 m/s². ¿Cuál es la fuerza neta sobre él?',
      'Por la segunda ley de Newton: F = m · a = 2 · 3 = 6 N.',
      '6 N',
      ['5 N', '1,5 N', '12 N'],
    ],
  ]),
  ...preguntasDe('CIE', 'Química', [
    [
      'facil',
      '¿Cuál es el símbolo químico del sodio?',
      'El símbolo del sodio es Na.',
      'Na',
      ['So', 'S', 'N'],
    ],
    [
      'media',
      '¿Cuántos átomos tiene una molécula de agua (H₂O)?',
      'Tiene 2 átomos de hidrógeno y 1 de oxígeno: 3 en total.',
      '3',
      ['1', '2', '4'],
    ],
    [
      'media',
      '¿Qué pH tiene una solución neutra a 25 °C?',
      'A 25 °C, una solución neutra tiene pH 7.',
      '7',
      ['0', '1', '14'],
    ],
    [
      'dificil',
      '¿Qué partícula determina el número atómico de un elemento?',
      'El número atómico es la cantidad de protones.',
      'El protón',
      ['El neutrón', 'El electrón de valencia', 'El fotón'],
    ],
  ]),
];
