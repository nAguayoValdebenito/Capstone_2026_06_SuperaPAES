// Preguntas de ejemplo de Competencia Lectora: 3 textos inventados con 5 preguntas cada uno, 5 por habilidad y con
// la mezcla de RN-09, para que alcancen para practicar y para el diagnóstico (RN-08). No son material del DEMRE
// (RN-29).
import { MARCA_EJEMPLO, preguntaDe, type DatosPregunta, type PreguntaDeEjemplo } from './tipos.js';

const LITERARIO = 'Textos literarios (narraciones)';
const NO_LITERARIO = 'Textos no literarios (expositivos y argumentativos)';

const MAREA = {
  titulo: `${MARCA_EJEMPLO} La marea de Antonia`,
  contenido:
    `${MARCA_EJEMPLO} Texto inventado para probar la app. Antonia bajó a la caleta antes del amanecer, ` +
    'como todos los martes, con el termo de su abuelo bajo el brazo. El bote ya no salía desde que él ' +
    'enfermó, pero ella seguía revisando las amarras. Esa mañana encontró una cuerda nueva, atada con ' +
    'el nudo que solo dos personas conocían. Miró hacia la casa y vio la lámpara encendida. Sonrió, ' +
    'guardó el termo y empezó a preparar las redes.',
};

const ABEJAS = {
  titulo: `${MARCA_EJEMPLO} Las abejas de la ciudad`,
  contenido:
    `${MARCA_EJEMPLO} Texto inventado para probar la app. En los últimos años, varias ciudades instalaron ` +
    'colmenas en techos y parques. Quienes las cuidan explican que las abejas urbanas encuentran flores ' +
    'durante más meses, porque los jardines se riegan todo el año. Sin embargo, los especialistas advierten ' +
    'que demasiadas colmenas pueden dejar sin alimento a las abejas silvestres. Por eso recomiendan plantar ' +
    'especies nativas antes de instalar nuevas colmenas.',
};

const PANTALLAS = {
  titulo: `${MARCA_EJEMPLO} Un recreo sin pantallas`,
  contenido:
    `${MARCA_EJEMPLO} Texto inventado para probar la app. Nuestro colegio debería prohibir los celulares ` +
    'durante los recreos. Desde que un curso lo probó por un mes, sus estudiantes volvieron a usar la ' +
    'cancha y la biblioteca. Algunos dicen que el teléfono es necesario para avisar a la familia, pero ' +
    'la secretaría ya recibe esos llamados. No se trata de castigar a nadie, sino de recuperar quince ' +
    'minutos para mirarnos a la cara.',
};

const LOCALIZAR = { habilidad: 'Localizar', dificultad: 'facil' } as const;
const INTERPRETAR = { habilidad: 'Interpretar', dificultad: 'media' } as const;
const EVALUAR = { habilidad: 'Evaluar', dificultad: 'dificil' } as const;

type Datos = Omit<DatosPregunta, 'texto' | 'eje' | 'habilidad'>;

