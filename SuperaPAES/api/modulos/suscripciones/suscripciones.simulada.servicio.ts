// Suscripción simulada del modo de pruebas (MODO_PRUEBAS_SUSCRIPCION). Hoy la app no compra en las tiendas,
// así que la consola no tendría ninguna suscripción que mostrar: este modo crea una activa en el canal
// «prueba», solo para ver su registro en la trazabilidad (HU-56). No llama a ninguna tienda, no registra
// pagos (no suma a app.v_pagos_mes) y queda fuera de la validación de compras, los avisos de las tiendas,
// el cierre de canceladas y el aviso de renovación. Los cobros reales quedan como mejora futura.
import { ErrorConflicto, ErrorNoEncontrado } from '../../comun/errores.js';
import type { Reloj } from '../../comun/reloj.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import { CANAL_PRUEBA } from './suscripciones.canal-prueba.js';
import type { ComprasRepositorio } from './suscripciones.compras.repositorio.js';
import { pruebaDelPlan } from './suscripciones.compras.servicio.js';
import type { SimuladaRepositorio } from './suscripciones.simulada.repositorio.js';
import type { DatosSuscripcionSimulada } from './suscripciones.validadores.js';

/** Días del período simulado: desde ahora hasta ahora + 30 días. */
export const DIAS_PERIODO_SIMULADO = 30;

/** Lo que queda en el historial (RN-17), para que la consola lo distinga. */
export const DETALLE_SIMULADA = 'Suscripción simulada (modo de pruebas)';

const RESTRICCION_UNA_VIGENTE = 'ux_suscripcion_vigente';
const MENSAJE_YA_TIENE = 'Ya tienes una suscripción en curso.';

/** La suscripción simulada tal como la recibe la app. */
export interface SuscripcionSimulada {
  id: string;
  estado: 'activa';
  planId: number;
  tienda: typeof CANAL_PRUEBA;
  pruebaId: number | null;
  inicio: Date;
  periodoFin: Date;
}

export interface DependenciasSimulada {
  unidadDeTrabajo: UnidadDeTrabajo;
  reloj: Reloj;
  /** MODO_PRUEBAS_SUSCRIPCION; apagado, la creación responde 404. */
  modoPruebas: boolean;
  simulada: SimuladaRepositorio;
  compras: Pick<ComprasRepositorio, 'pruebaExiste' | 'fijarPrueba' | 'registrarCambio'>;
}

function violaUnaVigente(error: unknown): boolean {
  const { code, constraint } = (error ?? {}) as { code?: unknown; constraint?: unknown };
  return code === '23505' && constraint === RESTRICCION_UNA_VIGENTE;
}

async function crearEnTransaccion(
  dependencias: DependenciasSimulada,
  estudianteId: string,
  datos: DatosSuscripcionSimulada,
  tx: Ejecutor,
): Promise<SuscripcionSimulada> {
  const { simulada, compras } = dependencias;
  const plan = await simulada.planActivo(datos.planId, tx);
  if (!plan) throw new ErrorNoEncontrado('El plan no existe o no está disponible.');
  // RN-05, igual que la compra.
  const pruebaId = await pruebaDelPlan(compras, plan, datos.pruebaId, tx);
  if (await simulada.tieneVigente(estudianteId, tx)) throw new ErrorConflicto(MENSAJE_YA_TIENE);
  const inicio = dependencias.reloj();
  const periodoFin = new Date(inicio.getTime() + DIAS_PERIODO_SIMULADO * 24 * 60 * 60 * 1000);
  const id = await simulada.insertarActiva(
    { estudianteId, planId: plan.planId, ahora: inicio, periodoFin },
    tx,
  );
  await compras.fijarPrueba(id, pruebaId, tx);
  await compras.registrarCambio(
    {
      suscripcionId: id,
      estadoAnterior: null,
      estadoNuevo: 'activa',
      planAnterior: null,
      planNuevo: plan.planId,
      origen: 'sistema',
      detalle: DETALLE_SIMULADA,
      ahora: inicio,
    },
    tx,
  );
  return {
    id,
    estado: 'activa',
    planId: plan.planId,
    tienda: CANAL_PRUEBA,
    pruebaId,
    inicio,
    periodoFin,
  };
}

export interface SimuladaServicio {
  /** ¿Está encendido MODO_PRUEBAS_SUSCRIPCION? Lo informa GET /planes y monta la ruta de creación. */
  modoPruebasActivo(): boolean;
  /**
   * Crea la suscripción simulada: activa, canal «prueba», período de 30 días y su primer registro del
   * historial con origen sistema. 404 con el modo apagado o un plan inexistente o inactivo; 409 si el
   * estudiante ya tiene una vigente (pendiente, activa o en mora).
   */
  crearSimulada(
    estudianteId: string,
    datos: DatosSuscripcionSimulada,
  ): Promise<SuscripcionSimulada>;
}

export function crearSimuladaServicio(dependencias: DependenciasSimulada): SimuladaServicio {
  return {
    modoPruebasActivo: () => dependencias.modoPruebas,
    async crearSimulada(estudianteId, datos) {
      if (!dependencias.modoPruebas) throw new ErrorNoEncontrado('La ruta solicitada no existe.');
      try {
        return await dependencias.unidadDeTrabajo.enTransaccion((tx) =>
          crearEnTransaccion(dependencias, estudianteId, datos, tx),
        );
      } catch (error) {
        // Dos pedidos a la vez: el índice de una sola vigente detiene al segundo.
        if (violaUnaVigente(error)) throw new ErrorConflicto(MENSAJE_YA_TIENE);
        throw error;
      }
    },
  };
}
