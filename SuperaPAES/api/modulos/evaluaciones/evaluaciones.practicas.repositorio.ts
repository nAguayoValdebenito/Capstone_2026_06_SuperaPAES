// Persistencia del inicio y la entrega de prácticas. El contenido visible sale solo de v_item_evaluacion.
import type { Ejecutor } from '../../db/transaccion.js';
import type { CodigoDificultad, PreguntaSeleccionada } from './evaluaciones.seleccion.tipos.js';

export interface EstructuraPractica {
  id: number;
  cantidadMin: number;
  cantidadMax: number;
}
export interface ContextoInicio {
  iniciadaEn: Date;
  nivelEscolarId: number | null;
}
export interface EvaluacionAbierta {
  id: string;
  conTiempo: boolean;
}
export interface PracticaGuardada {
  id: string;
  pruebaId: number;
  ejeId: number | null;
  contenidoId: number | null;
  habilidadId: number | null;
  dificultadId: number | null;
  dificultad: CodigoDificultad | null;
  cantidad: number;
  nivelEscolarId: number | null;
  iniciadaEn: Date;
  cerradaEn: Date | null;
}
export interface EntregaGuardada extends PreguntaSeleccionada {
  id: string;
  orden: number;
  respondidaEn: Date | null;
}
export interface ItemVisible {
  id: string;
  orden: number;
  enunciado: string;
  textoTitulo: string | null;
  textoContenido: string | null;
  textoImagen: string | null;
  alternativas: { id: string | number; letra: string; texto: string }[];
}
export interface NuevaPractica {
  estudianteId: string;
  pruebaId: number;
  estructuraId: number;
  ejeId?: number;
  contenidoId?: number;
  habilidadId?: number;
  dificultadId?: number;
  cantidad: number;
  iniciadaEn: Date;
}

