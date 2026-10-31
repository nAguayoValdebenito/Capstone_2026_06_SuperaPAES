// Reintegración de datos después de una recuperación (TEC-08, CP-59; DAS 4.5.5, cuarto paso del
// procedimiento). Desde el origen (la rama _old de Neon, o una base restaurada del respaldo) copia a la
// base recuperada las filas creadas después de DESDE: cuentas nuevas y su consentimiento, invitaciones,
// evaluaciones sin tiempo con sus respuestas, movimientos de bono y avisos de las tiendas. No copia
// suscripciones, pagos ni sesiones.
//
// Todo pasa por las reglas de la base, sin desactivar triggers: cada evaluación se vuelve a armar como lo
// hace la API (en curso, con sus preguntas y respuestas) y, si estaba cerrada, la cierra
// app.cerrar_evaluacion con el mismo estado. Por eso su cerrada_en y su tiempo usado quedan con la hora
// de la reintegración. Al final, en la misma transacción, compara el resultado de cada evaluación cerrada
// con el del origen y vuelve a simular: cualquier diferencia o fila pendiente deshace todo.
import type pg from 'pg';
import { ErrorOperacion } from './procesos.js';
import {
  columna,
  type EstadoReintegracion,
  type Fila,
  leerEstado,
  type ResumenTabla,
  type Tabla,
  TABLAS,
} from './reintegracion-lectura.js';
import { ejecutarEnTransaccion, type Ejecutor } from './transaccion.js';

/** Clave del bloqueo que impide dos reintegraciones a la vez sobre la misma base. */
const CLAVE_BLOQUEO = 20261030;

export interface OpcionesReintegracion {
  /** Rama _old de Neon (estado previo a la recuperación). Solo se lee. */
  origen: pg.ClientBase;
  /** Base recuperada, con el servicio de Render suspendido. */
  destino: pg.ClientBase;
  desde: Date;
}

export interface InformeReintegracion {
  tablas: ResumenTabla[];
  pendientes: number;
  bloqueos: EstadoReintegracion['bloqueos'];
  excluidas: EstadoReintegracion['excluidas'];
}

export interface ResultadoAplicacion {
  informe: InformeReintegracion;
  /** Evaluaciones cerradas copiadas cuyo resultado se comparó con el del origen. */
  evaluacionesVerificadas: number;
  /** Evaluaciones cerradas a la hora de la reintegración (cerrada_en y tiempo usado distintos al origen). */
  cerradasAhora: string[];
  pendientesDespues: number;
}

function informar(estado: EstadoReintegracion): InformeReintegracion {
  return {
    tablas: estado.tablas,
    pendientes: estado.tablas.reduce((total, t) => total + t.pendientes, 0),
    bloqueos: estado.bloqueos,
    excluidas: estado.excluidas,
  };
}

/** Lee el origen en una transacción de solo lectura con una sola foto de los datos. */
async function conOrigenDeSoloLectura<T>(origen: pg.ClientBase, trabajo: () => Promise<T>) {
  await origen.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    return await trabajo();
  } finally {
    await origen.query('ROLLBACK');
  }
}

/** Modo simulación: informa qué copiaría, qué queda fuera y qué lo impide. No escribe en ninguna base. */
export async function simularReintegracion(
  o: OpcionesReintegracion,
): Promise<InformeReintegracion> {
  return conOrigenDeSoloLectura(o.origen, async () => {
    await o.destino.query('BEGIN READ ONLY');
    try {
      return informar(await leerEstado(o));
    } finally {
      await o.destino.query('ROLLBACK');
    }
  });
}

/** Copia todo en una sola transacción, o nada. Se niega antes de escribir si hay bloqueos. */
export async function aplicarReintegracion(o: OpcionesReintegracion): Promise<ResultadoAplicacion> {
  return conOrigenDeSoloLectura(o.origen, () =>
    ejecutarEnTransaccion(o.destino, async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock($1)', [CLAVE_BLOQUEO]);
      const estado = await leerEstado({ origen: o.origen, destino: tx, desde: o.desde });
      exigirSinBloqueos(estado);
      const copia = { origen: o.origen, destino: tx };
      for (const tabla of ['estudiante', 'consentimiento', 'invitacion'] as const) {
        await copiarFilas(tx, tabla, estado.pendientes[tabla]);
      }
      const cerradas = await copiarEvaluaciones(copia, estado.pendientes);
      await copiarFilas(tx, 'movimiento_bono', abonosPrimero(estado.pendientes.movimiento_bono));
      await copiarFilas(tx, 'evento_pasarela', estado.pendientes.evento_pasarela);
      for (const id of cerradas) await compararResultado(copia, id);
      const despues = informar(await leerEstado({ origen: o.origen, destino: tx, desde: o.desde }));
      if (despues.pendientes > 0 || despues.bloqueos.length > 0) {
        throw new ErrorOperacion(
          `Después de copiar, la simulación aún informa ${despues.pendientes} filas pendientes: no se copió nada.`,
        );
      }
      await avanzarSecuencias(tx);
      return {
        informe: informar(estado),
        evaluacionesVerificadas: cerradas.length,
        cerradasAhora: cerradas,
        pendientesDespues: despues.pendientes,
      };
    }),
  );
}

function exigirSinBloqueos(estado: EstadoReintegracion): void {
  if (estado.bloqueos.length === 0) return;
  const detalle = estado.bloqueos
    .map(
      (b) =>
        `${b.motivo} (${Object.entries(b.ids)
          .map(([k, v]) => `${k} ${v}`)
          .join(', ')})`,
    )
    .join('; ');
  throw new ErrorOperacion(`No se copió nada. Resuelva primero: ${detalle}.`);
}

