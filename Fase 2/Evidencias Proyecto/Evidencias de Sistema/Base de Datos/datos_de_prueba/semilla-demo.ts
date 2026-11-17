// Preguntas de ejemplo para probar y mostrar la app (TEC-07, paso 66). SOLO DESARROLLO: no forma parte de
// las semillas de producción ni de migrar:produccion, y se niega con NODE_ENV=production.
// Son preguntas inventadas y sencillas, marcadas con [EJEMPLO] al inicio del enunciado, sin material ni
// facsímiles del DEMRE (RN-29). Se publican por las etapas reales (borrador, revisión, aprobada y
// publicada), así que las reglas y los triggers de la base las validan igual que a cualquier pregunta.
import { conBloqueo } from './bloqueo.js';
import { PREGUNTAS_CIENCIAS, PREGUNTAS_HISTORIA } from './demo/humanidades-ciencias.js';
import { PREGUNTAS_LECTORA } from './demo/lectora.js';
import { PREGUNTAS_MATEMATICAS } from './demo/matematicas.js';
import { MARCA_EJEMPLO, type PreguntaDeEjemplo } from './demo/tipos.js';
import { ejecutarEnTransaccion, type Ejecutor } from './transaccion.js';

export { MARCA_EJEMPLO };

/** Clave fija del bloqueo que evita dos cargas de ejemplo al mismo tiempo. */
const CLAVE_BLOQUEO = 20270103;

export class ErrorSemillaDemo extends Error {
  override name = 'ErrorSemillaDemo';
}

const BASICAS: readonly PreguntaDeEjemplo[] = [
  {
    prueba: 'CL',
    dificultad: 'facil',
    enunciado: `${MARCA_EJEMPLO} Según el texto, ¿qué hizo Lía al llegar a casa?`,
    explicacion: 'El texto dice que Lía regó las plantas apenas llegó.',
    texto: {
      titulo: `${MARCA_EJEMPLO} Una tarde de lluvia`,
      contenido:
        `${MARCA_EJEMPLO} Texto inventado para probar la app. Lía volvió a casa bajo la lluvia. ` +
        'Apenas llegó, regó las plantas del balcón y después preparó un té caliente.',
    },
    alternativas: [
      { texto: 'Regó las plantas.', explicacion: 'Correcta: es lo primero que hizo.' },
      { texto: 'Salió a pasear.', explicacion: 'El texto no dice que haya vuelto a salir.' },
      { texto: 'Limpió la cocina.', explicacion: 'No se menciona la limpieza.' },
      { texto: 'Llamó a una amiga.', explicacion: 'No se menciona ninguna llamada.' },
    ],
  },
  {
    prueba: 'M1',
    dificultad: 'facil',
    enunciado: `${MARCA_EJEMPLO} ¿Cuál es el resultado de 7 + 5?`,
    explicacion: 'Se suman las unidades: 7 + 5 = 12.',
    alternativas: [
      { texto: '12', explicacion: 'Correcta: 7 + 5 = 12.' },
      { texto: '11', explicacion: 'Falta una unidad al sumar.' },
      { texto: '13', explicacion: 'Sobra una unidad al sumar.' },
      { texto: '35', explicacion: 'Es el producto 7 · 5, no la suma.' },
    ],
  },
  {
    prueba: 'M2',
    dificultad: 'media',
    enunciado: `${MARCA_EJEMPLO} Si f(x) = 2x + 1, ¿cuánto vale f(3)?`,
    explicacion: 'Se reemplaza x por 3: 2 · 3 + 1 = 7.',
    alternativas: [
      { texto: '7', explicacion: 'Correcta: 2 · 3 + 1 = 7.' },
      { texto: '6', explicacion: 'Se olvidó sumar 1.' },
      { texto: '9', explicacion: 'Se calculó 3 · 3, no 2 · 3.' },
      { texto: '5', explicacion: 'Se calculó 3 + 2, no 2 · 3 + 1.' },
    ],
  },
  {
    prueba: 'HCS',
    dificultad: 'facil',
    enunciado: `${MARCA_EJEMPLO} ¿Cuál es la capital de Chile?`,
    explicacion: 'La capital de Chile es Santiago.',
    alternativas: [
      { texto: 'Santiago', explicacion: 'Correcta: es la capital.' },
      { texto: 'Valparaíso', explicacion: 'Allí funciona el Congreso, pero no es la capital.' },
      { texto: 'Concepción', explicacion: 'Es una ciudad importante del sur, no la capital.' },
      { texto: 'La Serena', explicacion: 'Es una ciudad del norte, no la capital.' },
    ],
  },
  {
    prueba: 'CIE',
    dificultad: 'dificil',
    enunciado: `${MARCA_EJEMPLO} ¿Qué gas absorben las plantas del aire durante la fotosíntesis?`,
    explicacion: 'Las plantas toman dióxido de carbono y liberan oxígeno.',
    alternativas: [
      { texto: 'Dióxido de carbono', explicacion: 'Correcta: es la materia prima del proceso.' },
      { texto: 'Oxígeno', explicacion: 'El oxígeno es lo que liberan.' },
      {
        texto: 'Nitrógeno',
        explicacion: 'Está en el aire, pero no es el que usan para la fotosíntesis.',
      },
      { texto: 'Helio', explicacion: 'No participa en la fotosíntesis.' },
    ],
  },
];

