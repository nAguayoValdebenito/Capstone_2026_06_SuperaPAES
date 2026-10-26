// Datos de historial y comprobación de tg_item solo para bases temporales de pruebas.
import type { Ejecutor } from '../db/transaccion.js';
import type {
  DatosSeleccion,
  PreguntaSeleccionada,
} from '../modulos/evaluaciones/evaluaciones.seleccion.tipos.js';

export async function crearPracticaDePrueba(bd: Ejecutor, datos: DatosSeleccion): Promise<string> {
  const {
    rows: [fila],
  } = await bd.query<{ id: string }>(
    `INSERT INTO app.evaluacion (estudiante_id, prueba_id, tipo_evaluacion_id, estructura_id,
      cantidad_preguntas, estado_evaluacion_id, iniciada_en, anio_escolar, unica_por_anio_escolar,
      eje_id, contenido_id, habilidad_id, dificultad_id)
     SELECT $1, $2, t.id, s.id, $3, e.id, $4, 0, false, $5, $6, $7, d.id
     FROM contenido.tipo_evaluacion t JOIN contenido.estructura_evaluacion s
       ON s.tipo_evaluacion_id=t.id AND s.prueba_id=$2
     CROSS JOIN contenido.estado_evaluacion e
     LEFT JOIN contenido.dificultad d ON d.codigo=$8
     WHERE t.codigo='practica' AND e.codigo='en_curso' RETURNING id::text`,
    [
      datos.estudianteId,
      datos.pruebaId,
      datos.cantidad,
      datos.iniciadaEn,
      datos.ejeId ?? null,
      datos.contenidoId ?? null,
      datos.habilidadId ?? null,
      datos.dificultad ?? null,
    ],
  );
  if (!fila) throw new Error('Falta la estructura de práctica.');
  return fila.id;
}

export async function insertarEntregaDePrueba(
  bd: Ejecutor,
  evaluacionId: string,
  pregunta: PreguntaSeleccionada,
  orden: number,
): Promise<string> {
  const {
    rows: [fila],
  } = await bd.query<{ id: string }>(
    `INSERT INTO app.evaluacion_item (evaluacion_id, prueba_id, pregunta_id, version_pregunta, orden)
     SELECT id, prueba_id, $2, $3, $4 FROM app.evaluacion WHERE id=$1 RETURNING id::text`,
    [evaluacionId, pregunta.preguntaId, pregunta.version, orden],
  );
  if (!fila) throw new Error('Falta la evaluación.');
  return fila.id;
}

export async function registrarRespuestaDePrueba(
  bd: Ejecutor,
  datos: DatosSeleccion,
  respuesta: {
    pregunta: PreguntaSeleccionada;
    acertada: boolean;
    fecha: Date;
  },
): Promise<void> {
  const evaluacion = await crearPracticaDePrueba(bd, {
    ...datos,
    cantidad: 5,
    iniciadaEn: respuesta.fecha,
  });
  const item = await insertarEntregaDePrueba(bd, evaluacion, respuesta.pregunta, 1);
  await bd.query(
    `UPDATE app.evaluacion_item i SET alternativa_id=a.id, respondida_en=$2,
    tipo_consumo_id=t.id FROM contenido.alternativa a, contenido.tipo_consumo t
    WHERE i.id=$1 AND a.pregunta_id=i.pregunta_id AND a.letra=$3 AND t.codigo='cupo'`,
    [item, respuesta.fecha, respuesta.acertada ? 'A' : 'B'],
  );
  await bd.query(`SELECT app.cerrar_evaluacion($1, 'entregada')`, [evaluacion]);
}
