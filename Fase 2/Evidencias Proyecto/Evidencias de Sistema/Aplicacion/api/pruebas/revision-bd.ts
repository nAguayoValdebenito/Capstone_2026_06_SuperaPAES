// Ayudantes de las pruebas de revisión y publicación contra PostgreSQL (HU-22 a HU-24): una base temporal
// con las semillas y los servicios reales, cuentas internas con sus áreas, la pauta activa, un contenido
// de Historia sin textos de lectura y preguntas en borrador sobre él.
import path from 'node:path';
import type pg from 'pg';
import { crearServicios, type Servicios } from '../app.js';
import { ejecutarSemillas } from '../db/semillas.js';
import { ejecutarEnTransaccion } from '../db/transaccion.js';
import { esquemaPregunta } from '../modulos/preguntas/preguntas.validadores.js';
import { esquemaRevision } from '../modulos/revision/revision.validadores.js';
import { crearDependenciasDePrueba } from './ayudantes.js';
import { uno } from './banco-de-prueba.js';
import { type BaseTemporal, crearBaseTemporal } from './base-temporal.js';
import { alternativas } from './edicion-de-prueba.js';

/** Base temporal con las semillas y los servicios reales sobre ella. */
export async function prepararBaseDeRevision(
  nombre: string,
): Promise<{ base: BaseTemporal; servicios: Servicios }> {
  const base = await crearBaseTemporal(nombre);
  await ejecutarSemillas(base.bd, path.join(import.meta.dirname, '../db/semillas'));
  return { base, servicios: serviciosSobre(base.bd) };
}

/** Los servicios reales sobre una conexión; otra conexión permite probar dos peticiones a la vez. */
export function serviciosSobre(bd: pg.Client): Servicios {
  return crearServicios(
    crearDependenciasDePrueba({
      bd,
      unidadDeTrabajo: { enTransaccion: (trabajo) => ejecutarEnTransaccion(bd, trabajo) },
    }),
  );
}

/** Crea una cuenta interna con el rol y las áreas indicadas (por nombre); devuelve su id. */
export async function crearCuenta(
  bd: pg.Client,
  [correo, rol]: [string, string],
  areas: string[] = [],
): Promise<string> {
  const usuario = String(
    await uno(
      bd,
      `INSERT INTO contenido.usuario_interno (nombre, correo, hash_contrasena, rol_id, creado_en)
       SELECT $1, $1, 'x', id, now() FROM contenido.rol WHERE codigo = $2 RETURNING id`,
      [correo, rol],
    ),
  );
  await bd.query(
    `INSERT INTO contenido.docente_especialidad (usuario_interno_id, area_id)
     SELECT $1, id FROM contenido.area WHERE nombre = ANY ($2::text[])`,
    [usuario, areas],
  );
  return usuario;
}

/** Los códigos de la pauta activa, en su orden. */
export async function pautaActiva(bd: pg.Client): Promise<string[]> {
  const { rows } = await bd.query<{ codigo: string }>(
    'SELECT codigo FROM contenido.criterio_pauta WHERE activo ORDER BY orden',
  );
  return rows.map((fila) => fila.codigo);
}

/** La prueba, el primer contenido y una habilidad de Historia (sin textos de lectura). */
export async function temarioDeHistoria(bd: pg.Client) {
  const { rows } = await bd.query<{ prueba: number; contenido: number; habilidad: number }>(
    `SELECT c.prueba_id AS prueba, c.id AS contenido,
            (SELECT min(h.id) FROM contenido.habilidad h WHERE h.prueba_id = c.prueba_id) AS habilidad
       FROM contenido.contenido_tematico c JOIN contenido.area a ON a.id = c.area_id
       JOIN contenido.prueba p ON p.id = c.prueba_id
      WHERE a.nombre = 'Historia' AND p.textos IS NULL ORDER BY c.id LIMIT 1`,
  );
  const fila = rows[0];
  if (!fila) throw new Error('Sin contenidos de Historia.');
  return fila;
}

/** Una pregunta de selección múltiple en borrador sobre el contenido de Historia; devuelve su id. */
export async function crearPreguntaDeHistoria(
  servicios: Servicios,
  temario: Awaited<ReturnType<typeof temarioDeHistoria>>,
  [autorId, enunciado]: [string, string],
): Promise<string> {
  const creada = await servicios.preguntas.crearPregunta(
    autorId,
    esquemaPregunta.parse({
      pruebaId: temario.prueba,
      contenidoId: temario.contenido,
      habilidadId: temario.habilidad,
      tipoPregunta: 'seleccion_multiple',
      dificultadSugerida: 'media',
      enunciado,
      explicacion: 'Explicación.',
      alternativas: alternativas(4, ['A']),
    }),
  );
  return creada.id;
}

/** Envía la pregunta a revisión y sus revisores la aprueban con la dificultad indicada (HU-21 a HU-23). */
export async function aprobarPregunta(
  servicios: Servicios,
  [administradorId, preguntaId]: [string, string],
  [pauta, dificultad]: [readonly string[], string],
): Promise<void> {
  const envio = await servicios.revision.enviarARevision(administradorId, preguntaId);
  for (const { asignacionId, docente } of envio.revisores) {
    await servicios.revision.entregarRevision(
      docente.id,
      asignacionId,
      esquemaRevision.parse({
        criterios: pauta.map((codigo) => ({ codigo, cumple: true })),
        dificultad,
        decision: 'aprobar',
      }),
    );
  }
}
