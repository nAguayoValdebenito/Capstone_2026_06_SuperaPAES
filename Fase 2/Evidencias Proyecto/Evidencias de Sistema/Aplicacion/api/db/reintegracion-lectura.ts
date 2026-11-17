// Lectura de la reintegración de datos (DAS 4.5.5, «Reintegrar lo ocurrido después del momento de
// recuperación»): qué filas creadas después de DESDE tiene el origen (la rama _old de Neon), cuáles ya
// están en el destino (la base recuperada), cuáles quedan fuera y qué impide copiar. No escribe nada.
// Las listas solo llevan ids, nunca datos personales.
import type { Ejecutor } from './transaccion.js';

/** Tablas que se reintegran, en el orden de sus claves foráneas (DAS 4.5.5). */
export const TABLAS = [
  'estudiante',
  'consentimiento',
  'invitacion',
  'evaluacion',
  'evaluacion_item',
  'movimiento_bono',
  'evento_pasarela',
] as const;
export type Tabla = (typeof TABLAS)[number];

const SIN_TIEMPO_POSTERIOR = 'iniciada_en > $1 AND duracion_min IS NULL';

interface Definicion {
  /** Filas del origen creadas después de DESDE ($1) que se reintegran. */
  candidata: string;
  /** Filas del destino escritas después de DESDE, para detectar que la API siguió escribiendo. */
  posterior: string;
  /** Columnas que la base recalcula al copiar y no se comparan (cerrar_evaluacion fija cerrada_en). */
  ignorar?: readonly string[];
}

const DEFINICIONES: Record<Tabla, Definicion> = {
  estudiante: { candidata: 't.creado_en > $1', posterior: 't.creado_en > $1' },
  consentimiento: { candidata: 't.aceptado_en > $1', posterior: 't.aceptado_en > $1' },
  invitacion: { candidata: 't.registrado_en > $1', posterior: 't.registrado_en > $1' },
  evaluacion: {
    candidata: `t.${SIN_TIEMPO_POSTERIOR}`,
    posterior: 't.iniciada_en > $1',
    ignorar: ['cerrada_en'],
  },
  evaluacion_item: {
    candidata: `t.evaluacion_id IN (SELECT id FROM app.evaluacion WHERE ${SIN_TIEMPO_POSTERIOR})`,
    posterior: 't.entregada_en > $1',
  },
  movimiento_bono: { candidata: 't.creado_en > $1', posterior: 't.creado_en > $1' },
  evento_pasarela: { candidata: 't.recibido_en > $1', posterior: 't.recibido_en > $1' },
};

export type Fila = Record<string, unknown> & { id: string };

export interface Bloqueo {
  motivo: string;
  ids: Record<string, string>;
  accion: string;
}

export interface Excluida {
  motivo: string;
  ids: Record<string, string>;
}

/** Valor de una columna de id, fecha o texto como texto (null si la columna es nula). */
export function columna(fila: Fila, nombre: string): string | null {
  const valor = fila[nombre];
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'string' || typeof valor === 'number') return String(valor);
  throw new Error(`La columna ${nombre} no es un id, una fecha ni un texto.`);
}

export interface ResumenTabla {
  tabla: Tabla;
  candidatas: number;
  presentes: number;
  pendientes: number;
}

export interface EstadoReintegracion {
  tablas: ResumenTabla[];
  bloqueos: Bloqueo[];
  excluidas: Excluida[];
  /** Filas que faltan en el destino, por tabla y en orden de id. */
  pendientes: Record<Tabla, Fila[]>;
}

/** La fila sin las columnas que no se comparan, como texto (jsonb ordena sus claves igual en ambas bases). */
function huella(fila: Fila, ignorar: readonly string[] = []): string {
  const copia: Record<string, unknown> = { ...fila };
  for (const columna of ignorar) delete copia[columna];
  return JSON.stringify(copia);
}

