// HU-32.1 (CU-07; DAS 1.13, 4.4.5 y Figura 17): responder una pregunta de la práctica en una sola
// transacción. Si cualquier paso falla, no se guarda la respuesta ni se descuenta cupo.
//
// Orden de bloqueos, siempre el mismo, para no provocar bloqueos cruzados (deadlock):
//   1. la fila del estudiante (app.estudiante, por el servicio de cuentas). El inicio de la práctica
//      también la toma primero, y los triggers tg_racha y tg_saldo_bono la piden al guardar;
//   2. la evaluación y su ítem (FOR UPDATE);
//   3. la fila del día de app.cupo_diario (cupo-invitaciones).
//
// La respuesta se guarda con lo que se descontó porque tg_item lo exige al responder, y la pregunta
// extra se descuenta después, porque tg_movimiento_bono exige que el ítem ya diga bono.
import type { Reloj } from '../../comun/reloj.js';
import { ErrorAplicacion } from '../../comun/errores.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { CuentasServicio } from '../cuentas/index.js';
import type { CupoInvitacionesServicio, EstadoCupo } from '../cupo-invitaciones/index.js';
import {
  alternativaInvalida,
  evaluacionCerrada,
  itemNoEncontrado,
  respuestaYaRegistrada,
} from './evaluaciones.errores.js';
import type {
  ItemCorregido,
  ItemParaResponder,
  RespuestaNueva,
  RespuestasRepositorio,
} from './evaluaciones.respuestas.repositorio.js';

export interface DependenciasRespuestas {
  repositorio: RespuestasRepositorio;
  unidadDeTrabajo: UnidadDeTrabajo;
  cuentas: Pick<CuentasServicio, 'estadoParaCupo'>;
  cupo: Pick<CupoInvitacionesServicio, 'reservarConsumo' | 'consultarCupo'>;
  reloj: Reloj;
}

export interface DatosRespuesta {
  evaluacionId: string;
  itemId: string;
  alternativaId: number;
}

/** Restricción de la base: la alternativa elegida debe ser de la misma pregunta. */
const RESTRICCION_ALTERNATIVA = 'evaluacion_item_alternativa_id_pregunta_id_fkey';

function comprobarItem(item: ItemParaResponder | null, ahora: Date): ItemParaResponder {
  if (!item) throw itemNoEncontrado();
  if (item.cerrada || (item.venceEn !== null && ahora > item.venceEn)) throw evaluacionCerrada();
  if (item.respondida) throw respuestaYaRegistrada();
  return item;
}

function violaRestriccion(error: unknown, restriccion: string): boolean {
  const { code, constraint } = (error ?? {}) as { code?: unknown; constraint?: unknown };
  return code === '23503' && constraint === restriccion;
}

async function guardar(
  repositorio: RespuestasRepositorio,
  respuesta: RespuestaNueva,
  tx: Ejecutor,
) {
  let guardada: boolean;
  try {
    guardada = await repositorio.guardarRespuesta(respuesta, tx);
  } catch (error) {
    // La base también rechaza una alternativa de otra pregunta (clave foránea).
    if (violaRestriccion(error, RESTRICCION_ALTERNATIVA)) throw alternativaInvalida();
    throw error;
  }
  if (!guardada) throw new Error('El ítem bloqueado no se pudo responder.');
}

/** Lista fija de campos: lo corregido de la vista y el estado del cupo, nada más. */
function resultado(corregido: ItemCorregido, cupo: EstadoCupo) {
  const alternativas = [...corregido.alternativas].sort((a, b) => a.letra.localeCompare(b.letra));
  return {
    esCorrecta: corregido.esCorrecta,
    alternativaElegidaId: corregido.alternativaElegidaId,
    alternativaCorrectaId: corregido.alternativaCorrectaId,
    explicacion: corregido.explicacion,
    alternativas: alternativas.map(({ id, letra, texto, explicacion }) => ({
      id,
      letra,
      texto,
      explicacion: explicacion ?? null,
    })),
    cupo: {
      maximo: cupo.maximo,
      usadas: cupo.usadas,
      restantes: cupo.restantes,
      saldoExtra: cupo.saldoExtra,
      agotado: cupo.agotado,
    },
  };
}

async function responder(
  dependencias: DependenciasRespuestas,
  estudianteId: string,
  { evaluacionId, itemId, alternativaId }: DatosRespuesta,
) {
  const { repositorio, unidadDeTrabajo, cuentas, cupo } = dependencias;
  const ahora = dependencias.reloj();
  return unidadDeTrabajo.enTransaccion(async (tx) => {
    const cuenta = await cuentas.estadoParaCupo(estudianteId, tx, true);
    if (!cuenta) throw itemNoEncontrado();
    const bloqueado = await repositorio.bloquearItem(evaluacionId, itemId, estudianteId, tx);
    if (bloqueado?.conTiempo)
      return responderConTiempo(repositorio, { evaluacionId, itemId, alternativaId }, tx);
    const item = comprobarItem(bloqueado, ahora);
    if (!(await repositorio.alternativasVisibles(itemId, tx)).includes(String(alternativaId)))
      throw alternativaInvalida();
    const datosCupo = { estudianteId, pruebaId: item.pruebaId, ...cuenta, ahora };
    const consumo = item.consumeCupo ? await cupo.reservarConsumo(datosCupo, tx) : null;
    await guardar(
      repositorio,
      { itemId, alternativaId, ahora, tipoConsumo: consumo?.tipo ?? null },
      tx,
    );
    await consumo?.confirmar(itemId);
    const corregido = await repositorio.leerCorreccion(itemId, estudianteId, tx);
    if (!corregido) throw new Error('La respuesta guardada no apareció corregida en la vista.');
    return resultado(corregido, await cupo.consultarCupo(datosCupo, tx));
  });
}

async function responderConTiempo(
  repositorio: RespuestasRepositorio,
  datos: DatosRespuesta,
  tx: Ejecutor,
) {
  if (
    !(await repositorio.alternativasVisibles(datos.itemId, tx)).includes(
      String(datos.alternativaId),
    )
  )
    throw alternativaInvalida();
  const respuesta = await repositorio.guardarConTiempo(datos.itemId, datos.alternativaId, tx);
  if (!respuesta)
    throw new ErrorAplicacion(
      409,
      'EVALUACION_CERRADA',
      'Esta evaluación ya terminó: se entregó o se acabó el tiempo.',
    );
  return respuesta;
}

export function crearRespuestasServicio(dependencias: DependenciasRespuestas) {
  return {
    responderPregunta: (estudianteId: string, datos: DatosRespuesta) =>
      responder(dependencias, estudianteId, datos),
  };
}

export type RespuestasServicio = ReturnType<typeof crearRespuestasServicio>;
