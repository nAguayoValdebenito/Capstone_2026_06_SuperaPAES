// Preguntas de ejemplo de M1 y M2, armadas con plantillas: 8 por eje (3 fáciles, 3 medias y 2 difíciles), para
// que alcancen para practicar, el diagnóstico y el mini-ensayo. Son ejercicios inventados, no material del
// DEMRE (RN-29). Cada plantilla recibe un número que cambia los valores de la pregunta.
import { preguntaDe, type DatosPregunta, type PreguntaDeEjemplo } from './tipos.js';

type Plantilla = (n: number) => Omit<DatosPregunta, 'dificultad' | 'eje'>;

interface PlantillasDeEje {
  eje: string;
  facil: Plantilla;
  media: Plantilla;
  dificil: Plantilla;
}

const NUMEROS: PlantillasDeEje = {
  eje: 'Números',
  facil: (n) => {
    const [a, b, c] = [n + 2, n + 1, 3];
    const valor = a + b * c;
    return {
      enunciado: `¿Cuál es el resultado de ${a} + ${b} · ${c}?`,
      explicacion: `Primero se multiplica: ${b} · ${c} = ${b * c}. Luego se suma ${a}.`,
      correcta: [`${valor}`, `Correcta: ${a} + ${b * c} = ${valor}.`],
      errores: [
        [`${(a + b) * c}`, 'Se sumó antes de multiplicar.'],
        [`${a + b + c}`, 'Se sumó en vez de multiplicar.'],
        [`${valor + 1}`, 'Sobra una unidad.'],
      ],
    };
  },
  media: (n) => {
    const base = 40 * n;
    return {
      enunciado: `¿Cuánto es el 25 % de ${base}?`,
      explicacion: `El 25 % es la cuarta parte: ${base} : 4 = ${base / 4}.`,
      correcta: [`${base / 4}`, 'Correcta: es la cuarta parte.'],
      errores: [
        [`${base / 2}`, 'Es el 50 %.'],
        [`${(base * 3) / 4}`, 'Es el 75 %.'],
        [`${base / 5}`, 'Es el 20 %.'],
      ],
    };
  },
  dificil: (n) => {
    const [a, b] = [n + 5, n + 2];
    const valor = a * a - b * b;
    return {
      enunciado: `¿Cuál es el valor de ${a}² − ${b}²?`,
      explicacion: `${a * a} − ${b * b} = ${valor}.`,
      correcta: [`${valor}`, `Correcta: ${a * a} − ${b * b} = ${valor}.`],
      errores: [
        [`${(a - b) * (a - b)}`, 'Se restó antes de elevar al cuadrado.'],
        [`${a * a + b * b}`, 'Se sumaron los cuadrados.'],
        [`${a * a - b}`, `Faltó elevar ${b} al cuadrado.`],
      ],
    };
  },
};

const ALGEBRA: PlantillasDeEje = {
  eje: 'Álgebra y funciones',
  facil: (n) => {
    const [a, b] = [n + 3, 2 * n + 10];
    return {
      enunciado: `Si x + ${a} = ${b}, ¿cuál es el valor de x?`,
      explicacion: `Se resta ${a} a ambos lados: x = ${b} − ${a} = ${b - a}.`,
      correcta: [`${b - a}`, `Correcta: ${b - a} + ${a} = ${b}.`],
      errores: [
        [`${a + b}`, 'Se sumó en vez de restar.'],
        [`${b}`, 'No se despejó x.'],
        [`${b - a - 1}`, 'Falta una unidad.'],
      ],
    };
  },
  media: (n) => {
    const x = n + 3;
    const c = 2 * x + n;
    return {
      enunciado: `Si 2x + ${n} = ${c}, ¿cuál es el valor de x?`,
      explicacion: `2x = ${c} − ${n} = ${2 * x}, por lo que x = ${x}.`,
      correcta: [`${x}`, `Correcta: 2 · ${x} + ${n} = ${c}.`],
      errores: [
        [`${2 * x}`, 'Faltó dividir por 2.'],
        [`${x + n}`, `Se sumó ${n} en vez de restarlo.`],
        [`${x - 1}`, 'Falta una unidad.'],
      ],
    };
  },
  dificil: (n) => {
    const c = n + 2;
    const valor = c * c + n;
    return {
      enunciado: `Si f(x) = x² + ${n}, ¿cuánto vale f(${c})?`,
      explicacion: `Se reemplaza x por ${c}: ${c}² + ${n} = ${valor}.`,
      correcta: [`${valor}`, `Correcta: ${c * c} + ${n} = ${valor}.`],
      errores: [
        [`${2 * c + n}`, 'Se multiplicó por 2 en vez de elevar al cuadrado.'],
        [`${c * c - n}`, 'Se restó en vez de sumar.'],
        [`${(c + n) * (c + n)}`, 'Se sumó antes de elevar al cuadrado.'],
      ],
    };
  },
};