async function leerFilas(bd: Ejecutor, tabla: Tabla, condicion: string, valor: unknown) {
  const { rows } = await bd.query<{ fila: Fila }>(
    `SELECT jsonb_set(to_jsonb(t), '{id}', to_jsonb(t.id::text)) AS fila
       FROM app.${tabla} t WHERE ${condicion} ORDER BY t.id`,
    [valor],
  );
  return rows.map((r) => r.fila);
}

interface Lectura {
  origen: Ejecutor;
  destino: Ejecutor;
  desde: Date;
}

/** Candidatas de una tabla clasificadas contra el destino: pendientes, presentes o distintas. */
async function clasificar(l: Lectura, tabla: Tabla, excluidos: ReadonlySet<string>) {
  const { candidata, posterior, ignorar } = DEFINICIONES[tabla];
  const candidatas = (await leerFilas(l.origen, tabla, candidata, l.desde)).filter(
    (f) => !excluidos.has(f.id),
  );
  const ids = candidatas.map((f) => f.id);
  const enDestino = new Map(
    (await leerFilas(l.destino, tabla, 't.id = ANY($1::bigint[])', ids)).map((f) => [f.id, f]),
  );
  const bloqueos: Bloqueo[] = [];
  const pendientes: Fila[] = [];
  const copiadas = new Set<string>();
  for (const fila of candidatas) {
    const actual = enDestino.get(fila.id);
    if (!actual) pendientes.push(fila);
    else if (huella(actual, ignorar) === huella(fila, ignorar)) copiadas.add(fila.id);
    else {
      pendientes.push(fila);
      bloqueos.push(filaDistinta(tabla, fila.id));
    }
  }
  // Lo posterior a DESDE en el destino que no es una copia idéntica del origen lo escribió la API.
  const escritas = (await leerFilas(l.destino, tabla, posterior, l.desde))
    .map((f) => f.id)
    .filter((id) => !copiadas.has(id));
  if (escritas.length > 0) bloqueos.push(escrituraPosterior(tabla, escritas));
  const resumen = {
    tabla,
    candidatas: candidatas.length,
    presentes: candidatas.length - pendientes.length,
    pendientes: pendientes.length,
  };
  return { resumen, pendientes, bloqueos };
}

function filaDistinta(tabla: Tabla, id: string): Bloqueo {
  return {
    motivo: 'fila_distinta_en_destino',
    ids: { tabla, id },
    accion:
      'El destino ya tiene esa fila con otro contenido: la API escribió después de la recuperación o DESDE no ' +
      'corresponde. Revise la bitácora y el momento de recuperación; no se copió nada.',
  };
}

function escrituraPosterior(tabla: Tabla, ids: readonly string[]): Bloqueo {
  return {
    motivo: 'escritura_posterior_en_destino',
    ids: { tabla, ids: ids.slice(0, 20).join(', '), filas: String(ids.length) },
    accion:
      'La base recuperada recibió escrituras después de DESDE: suspenda el servicio en Render antes de ' +
      'reintegrar y registre en la bitácora qué se escribió; no se copió nada.',
  };
}

/** Lee todo lo necesario para simular o aplicar la reintegración. */
export async function leerEstado(l: Lectura): Promise<EstadoReintegracion> {
  const excluidas = await leerExcluidas(l);
  const excluidosPorTabla = agruparExcluidos(excluidas);
  const estado: EstadoReintegracion = {
    tablas: [],
    bloqueos: [],
    excluidas,
    pendientes: Object.fromEntries(TABLAS.map((t) => [t, []])) as unknown as Record<Tabla, Fila[]>,
  };
  for (const tabla of TABLAS) {
    const clasificada = await clasificar(l, tabla, excluidosPorTabla[tabla]);
    estado.tablas.push(clasificada.resumen);
    estado.pendientes[tabla] = clasificada.pendientes;
    estado.bloqueos.push(...clasificada.bloqueos);
  }
  estado.bloqueos.push(
    ...(await evaluacionesAbiertas(l, estado.pendientes.evaluacion)),
    ...(await invitacionesSinVerificar(l, estado.pendientes)),
  );
  return estado;
}