const DE_LA_MAREA: readonly Datos[] = [
  {
    ...LOCALIZAR,
    enunciado: '¿Qué llevaba Antonia bajo el brazo?',
    explicacion: 'El texto dice que llevaba el termo de su abuelo.',
    correcta: ['El termo de su abuelo', 'Correcta: lo dice el texto.'],
    errores: [
      ['Una lámpara', 'La lámpara estaba en la casa.'],
      ['Una cuerda nueva', 'La cuerda la encontró en el bote.'],
      ['Las redes', 'Las redes las prepara al final.'],
    ],
  },
  {
    ...LOCALIZAR,
    enunciado: '¿Qué día bajaba Antonia a la caleta?',
    explicacion: 'El texto dice «como todos los martes».',
    correcta: ['Los martes', 'Correcta: lo dice el texto.'],
    errores: [
      ['Los domingos', 'El texto no lo menciona.'],
      ['Todos los días', 'El texto solo menciona los martes.'],
      ['Solo cuando había marea alta', 'El texto no lo menciona.'],
    ],
  },
  {
    ...INTERPRETAR,
    enunciado: '¿Qué se puede inferir del nudo de la cuerda nueva?',
    explicacion: 'Solo dos personas conocían el nudo, y una era Antonia.',
    correcta: ['Lo ató su abuelo', 'Correcta: era la otra persona que conocía el nudo.'],
    errores: [
      ['Lo ató un pescador vecino', 'El texto dice que solo dos personas lo conocían.'],
      ['Se ató por accidente', 'El texto habla de un nudo conocido.'],
      ['Lo ató ella el martes anterior', 'Era una cuerda nueva para ella.'],
    ],
  },
  {
    ...INTERPRETAR,
    enunciado: '¿Por qué Antonia sonríe al ver la lámpara encendida?',
    explicacion: 'La lámpara y el nudo le indican que su abuelo está mejor.',
    correcta: ['Entiende que su abuelo se recuperó', 'Correcta: es lo que sugiere el texto.'],
    errores: [
      ['Le gusta la luz del amanecer', 'El texto no habla de eso.'],
      ['Olvidó apagarla al salir', 'No hay nada que lo indique.'],
      ['Quiere volver a su casa', 'Al contrario: se queda a preparar las redes.'],
    ],
  },
  {
    ...EVALUAR,
    enunciado: '¿Qué efecto produce que el texto no diga directamente que el abuelo mejoró?',
    explicacion: 'El lector lo descubre por las pistas, junto con Antonia.',
    correcta: ['El lector lo descubre junto con Antonia', 'Correcta: comparte su sorpresa.'],
    errores: [
      ['Vuelve confuso el final', 'Las pistas son claras.'],
      ['Hace que el relato sea triste', 'El final es esperanzador.'],
      ['Oculta quién es la protagonista', 'La protagonista se nombra desde el inicio.'],
    ],
  },
];

const DE_LAS_ABEJAS: readonly Datos[] = [
  {
    ...LOCALIZAR,
    enunciado: '¿Dónde se instalaron colmenas en las ciudades?',
    explicacion: 'El texto menciona techos y parques.',
    correcta: ['En techos y parques', 'Correcta: lo dice el texto.'],
    errores: [
      ['En colegios', 'El texto no los menciona.'],
      ['En plazas de juegos', 'El texto no las menciona.'],
      ['En edificios públicos', 'El texto no los menciona.'],
    ],
  },
  {
    ...LOCALIZAR,
    enunciado: '¿Qué recomiendan los especialistas?',
    explicacion: 'Recomiendan plantar especies nativas antes de instalar más colmenas.',
    correcta: ['Plantar especies nativas', 'Correcta: lo dice el texto.'],
    errores: [
      ['Retirar las colmenas', 'El texto no lo propone.'],
      ['Regar menos los jardines', 'El texto no lo propone.'],
      ['Instalar más colmenas', 'Advierten justamente sobre eso.'],
    ],
  },
  {
    ...INTERPRETAR,
    enunciado: '¿Qué relación hay entre las abejas urbanas y las silvestres según el texto?',
    explicacion: 'Si hay demasiadas colmenas, compiten por el alimento.',
    correcta: ['Compiten por el alimento', 'Correcta: es lo que advierten los especialistas.'],
    errores: [
      ['Se ayudan a encontrar flores', 'El texto no lo dice.'],
      ['Viven en las mismas colmenas', 'El texto no lo dice.'],
      ['No tienen ninguna relación', 'El texto las relaciona por el alimento.'],
    ],
  },
  {
    ...EVALUAR,
    enunciado: '¿Cuál es el propósito principal del texto?',
    explicacion: 'Presenta una práctica, muestra un riesgo y propone cómo evitarlo.',
    correcta: ['Informar sobre una práctica y sus riesgos', 'Correcta: resume todo el texto.'],
    errores: [
      ['Convencer de eliminar las colmenas', 'No pide eliminarlas.'],
      ['Narrar la vida de un apicultor', 'No es una narración.'],
      ['Enseñar a cuidar una colmena', 'No da instrucciones de cuidado.'],
    ],
  },
  {
    ...EVALUAR,
    dificultad: 'media',
    enunciado: '¿Qué función cumple la palabra «Sin embargo» en el texto?',
    explicacion: 'Introduce un riesgo después de presentar una ventaja.',
    correcta: ['Introduce una idea que se opone a la anterior', 'Correcta: marca el contraste.'],
    errores: [
      ['Agrega un ejemplo', 'No presenta un ejemplo.'],
      ['Indica el orden en el tiempo', 'No habla del tiempo.'],
      ['Resume lo que se dijo', 'No es un resumen.'],
    ],
  },
];