/** Todas las preguntas de ejemplo: alcanzan para practicar en cada prueba, y más en Matemática y Lectora. */
export const PREGUNTAS_DE_EJEMPLO: readonly PreguntaDeEjemplo[] = [
  ...BASICAS,
  ...PREGUNTAS_MATEMATICAS,
  ...PREGUNTAS_LECTORA,
  ...PREGUNTAS_HISTORIA,
  ...PREGUNTAS_CIENCIAS,
];

const LETRAS = ['A', 'B', 'C', 'D'] as const;

export interface ResultadoSemillaDemo {
  /** Códigos de las pruebas con alguna pregunta nueva en esta ejecución. */
  creadas: string[];
  /** Códigos de las pruebas con alguna pregunta que ya estaba. */
  existentes: string[];
  /** Cuántas preguntas se crearon en esta ejecución. */
  preguntasNuevas: number;
}

async function yaExiste(bd: Ejecutor, { prueba, enunciado }: PreguntaDeEjemplo): Promise<boolean> {
  const { rows } = await bd.query(
    `SELECT 1 FROM contenido.pregunta p JOIN contenido.prueba pr ON pr.id = p.prueba_id
      WHERE pr.codigo = $1 AND p.enunciado = $2 LIMIT 1`,
    [prueba, enunciado],
  );
  return rows.length > 0;
}

interface TextoDeLaPregunta {
  id: string;
  orden: number;
}

/** El texto de la pregunta, que varias comparten, y el orden de esta pregunta dentro de él. */
async function textoDe(
  bd: Ejecutor,
  texto: NonNullable<PreguntaDeEjemplo['texto']>,
): Promise<TextoDeLaPregunta> {
  const { rows } = await bd.query<TextoDeLaPregunta>(
    `SELECT t.id::text AS id,
            (SELECT COALESCE(MAX(p.orden_en_texto), 0)::int + 1 FROM contenido.pregunta p
              WHERE p.texto_estimulo_id = t.id) AS orden
       FROM contenido.texto_estimulo t WHERE t.titulo = $1 LIMIT 1`,
    [texto.titulo],
  );
  const existente = rows[0];
  if (existente) return existente;
  const { rows: creado } = await bd.query<{ id: string }>(
    `INSERT INTO contenido.texto_estimulo (tipo_texto_id, titulo, contenido, creado_en)
     SELECT id, $1, $2, now() FROM contenido.tipo_texto ORDER BY id LIMIT 1 RETURNING id::text`,
    [texto.titulo, texto.contenido],
  );
  const id = creado[0]?.id;
  if (!id) throw new ErrorSemillaDemo('Falta el tipo de texto del temario.');
  return { id, orden: 1 };
}

/**
 * La pregunta nace en borrador, con el contenido del curso más bajo de su eje, o de la prueba si no indica
 * uno: lo ve cualquier estudiante.
 */