function agruparExcluidos(excluidas: readonly Excluida[]): Record<Tabla, Set<string>> {
  const porTabla = Object.fromEntries(
    TABLAS.map((t) => [t, new Set<string>()]),
  ) as unknown as Record<Tabla, Set<string>>;
  for (const { motivo, ids } of excluidas) {
    if (motivo === 'aviso_sin_suscripcion_o_pago' && ids['aviso']) {
      porTabla.evento_pasarela.add(ids['aviso']);
    }
    if (motivo === 'consumo_de_respuesta_no_reintegrada' && ids['movimiento']) {
      porTabla.movimiento_bono.add(ids['movimiento']);
    }
  }
  return porTabla;
}

/**
 * Lo que queda fuera y se informa: evaluaciones con tiempo (sus respuestas no se pueden volver a
 * registrar con la hora de término ya cumplida), respuestas posteriores de evaluaciones anteriores a
 * DESDE, consumos de bono de esas respuestas y avisos cuya suscripción o pago no existe en el destino
 * (la revisión con las tiendas rehace ese estado).
 */
async function leerExcluidas(l: Lectura): Promise<Excluida[]> {
  const conTiempo = await l.origen.query<{ evaluacion: string; estudiante: string }>(
    `SELECT id::text AS evaluacion, estudiante_id::text AS estudiante FROM app.evaluacion
      WHERE iniciada_en > $1 AND duracion_min IS NOT NULL ORDER BY id`,
    [l.desde],
  );
  const anteriores = await l.origen.query<{
    estudiante: string;
    evaluacion: string;
    respuestas: string;
  }>(
    `SELECT e.estudiante_id::text AS estudiante, e.id::text AS evaluacion, count(*)::text AS respuestas
       FROM app.evaluacion_item i JOIN app.evaluacion e ON e.id = i.evaluacion_id
      WHERE i.respondida_en > $1 AND e.iniciada_en <= $1 GROUP BY e.id, e.estudiante_id ORDER BY e.id`,
    [l.desde],
  );
  const consumos = await l.origen.query<{
    movimiento: string;
    estudiante: string;
    respuesta: string;
  }>(
    `SELECT m.id::text AS movimiento, m.estudiante_id::text AS estudiante, m.evaluacion_item_id::text AS respuesta
       FROM app.movimiento_bono m JOIN app.evaluacion_item i ON i.id = m.evaluacion_item_id
       JOIN app.evaluacion e ON e.id = i.evaluacion_id
      WHERE m.creado_en > $1 AND NOT (e.iniciada_en > $1 AND e.duracion_min IS NULL) ORDER BY m.id`,
    [l.desde],
  );
  return [
    ...conTiempo.rows.map((ids) => ({ motivo: 'evaluacion_con_tiempo', ids })),
    ...anteriores.rows.map((ids) => ({ motivo: 'respuestas_de_evaluacion_anterior', ids })),
    ...consumos.rows.map((ids) => ({ motivo: 'consumo_de_respuesta_no_reintegrada', ids })),
    ...(await avisosHuerfanos(l)),
  ];
}

async function avisosHuerfanos(l: Lectura): Promise<Excluida[]> {
  const { rows } = await l.origen.query<{
    aviso: string;
    suscripcion: string | null;
    pago: string | null;
  }>(
    `SELECT id::text AS aviso, suscripcion_id::text AS suscripcion, pago_id::text AS pago
       FROM app.evento_pasarela WHERE recibido_en > $1 AND (suscripcion_id IS NOT NULL OR pago_id IS NOT NULL)
      ORDER BY id`,
    [l.desde],
  );
  const existentes = async (tabla: 'suscripcion' | 'pago', ids: (string | null)[]) => {
    const { rows: hay } = await l.destino.query<{ id: string }>(
      `SELECT id::text AS id FROM app.${tabla} WHERE id = ANY($1::bigint[])`,
      [ids.filter((id) => id !== null)],
    );
    return new Set(hay.map((h) => h.id));
  };
  const suscripciones = await existentes(
    'suscripcion',
    rows.map((r) => r.suscripcion),
  );
  const pagos = await existentes(
    'pago',
    rows.map((r) => r.pago),
  );
  return rows
    .filter(
      (r) =>
        (r.suscripcion !== null && !suscripciones.has(r.suscripcion)) ||
        (r.pago !== null && !pagos.has(r.pago)),
    )
    .map(({ aviso, suscripcion, pago }) => ({
      motivo: 'aviso_sin_suscripcion_o_pago',
      ids: {
        aviso,
        ...(suscripcion !== null && { suscripcion }),
        ...(pago !== null && { pago }),
      },
    }));
}