const GEOMETRIA: PlantillasDeEje = {
  eje: 'Geometría',
  facil: (n) => {
    const [largo, ancho] = [n + 4, n + 2];
    const valor = 2 * (largo + ancho);
    return {
      enunciado: `¿Cuál es el perímetro de un rectángulo de ${largo} cm de largo y ${ancho} cm de ancho?`,
      explicacion: `El perímetro suma los cuatro lados: 2 · (${largo} + ${ancho}) = ${valor} cm.`,
      correcta: [`${valor} cm`, 'Correcta: suma los cuatro lados.'],
      errores: [
        [`${largo + ancho} cm`, 'Solo suma dos lados.'],
        [`${largo * ancho} cm`, 'Es el valor del área.'],
        [`${2 * largo + ancho} cm`, 'Falta un lado.'],
      ],
    };
  },
  media: (n) => {
    const [base, altura] = [2 * n + 4, n + 3];
    const valor = (base * altura) / 2;
    return {
      enunciado: `¿Cuál es el área de un triángulo de base ${base} cm y altura ${altura} cm?`,
      explicacion: `El área es base por altura dividido por 2: ${base} · ${altura} : 2 = ${valor} cm².`,
      correcta: [`${valor} cm²`, 'Correcta: base por altura, dividido por 2.'],
      errores: [
        [`${base * altura} cm²`, 'Faltó dividir por 2.'],
        [`${base + altura} cm²`, 'Se sumó en vez de multiplicar.'],
        [`${2 * (base + altura)} cm²`, 'Se calculó el doble de la suma.'],
      ],
    };
  },
  dificil: (n) => {
    const [a, b, c] = [3 * n, 4 * n, 5 * n];
    return {
      enunciado: `Un triángulo rectángulo tiene catetos de ${a} cm y ${b} cm. ¿Cuánto mide su hipotenusa?`,
      explicacion: `Por Pitágoras: ${a}² + ${b}² = ${c * c}, y la raíz es ${c}.`,
      correcta: [`${c} cm`, `Correcta: ${c}² = ${a}² + ${b}².`],
      errores: [
        [`${a + b} cm`, 'Se sumaron los catetos.'],
        [`${c * c} cm`, 'Faltó sacar la raíz.'],
        [`${c + 1} cm`, 'Sobra una unidad.'],
      ],
    };
  },
};

const PROBABILIDAD: PlantillasDeEje = {
  eje: 'Probabilidad y estadística',
  facil: (n) => {
    const [a, b, c] = [n + 2, n + 4, n + 6];
    return {
      enunciado: `¿Cuál es el promedio de ${a}, ${b} y ${c}?`,
      explicacion: `Se suman y se divide por 3: ${a + b + c} : 3 = ${b}.`,
      correcta: [`${b}`, 'Correcta: es la suma dividida por 3.'],
      errores: [
        [`${a + b + c}`, 'Faltó dividir por 3.'],
        [`${c}`, 'Es el dato mayor.'],
        [`${a}`, 'Es el dato menor.'],
      ],
    };
  },
  media: (n) => {
    const [rojas, azules] = [n + 1, n + 2];
    const total = rojas + azules;
    return {
      enunciado: `Una caja tiene ${rojas} bolitas rojas y ${azules} azules. Si se saca una al azar, ¿cuál es la probabilidad de que sea roja?`,
      explicacion: `Hay ${rojas} casos favorables de ${total} posibles.`,
      correcta: [`${rojas}/${total}`, 'Correcta: favorables sobre posibles.'],
      errores: [
        [`${azules}/${total}`, 'Es la probabilidad de sacar una azul.'],
        [`${rojas}/${azules}`, 'Compara rojas con azules, no con el total.'],
        [`1/${total}`, 'Es la probabilidad de sacar una bolita determinada.'],
      ],
    };
  },
  dificil: (n) => {
    const datos = [n + 10, n, n + 20, n + 3, n + 9];
    return {
      enunciado: `¿Cuál es la mediana de los datos ${datos.join(', ')}?`,
      explicacion: `Ordenados de menor a mayor, el dato del centro es ${n + 9}.`,
      correcta: [`${n + 9}`, 'Correcta: es el dato central de la lista ordenada.'],
      errores: [
        [`${n + 20}`, 'Es el dato central sin ordenar la lista.'],
        [`${n + 10}`, 'Es el dato que sigue a la mediana.'],
        [`${n + 3}`, 'Es el dato anterior a la mediana.'],
      ],
    };
  },
};

const EJES = [NUMEROS, ALGEBRA, GEOMETRIA, PROBABILIDAD];

function delEje(prueba: string, plantillas: PlantillasDeEje, numeros: readonly number[]) {
  const { eje, facil, media, dificil } = plantillas;
  const armar = (dificultad: DatosPregunta['dificultad'], plantilla: Plantilla, n: number) =>
    preguntaDe(prueba, { ...plantilla(n), dificultad, eje });
  const [uno = 0, dos = 0, tres = 0] = numeros;
  return [
    armar('facil', facil, uno),
    armar('facil', facil, dos),
    armar('facil', facil, tres),
    armar('media', media, uno),
    armar('media', media, dos),
    armar('media', media, tres),
    armar('dificil', dificil, uno),
    armar('dificil', dificil, dos),
  ];
}

export const PREGUNTAS_MATEMATICAS: readonly PreguntaDeEjemplo[] = [
  ...EJES.flatMap((eje) => delEje('M1', eje, [1, 2, 3])),
  ...EJES.flatMap((eje) => delEje('M2', eje, [4, 5, 6])),
];