async function crearPregunta(
  bd: Ejecutor,
  pregunta: PreguntaDeEjemplo,
  texto: TextoDeLaPregunta | null,
) {
  const { rows } = await bd.query<{ id: string }>(
    `INSERT INTO contenido.pregunta
       (prueba_id, contenido_id, habilidad_id, tipo_pregunta_id, texto_estimulo_id, orden_en_texto,
        enunciado, explicacion, estado_pregunta_id, creado_en, actualizado_en)
     SELECT pr.id, c.id, h.id, t.id, $2::bigint, $3::smallint, $4, $5, e.id, now(), now()
       FROM contenido.prueba pr
       JOIN LATERAL (SELECT c.id FROM contenido.contenido_tematico c
                       LEFT JOIN contenido.nivel_escolar n ON n.id = c.nivel_escolar_id
                       JOIN contenido.eje_tematico ej ON ej.id = c.eje_id
                      WHERE c.prueba_id = pr.id AND ($6::text IS NULL OR ej.nombre = $6)
                      ORDER BY n.orden NULLS LAST, c.id LIMIT 1) c ON true
       JOIN LATERAL (SELECT id FROM contenido.habilidad
                      WHERE prueba_id = pr.id AND ($7::text IS NULL OR nombre = $7)
                      ORDER BY id LIMIT 1) h ON true
       CROSS JOIN contenido.tipo_pregunta t CROSS JOIN contenido.estado_pregunta e
      WHERE pr.codigo = $1 AND t.codigo = 'seleccion_multiple' AND e.codigo = 'borrador'
     RETURNING id::text`,
    [
      pregunta.prueba,
      texto?.id ?? null,
      texto?.orden ?? null,
      pregunta.enunciado,
      pregunta.explicacion,
      pregunta.eje ?? null,
      pregunta.habilidad ?? null,
    ],
  );
  const id = rows[0]?.id;
  if (!id) throw new ErrorSemillaDemo(`Falta el temario de la prueba ${pregunta.prueba}.`);
  return id;
}

/**
 * Cuántas letras se corre esta pregunta: sale de su enunciado, así que siempre es la misma. Si la correcta
 * fuera siempre la A, se notaría en la primera práctica.
 */
const desplazamiento = (enunciado: string) =>
  [...enunciado].reduce((suma, letra) => suma + (letra.codePointAt(0) ?? 0), 0) % LETRAS.length;

async function crearAlternativas(bd: Ejecutor, preguntaId: string, pregunta: PreguntaDeEjemplo) {
  const corrida = desplazamiento(pregunta.enunciado);
  for (const [indice, alternativa] of pregunta.alternativas.entries()) {
    await bd.query(
      `INSERT INTO contenido.alternativa (pregunta_id, letra, texto, es_correcta, explicacion)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        preguntaId,
        LETRAS[(indice + corrida) % LETRAS.length],
        alternativa.texto,
        indice === 0,
        alternativa.explicacion,
      ],
    );
  }
}

/** borrador → en_revision → aprobada → publicada, con la dificultad asignada, como exigen los triggers. */
async function publicar(bd: Ejecutor, preguntaId: string, dificultad: string) {
  for (const etapa of ['en_revision', 'aprobada', 'publicada']) {
    await bd.query(
      `UPDATE contenido.pregunta SET estado_pregunta_id = e.id, dificultad_asignada_id = d.id
         FROM contenido.estado_pregunta e, contenido.dificultad d
        WHERE pregunta.id = $1 AND e.codigo = $2 AND d.codigo = $3`,
      [preguntaId, etapa, dificultad],
    );
  }
}

async function crearLasQueFaltan(tx: Ejecutor): Promise<ResultadoSemillaDemo> {
  const creadas = new Set<string>();
  const existentes = new Set<string>();
  let preguntasNuevas = 0;
  for (const pregunta of PREGUNTAS_DE_EJEMPLO) {
    if (await yaExiste(tx, pregunta)) {
      existentes.add(pregunta.prueba);
      continue;
    }
    const texto = pregunta.texto ? await textoDe(tx, pregunta.texto) : null;
    const id = await crearPregunta(tx, pregunta, texto);
    await crearAlternativas(tx, id, pregunta);
    await publicar(tx, id, pregunta.dificultad);
    creadas.add(pregunta.prueba);
    preguntasNuevas += 1;
  }
  return { creadas: [...creadas], existentes: [...existentes], preguntasNuevas };
}

/**
 * Carga las preguntas de ejemplo que falten, en una sola transacción. Idempotente: una pregunta que ya
 * existe, por su prueba y su enunciado, se deja como está. Se niega con NODE_ENV=production.
 */
export async function sembrarPreguntasDeEjemplo(
  bd: Ejecutor,
  entorno: string | undefined,
): Promise<ResultadoSemillaDemo> {
  if (entorno === 'production') {
    throw new ErrorSemillaDemo(
      'La semilla de ejemplo es solo de desarrollo: no se ejecuta con NODE_ENV=production.',
    );
  }
  return conBloqueo(bd, CLAVE_BLOQUEO, () =>
    ejecutarEnTransaccion(bd, async (tx) => {
      const { rows } = await tx.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM contenido.prueba',
      );
      if ((rows[0]?.n ?? 0) === 0) {
        throw new ErrorSemillaDemo(
          'Falta el temario: ejecuta primero npm run semillas -w api (después de npm run migrar -w api).',
        );
      }
      return crearLasQueFaltan(tx);
    }),
  );
}
