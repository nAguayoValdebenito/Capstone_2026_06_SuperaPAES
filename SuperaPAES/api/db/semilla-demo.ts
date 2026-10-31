// Preguntas de ejemplo para probar la práctica en el emulador (TEC-07). SOLO DESARROLLO: no forma parte de
// las semillas de producción ni de migrar:produccion, y se niega con NODE_ENV=production.
// Son preguntas inventadas y sencillas, marcadas con [EJEMPLO] al inicio del enunciado, sin material ni
// facsímiles del DEMRE (RN-29). Se publican por las etapas reales (borrador, revisión, aprobada y
// publicada), así que las reglas y los triggers de la base las validan igual que a cualquier pregunta.
import { conBloqueo } from './bloqueo.js';
import { ejecutarEnTransaccion, type Ejecutor } from './transaccion.js';

/** Aparece al inicio de cada enunciado y del texto de lectura: nadie confunde estas preguntas con el banco real. */
export const MARCA_EJEMPLO = '[EJEMPLO]';

/** Clave fija del bloqueo que evita dos cargas de ejemplo al mismo tiempo. */
const CLAVE_BLOQUEO = 20270103;

export class ErrorSemillaDemo extends Error {
  override name = 'ErrorSemillaDemo';
}

interface Alternativa {
  texto: string;
  explicacion: string;
}

interface PreguntaDeEjemplo {
  prueba: string;
  dificultad: 'facil' | 'media' | 'dificil';
  enunciado: string;
  explicacion: string;
  /** La primera es la correcta (letra A). */
  alternativas: [Alternativa, Alternativa, Alternativa, Alternativa];
  /** Solo Competencia Lectora: cada pregunta va ligada a un texto (RN-08). */
  texto?: { titulo: string; contenido: string };
}

const PREGUNTAS: readonly PreguntaDeEjemplo[] = [
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

const LETRAS = ['A', 'B', 'C', 'D'] as const;

export interface ResultadoSemillaDemo {
  /** Códigos de las pruebas para las que se creó una pregunta en esta ejecución. */
  creadas: string[];
  /** Códigos de las pruebas que ya tenían su pregunta de ejemplo. */
  existentes: string[];
}

async function tieneEjemplo(bd: Ejecutor, prueba: string): Promise<boolean> {
  const { rows } = await bd.query(
    `SELECT 1 FROM contenido.pregunta p JOIN contenido.prueba pr ON pr.id = p.prueba_id
      WHERE pr.codigo = $1 AND p.enunciado LIKE $2 || '%' LIMIT 1`,
    [prueba, MARCA_EJEMPLO],
  );
  return rows.length > 0;
}

async function crearTexto(bd: Ejecutor, texto: { titulo: string; contenido: string }) {
  const { rows } = await bd.query<{ id: string }>(
    `INSERT INTO contenido.texto_estimulo (tipo_texto_id, titulo, contenido, creado_en)
     SELECT id, $1, $2, now() FROM contenido.tipo_texto ORDER BY id LIMIT 1 RETURNING id::text`,
    [texto.titulo, texto.contenido],
  );
  const id = rows[0]?.id;
  if (!id) throw new ErrorSemillaDemo('Falta el tipo de texto del temario.');
  return id;
}

/** La pregunta nace en borrador, con el contenido del curso más bajo de la prueba: lo ve cualquier estudiante (RN-24). */
async function crearPregunta(bd: Ejecutor, pregunta: PreguntaDeEjemplo, textoId: string | null) {
  const { rows } = await bd.query<{ id: string }>(
    `INSERT INTO contenido.pregunta
       (prueba_id, contenido_id, habilidad_id, tipo_pregunta_id, texto_estimulo_id, orden_en_texto,
        enunciado, explicacion, estado_pregunta_id, creado_en, actualizado_en)
     SELECT pr.id, c.id, h.id, t.id, $2::bigint, CASE WHEN $2::bigint IS NULL THEN NULL ELSE 1 END,
            $3, $4, e.id, now(), now()
       FROM contenido.prueba pr
       JOIN LATERAL (SELECT c.id FROM contenido.contenido_tematico c
                       LEFT JOIN contenido.nivel_escolar n ON n.id = c.nivel_escolar_id
                      WHERE c.prueba_id = pr.id ORDER BY n.orden NULLS LAST, c.id LIMIT 1) c ON true
       JOIN LATERAL (SELECT id FROM contenido.habilidad WHERE prueba_id = pr.id ORDER BY id LIMIT 1) h ON true
       CROSS JOIN contenido.tipo_pregunta t CROSS JOIN contenido.estado_pregunta e
      WHERE pr.codigo = $1 AND t.codigo = 'seleccion_multiple' AND e.codigo = 'borrador'
     RETURNING id::text`,
    [pregunta.prueba, textoId, pregunta.enunciado, pregunta.explicacion],
  );
  const id = rows[0]?.id;
  if (!id) throw new ErrorSemillaDemo(`Falta el temario de la prueba ${pregunta.prueba}.`);
  return id;
}

async function crearAlternativas(bd: Ejecutor, preguntaId: string, pregunta: PreguntaDeEjemplo) {
  for (const [indice, alternativa] of pregunta.alternativas.entries()) {
    await bd.query(
      `INSERT INTO contenido.alternativa (pregunta_id, letra, texto, es_correcta, explicacion)
       VALUES ($1, $2, $3, $4, $5)`,
      [preguntaId, LETRAS[indice], alternativa.texto, indice === 0, alternativa.explicacion],
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

/**
 * Carga las preguntas de ejemplo que falten, en una sola transacción. Idempotente: una prueba que ya
 * tiene su pregunta [EJEMPLO] se deja como está. Se niega con NODE_ENV=production.
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
      const resultado: ResultadoSemillaDemo = { creadas: [], existentes: [] };
      for (const pregunta of PREGUNTAS) {
        if (await tieneEjemplo(tx, pregunta.prueba)) {
          resultado.existentes.push(pregunta.prueba);
          continue;
        }
        const textoId = pregunta.texto ? await crearTexto(tx, pregunta.texto) : null;
        const id = await crearPregunta(tx, pregunta, textoId);
        await crearAlternativas(tx, id, pregunta);
        await publicar(tx, id, pregunta.dificultad);
        resultado.creadas.push(pregunta.prueba);
      }
      return resultado;
    }),
  );
}