async function insertar(tx: Ejecutor, tabla: Tabla, fila: Fila): Promise<void> {
  try {
    await tx.query(
      `INSERT INTO app.${tabla} SELECT * FROM jsonb_populate_record(NULL::app.${tabla}, $1::jsonb)`,
      [JSON.stringify(fila)],
    );
  } catch (error) {
    // Solo el mensaje del motor (nombre de la regla o de la restricción): el detalle puede traer datos.
    const mensaje = error instanceof Error ? error.message : 'error desconocido';
    throw new ErrorOperacion(
      `No se pudo copiar app.${tabla} id ${fila.id}: ${mensaje}. No se copió nada.`,
    );
  }
}

async function copiarFilas(tx: Ejecutor, tabla: Tabla, filas: readonly Fila[]): Promise<void> {
  for (const fila of filas) await insertar(tx, tabla, fila);
}

/** Los abonos antes que los consumos: el saldo de preguntas extra nunca puede quedar negativo. */
function abonosPrimero(movimientos: readonly Fila[]): Fila[] {
  const esAbono = (f: Fila) => columna(f, 'invitacion_id') !== null;
  return [...movimientos.filter(esAbono), ...movimientos.filter((f) => !esAbono(f))];
}

interface Copia {
  origen: Ejecutor;
  destino: Ejecutor;
}

/**
 * Vuelve a armar cada evaluación sin tiempo como lo hace la API: la crea en curso, agrega sus preguntas
 * y respuestas (los triggers las validan y corrigen), devuelve su última actividad y, si en el origen
 * estaba cerrada, la cierra con app.cerrar_evaluacion y el mismo estado. Devuelve las cerradas.
 */
async function copiarEvaluaciones(c: Copia, pendientes: Record<Tabla, Fila[]>): Promise<string[]> {
  const estados = await estadosDelOrigen(c.origen, pendientes.evaluacion);
  const { rows } = await c.destino.query<{ id: number }>(
    "SELECT id FROM contenido.estado_evaluacion WHERE codigo = 'en_curso'",
  );
  const enCurso = rows[0]?.id;
  // En el orden en que se iniciaron: la base admite una sola evaluación abierta por estudiante.
  const inicio = (f: Fila) => new Date(columna(f, 'iniciada_en') ?? 0).getTime();
  const ordenadas = [...pendientes.evaluacion].sort(
    (a, b) => inicio(a) - inicio(b) || Number(a.id) - Number(b.id),
  );
  const cerradas: string[] = [];
  for (const evaluacion of ordenadas) {
    await insertar(c.destino, 'evaluacion', {
      ...evaluacion,
      estado_evaluacion_id: enCurso,
      cerrada_en: null,
    });
    const items = pendientes.evaluacion_item
      .filter((i) => columna(i, 'evaluacion_id') === evaluacion.id)
      .sort((a, b) => Number(a['orden']) - Number(b['orden']));
    for (const item of items)
      await insertar(c.destino, 'evaluacion_item', { ...item, es_correcta: null });
    await c.destino.query('UPDATE app.evaluacion SET ultima_actividad_en = $2 WHERE id = $1', [
      evaluacion.id,
      evaluacion['ultima_actividad_en'],
    ]);
    if (evaluacion['cerrada_en'] !== null) {
      await c.destino.query('SELECT app.cerrar_evaluacion($1, $2)', [
        evaluacion.id,
        estados.get(evaluacion.id),
      ]);
      cerradas.push(evaluacion.id);
    }
  }
  return cerradas;
}

async function estadosDelOrigen(origen: Ejecutor, evaluaciones: readonly Fila[]) {
  const { rows } = await origen.query<{ id: string; codigo: string }>(
    `SELECT e.id::text AS id, s.codigo FROM app.evaluacion e
       JOIN contenido.estado_evaluacion s ON s.id = e.estado_evaluacion_id WHERE e.id = ANY($1::bigint[])`,
    [evaluaciones.map((f) => f.id)],
  );
  return new Map(rows.map((r) => [r.id, r.codigo]));
}

/** Resultado de una evaluación sin las horas del cálculo ni el tiempo usado (dependen de cerrada_en). */
const RESULTADO = `
  SELECT jsonb_build_object(
    'total', (SELECT to_jsonb(r) - ARRAY['calculado_en', 'recalculado_en', 'tiempo_usado_seg']
                FROM app.resultado_evaluacion r WHERE r.evaluacion_id = $1),
    'ejes', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.eje_id) FROM app.resultado_eje x WHERE x.evaluacion_id = $1),
    'habilidades', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.habilidad_id)
                      FROM app.resultado_habilidad x WHERE x.evaluacion_id = $1)) AS resultado`;

/** El resultado que calculó cerrar_evaluacion debe ser igual al del origen. */
async function compararResultado(c: Copia, id: string): Promise<void> {
  const leer = async (bd: Ejecutor) =>
    JSON.stringify((await bd.query<{ resultado: unknown }>(RESULTADO, [id])).rows[0]?.resultado);
  if ((await leer(c.destino)) !== (await leer(c.origen))) {
    throw new ErrorOperacion(
      `El resultado de la evaluación ${id} no coincide con el del origen. No se copió nada.`,
    );
  }
}

/** Las secuencias quedan sobre el mayor id copiado, para que la API no choque con las filas copiadas. */
async function avanzarSecuencias(tx: Ejecutor): Promise<void> {
  for (const tabla of TABLAS) {
    await tx.query(
      `SELECT setval(s, GREATEST(COALESCE(pg_sequence_last_value(s), 1), (SELECT COALESCE(max(id), 1) FROM app.${tabla})))
         FROM (SELECT pg_get_serial_sequence($1, 'id')::regclass AS s) q`,
      [`app.${tabla}`],
    );
  }
}