const DE_LAS_PANTALLAS: readonly Datos[] = [
  {
    ...LOCALIZAR,
    enunciado: '¿Por cuánto tiempo un curso probó la medida?',
    explicacion: 'El texto dice que lo probó por un mes.',
    correcta: ['Un mes', 'Correcta: lo dice el texto.'],
    errores: [
      ['Quince minutos', 'Es lo que dura el recreo.'],
      ['Un año', 'El texto no lo dice.'],
      ['Una semana', 'El texto no lo dice.'],
    ],
  },
  {
    ...INTERPRETAR,
    enunciado: '¿Qué objeción se responde en el texto?',
    explicacion: 'Se responde que la secretaría ya recibe los llamados de las familias.',
    correcta: ['Que el teléfono sirve para avisar a la familia', 'Correcta: es la objeción.'],
    errores: [
      ['Que la biblioteca está cerrada', 'El texto no lo dice.'],
      ['Que la cancha es muy chica', 'El texto no lo dice.'],
      ['Que el recreo es muy corto', 'El texto no lo presenta como objeción.'],
    ],
  },
  {
    ...INTERPRETAR,
    enunciado: '¿Qué significa «mirarnos a la cara» en el texto?',
    explicacion: 'Se refiere a volver a conversar y compartir en persona.',
    correcta: ['Compartir en persona', 'Correcta: es el sentido de la frase.'],
    errores: [
      ['Vigilar a los compañeros', 'No tiene ese sentido.'],
      ['Tomarse fotografías', 'Es lo contrario de lo que plantea.'],
      ['Discutir un problema', 'El texto no habla de discusiones.'],
    ],
  },
  {
    ...EVALUAR,
    dificultad: 'media',
    enunciado: '¿Qué tipo de argumento usa el texto al mencionar al curso que probó la medida?',
    explicacion: 'Presenta una experiencia concreta como evidencia.',
    correcta: ['Un ejemplo de una experiencia', 'Correcta: usa un caso como evidencia.'],
    errores: [
      ['La opinión de un experto', 'No cita a ningún experto.'],
      ['Una estadística nacional', 'No entrega cifras nacionales.'],
      ['Una norma legal', 'No menciona ninguna ley.'],
    ],
  },
  {
    ...EVALUAR,
    enunciado: '¿Con qué propósito el autor aclara que «no se trata de castigar a nadie»?',
    explicacion: 'Busca que la medida no se entienda como una sanción.',
    correcta: ['Para que la medida no se vea como una sanción', 'Correcta: anticipa ese rechazo.'],
    errores: [
      ['Para pedir disculpas', 'No se disculpa.'],
      ['Para cambiar de opinión', 'Mantiene su postura.'],
      ['Para describir el reglamento', 'No describe ningún reglamento.'],
    ],
  },
];

const delTexto = (
  texto: NonNullable<DatosPregunta['texto']>,
  eje: string,
  datos: readonly Datos[],
): PreguntaDeEjemplo[] => datos.map((pregunta) => preguntaDe('CL', { ...pregunta, eje, texto }));

export const PREGUNTAS_LECTORA: readonly PreguntaDeEjemplo[] = [
  ...delTexto(MAREA, LITERARIO, DE_LA_MAREA),
  ...delTexto(ABEJAS, NO_LITERARIO, DE_LAS_ABEJAS),
  ...delTexto(PANTALLAS, NO_LITERARIO, DE_LAS_PANTALLAS),
];