/**
 * Caso 4: el estudiante de una evaluación por copiar tiene abierta en el destino otra evaluación
 * anterior a DESDE, que en el origen se cerró después. La base admite una sola abierta (RN-19).
 */
async function evaluacionesAbiertas(l: Lectura, evaluaciones: readonly Fila[]): Promise<Bloqueo[]> {
  const ids = evaluaciones.map((f) => f.id);
  const estudiantes = [...new Set(evaluaciones.map((f) => columna(f, 'estudiante_id')))];
  const { rows } = await l.destino.query<{ evaluacion: string; estudiante: string }>(
    `SELECT id::text AS evaluacion, estudiante_id::text AS estudiante FROM app.evaluacion
      WHERE cerrada_en IS NULL AND estudiante_id = ANY($1::bigint[]) AND NOT (id = ANY($2::bigint[]))
      ORDER BY id`,
    [estudiantes, ids],
  );
  const bloqueos: Bloqueo[] = [];
  for (const { evaluacion, estudiante } of rows) {
    const { rows: origen } = await l.origen.query<{ estado: string; cerrada: boolean }>(
      `SELECT s.codigo AS estado, e.cerrada_en IS NOT NULL AS cerrada FROM app.evaluacion e
         JOIN contenido.estado_evaluacion s ON s.id = e.estado_evaluacion_id WHERE e.id = $1`,
      [evaluacion],
    );
    const estado = origen[0];
    bloqueos.push({
      motivo: 'evaluacion_abierta_en_destino',
      ids: { estudiante, evaluacion },
      accion: estado?.cerrada
        ? `En el origen quedó «${estado.estado}». Ciérrela en el destino con ` +
          `SELECT app.cerrar_evaluacion(${evaluacion}, '${estado.estado}'); y vuelva a simular.`
        : 'En el origen también está abierta: revise con la bitácora qué evaluación debe quedar abierta; no se copió nada.',
    });
  }
  return bloqueos;
}

/**
 * Caso 5: un abono por copiar nace de una invitación anterior a DESDE que en el origen se verificó
 * después, pero en el destino sigue sin verificar. La base exige la invitación verificada.
 */
async function invitacionesSinVerificar(
  l: Lectura,
  pendientes: Readonly<Record<Tabla, Fila[]>>,
): Promise<Bloqueo[]> {
  const copiadas = new Set(pendientes.invitacion.map((f) => f.id));
  const abonos = pendientes.movimiento_bono
    .map((f) => ({ movimiento: f.id, invitacion: columna(f, 'invitacion_id') }))
    .filter((a): a is { movimiento: string; invitacion: string } => a.invitacion !== null)
    .filter((a) => !copiadas.has(a.invitacion));
  const { rows } = await l.destino.query<{ id: string }>(
    `SELECT id::text AS id FROM app.invitacion WHERE id = ANY($1::bigint[]) AND verificado_en IS NULL`,
    [abonos.map((a) => a.invitacion)],
  );
  const sinVerificar = new Set(rows.map((r) => r.id));
  return abonos
    .filter((a) => sinVerificar.has(a.invitacion))
    .map((ids) => ({
      motivo: 'invitacion_sin_verificar_en_destino',
      ids: { invitacion: ids.invitacion, movimiento: ids.movimiento },
      accion:
        'En el origen la invitación se verificó después de DESDE. Copie al destino su verificado_en y ' +
        'bono_entregado, y la verificación del correo de la cuenta invitada, con las consultas de ' +
        'operaciones/contingencia.md; luego vuelva a simular.',
    }));
}
