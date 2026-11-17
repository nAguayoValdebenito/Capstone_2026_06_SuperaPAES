// Datos de prueba del banco de preguntas (HU-11) en una base temporal: un temario propio con dos
// pruebas, y preguntas que entran como borrador y cambian de estado con las transiciones permitidas.
import type pg from 'pg';

export interface Ids {
  pruebaA: number;
  pruebaB: number;
  ejeA1: number;
  ejeA2: number;
  contenidoA1a: number;
  contenidoA1b: number;
  contenidoA2: number;
  contenidoB: number;
}

export const uno = async (bd: pg.Client, sql: string, valores: unknown[] = []): Promise<number> => {
  const { rows } = await bd.query<{ id: number }>(sql, valores);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`Sin id: ${sql}`);
  return Number(id);
};

/** Dos pruebas de 4 alternativas sin textos; la A con dos ejes y tres contenidos. */
export async function crearTemario(
  bd: pg.Client,
): Promise<Ids & { habilidadA: number; habilidadA2: number; habilidadB: number }> {
  const area = await uno(
    bd,
    "INSERT INTO contenido.area (nombre) VALUES ('Área banco') RETURNING id",
  );
  const prueba = (codigo: string) =>
    uno(
      bd,
      `INSERT INTO contenido.prueba (codigo, nombre, total_preguntas, preguntas_puntuables,
         opciones_min, opciones_max, duracion_min)
       VALUES ($1, $2, 65, 60, 4, 4, 140) RETURNING id`,
      [codigo, `Prueba ${codigo}`],
    );
  const pruebaA = await prueba('TA');
  const pruebaB = await prueba('TB');
  await bd.query(
    `INSERT INTO contenido.prueba_tipo_pregunta (prueba_id, tipo_pregunta_id)
     SELECT p, t.id FROM unnest($1::smallint[]) p, contenido.tipo_pregunta t WHERE t.codigo = 'seleccion_multiple'`,
    [[pruebaA, pruebaB]],
  );
  const eje = (pruebaId: number, nombre: string, orden: number) =>
    uno(
      bd,
      'INSERT INTO contenido.eje_tematico (prueba_id, nombre, orden) VALUES ($1, $2, $3) RETURNING id',
      [pruebaId, nombre, orden],
    );
  const ejeA1 = await eje(pruebaA, 'Números', 1);
  const ejeA2 = await eje(pruebaA, 'Álgebra', 2);
  const ejeB = await eje(pruebaB, 'Datos', 1);
  const contenido = (ejeId: number, pruebaId: number, nombre: string) =>
    uno(
      bd,
      `INSERT INTO contenido.contenido_tematico (eje_id, prueba_id, area_id, nombre)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [ejeId, pruebaId, area, nombre],
    );
  const habilidad = (pruebaId: number, codigo = 'RES', nombre = 'Resolver') =>
    uno(
      bd,
      'INSERT INTO contenido.habilidad (prueba_id, codigo, nombre) VALUES ($1, $2, $3) RETURNING id',
      [pruebaId, codigo, nombre],
    );
  return {
    pruebaA,
    pruebaB,
    ejeA1,
    ejeA2,
    contenidoA1a: await contenido(ejeA1, pruebaA, 'Enteros'),
    contenidoA1b: await contenido(ejeA1, pruebaA, 'Potencias'),
    contenidoA2: await contenido(ejeA2, pruebaA, 'Ecuaciones'),
    contenidoB: await contenido(ejeB, pruebaB, 'Tablas'),
    habilidadA: await habilidad(pruebaA),
    habilidadA2: await habilidad(pruebaA, 'MOD', 'Modelar'),
    habilidadB: await habilidad(pruebaB),
  };
}

interface NuevaPregunta {
  pruebaId: number;
  contenidoId: number;
  habilidadId: number;
  loteId?: number;
  importacionId?: number;
  enunciado: string;
}

export async function crearPregunta(bd: pg.Client, p: NuevaPregunta): Promise<number> {
  return uno(
    bd,
    `INSERT INTO contenido.pregunta (prueba_id, contenido_id, habilidad_id, tipo_pregunta_id, enunciado,
       explicacion, lote_id, importacion_id, estado_pregunta_id, creado_en, actualizado_en)
     SELECT $1, $2, $3, t.id, $4, 'Explicación', $5, $6, e.id, now(), now()
       FROM contenido.tipo_pregunta t, contenido.estado_pregunta e
      WHERE t.codigo = 'seleccion_multiple' AND e.codigo = 'borrador'
     RETURNING id`,
    [
      p.pruebaId,
      p.contenidoId,
      p.habilidadId,
      p.enunciado,
      p.loteId ?? null,
      p.importacionId ?? null,
    ],
  );
}

/** Cuatro alternativas con una correcta: lo que la base exige para enviar a revisión. */
export async function enviarARevision(bd: pg.Client, preguntaId: number): Promise<void> {
  await bd.query(
    `INSERT INTO contenido.alternativa (pregunta_id, letra, texto, es_correcta)
     SELECT $1, l, 'Alternativa ' || l, l = 'A' FROM unnest(ARRAY['A', 'B', 'C', 'D']) l`,
    [preguntaId],
  );
  await cambiarEstado(bd, preguntaId, 'en_revision');
}

export async function cambiarEstado(
  bd: pg.Client,
  preguntaId: number,
  codigo: string,
): Promise<void> {
  await bd.query(
    `UPDATE contenido.pregunta
        SET estado_pregunta_id = (SELECT id FROM contenido.estado_pregunta WHERE codigo = $2)
      WHERE id = $1`,
    [preguntaId, codigo],
  );
}
