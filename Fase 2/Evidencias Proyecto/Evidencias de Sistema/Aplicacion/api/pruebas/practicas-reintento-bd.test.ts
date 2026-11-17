// RN-19 con PostgreSQL real: el cruce de dos inicios, reproducido en un orden fijo y sin depender de la
// suerte. La prueba hace de «primera transacción»: toma el bloqueo del estudiante, espera a que el inicio
// de la API quede en cola (su transacción ya empezó, así que su now() es anterior) y recién entonces crea
// una práctica abierta con una hora posterior. Al soltar el bloqueo, el inicio intenta cerrarla con su
// now(): la base lo rechaza (cerrada_en antes de iniciada_en) y el reintento lo resuelve.
import { describe, expect, it } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararPracticas } from './base-practicas.js';

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

exigirBaseEnCi();
describe.skipIf(!urlBase)('inicio de la práctica con reintento (RN-19)', () => {
  const base = prepararPracticas('practicas_reintento');
  const { entorno, sesion, publicar, inicio } = base;

  /** Espera a que otra conexión de esta base quede esperando un bloqueo. */
  async function esperarInicioEnCola(): Promise<void> {
    for (let intento = 0; intento < 250; intento++) {
      const { rows } = await entorno.bd.query<{ esperando: number }>(
        `SELECT count(*)::int AS esperando FROM pg_stat_activity
          WHERE datname = current_database() AND pid <> pg_backend_pid() AND wait_event_type = 'Lock'`,
      );
      if ((rows[0]?.esperando ?? 0) > 0) return;
      await esperar(20);
    }
    throw new Error('El inicio de la práctica nunca quedó esperando el bloqueo del estudiante.');
  }

  it('cierra la práctica creada después de que empezó su transacción, sin error y sin dejar nada a medias', async () => {
    await publicar(5, { prueba: 'M1', dificultad: 'media' });
    const { id, token } = await sesion();

    await entorno.bd.query('BEGIN');
    let respuesta;
    try {
      await entorno.bd.query('SELECT 1 FROM app.estudiante WHERE id = $1 FOR UPDATE', [id]);
      const pendiente = inicio(token, { pruebaId: base.pruebaId, cantidad: 5 }).then((r) => r);
      await esperarInicioEnCola();
      // La práctica de la «primera transacción», con una hora posterior al inicio de la otra.
      await entorno.bd.query(
        `INSERT INTO app.evaluacion
            (estudiante_id, tipo_evaluacion_id, unica_por_anio_escolar, prueba_id, estructura_id,
             anio_escolar, cantidad_preguntas, estado_evaluacion_id, iniciada_en)
          SELECT $1, t.id, false, $2, s.id, 0, 5, ee.id, clock_timestamp()
            FROM contenido.tipo_evaluacion t
            JOIN contenido.estructura_evaluacion s ON s.tipo_evaluacion_id = t.id AND s.prueba_id = $2 AND s.activa
            CROSS JOIN contenido.estado_evaluacion ee
           WHERE t.codigo = 'practica' AND ee.codigo = 'en_curso'`,
        [id, base.pruebaId],
      );
      await entorno.bd.query('COMMIT');
      respuesta = await pendiente;
    } catch (error) {
      await entorno.bd.query('ROLLBACK');
      throw error;
    }

    expect(respuesta.status).toBe(201);
    const { rows } = await entorno.bd.query<{
      id: string;
      estado: string;
      abierta: boolean;
      cierreValido: boolean | null;
    }>(
      `SELECT e.id::text AS id, ee.codigo AS estado, e.cerrada_en IS NULL AS abierta,
              e.cerrada_en >= e.iniciada_en AS "cierreValido"
         FROM app.evaluacion e JOIN contenido.estado_evaluacion ee ON ee.id = e.estado_evaluacion_id
        WHERE e.estudiante_id = $1 ORDER BY e.id`,
      [id],
    );
    // Dos evaluaciones, no tres: el intento rechazado se deshizo completo.
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ estado: 'abandonada', abierta: false, cierreValido: true });
    expect(rows[1]).toMatchObject({ id: String(respuesta.body.data.id as number), abierta: true });
  });
});