const consultasPracticas = {
  async leerEstructura(pruebaId: number, tx: Ejecutor): Promise<EstructuraPractica | null> {
    const { rows } = await tx.query<EstructuraPractica>(
      `SELECT s.id, s.cantidad_min AS "cantidadMin", s.cantidad_max AS "cantidadMax"
         FROM contenido.estructura_evaluacion s
         JOIN contenido.tipo_evaluacion t ON t.id=s.tipo_evaluacion_id
         JOIN contenido.prueba p ON p.id=s.prueba_id
         WHERE t.codigo='practica' AND s.prueba_id=$1 AND s.activa AND p.activa`,
      [pruebaId],
    );
    return rows[0] ?? null;
  },
  async leerContextoInicio(anioEgreso: number, tx: Ejecutor): Promise<ContextoInicio> {
    const { rows } = await tx.query<ContextoInicio>(
      `SELECT transaction_timestamp() AS "iniciadaEn",
          app.nivel_escolar_en($1, (transaction_timestamp() AT TIME ZONE 'America/Santiago')::date)
            AS "nivelEscolarId"`,
      [anioEgreso],
    );
    const fila = rows[0];
    if (!fila) throw new Error('No se pudo leer la fecha de inicio de la base.');
    return fila;
  },
  async leerDificultad(id: number, tx: Ejecutor): Promise<CodigoDificultad | null> {
    const { rows } = await tx.query<{ codigo: CodigoDificultad }>(
      'SELECT codigo FROM contenido.dificultad WHERE id=$1',
      [id],
    );
    return rows[0]?.codigo ?? null;
  },
  async leerAbierta(estudianteId: string, tx: Ejecutor): Promise<EvaluacionAbierta | null> {
    const { rows } = await tx.query<EvaluacionAbierta>(
      `SELECT e.id::text AS id, t.con_tiempo AS "conTiempo"
         FROM app.evaluacion e JOIN contenido.tipo_evaluacion t ON t.id=e.tipo_evaluacion_id
         WHERE e.estudiante_id=$1 AND e.cerrada_en IS NULL FOR UPDATE OF e`,
      [estudianteId],
    );
    return rows[0] ?? null;
  },
  async cerrarAbandonada(id: string, tx: Ejecutor): Promise<void> {
    await tx.query("SELECT app.cerrar_evaluacion($1, 'abandonada')", [id]);
  },
  async crear(datos: NuevaPractica, tx: Ejecutor): Promise<PracticaGuardada> {
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO app.evaluacion
          (estudiante_id, tipo_evaluacion_id, unica_por_anio_escolar, prueba_id, estructura_id,
           eje_id, contenido_id, habilidad_id, dificultad_id, anio_escolar, cantidad_preguntas,
           estado_evaluacion_id, iniciada_en)
         SELECT $1, t.id, false, $2, $3, $4, $5, $6, $7, 0, $8, ee.id, $9
         FROM contenido.tipo_evaluacion t CROSS JOIN contenido.estado_evaluacion ee
         WHERE t.codigo='practica' AND ee.codigo='en_curso' RETURNING id::text`,
      [
        datos.estudianteId,
        datos.pruebaId,
        datos.estructuraId,
        datos.ejeId ?? null,
        datos.contenidoId ?? null,
        datos.habilidadId ?? null,
        datos.dificultadId ?? null,
        datos.cantidad,
        datos.iniciadaEn,
      ],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error('No se pudo crear la práctica.');
    const practica = await this.leerPractica(id, datos.estudianteId, tx);
    if (!practica) throw new Error('La práctica recién creada no se encontró.');
    return practica;
  },
  async leerPractica(
    id: string,
    estudianteId: string,
    tx: Ejecutor,
  ): Promise<PracticaGuardada | null> {
    const { rows } = await tx.query<PracticaGuardada>(
      `SELECT e.id::text AS id, e.prueba_id AS "pruebaId", e.eje_id AS "ejeId",
          e.contenido_id AS "contenidoId", e.habilidad_id AS "habilidadId",
          e.dificultad_id AS "dificultadId", d.codigo AS dificultad,
          e.cantidad_preguntas AS cantidad, e.nivel_escolar_id AS "nivelEscolarId",
          e.iniciada_en AS "iniciadaEn", e.cerrada_en AS "cerradaEn"
         FROM app.evaluacion e JOIN contenido.tipo_evaluacion t ON t.id=e.tipo_evaluacion_id
         LEFT JOIN contenido.dificultad d ON d.id=e.dificultad_id
         WHERE e.id=$1 AND e.estudiante_id=$2 AND t.codigo='practica' FOR UPDATE OF e`,
      [id, estudianteId],
    );
    return rows[0] ?? null;
  },
  async leerEntregas(id: string, tx: Ejecutor): Promise<EntregaGuardada[]> {
    const { rows } = await tx.query<EntregaGuardada>(
      `SELECT id::text, orden, pregunta_id::text AS "preguntaId", version_pregunta AS version,
          respondida_en AS "respondidaEn" FROM app.evaluacion_item
         WHERE evaluacion_id=$1 ORDER BY orden`,
      [id],
    );
    return rows;
  },
  async insertarEntrega(
    practica: PracticaGuardada,
    pregunta: PreguntaSeleccionada,
    orden: number,
    tx: Ejecutor,
  ): Promise<string> {
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO app.evaluacion_item
          (evaluacion_id, prueba_id, pregunta_id, version_pregunta, orden)
         VALUES ($1,$2,$3,$4,$5) RETURNING id::text`,
      [practica.id, practica.pruebaId, pregunta.preguntaId, pregunta.version, orden],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error('No se pudo registrar la entrega.');
    return id;
  },
  async leerItemVisible(
    itemId: string,
    estudianteId: string,
    tx: Ejecutor,
  ): Promise<ItemVisible | null> {
    const { rows } = await tx.query<ItemVisible>(
      `SELECT evaluacion_item_id::text AS id, orden, enunciado,
          texto_titulo AS "textoTitulo", texto_contenido AS "textoContenido",
          texto_imagen_url AS "textoImagen", alternativas
         FROM app.v_item_evaluacion
         WHERE evaluacion_item_id=$1 AND estudiante_id=$2 AND respondida_en IS NULL`,
      [itemId, estudianteId],
    );
    return rows[0] ?? null;
  },
};

export function crearPracticasRepositorio() {
  return consultasPracticas;
}

export type PracticasRepositorio = ReturnType<typeof crearPracticasRepositorio>;
