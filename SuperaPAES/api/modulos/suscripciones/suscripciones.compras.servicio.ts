// Compras de suscripciones (HU-43.1, CU-12 pasos 2 y 3): la suscripción pendiente que la app compra
// después en la tienda. Una pendiente se reutiliza (el índice ux_suscripcion_vigente deja una sola
// vigente por estudiante); con una activa o en mora, el nuevo plan se compra en la tienda.
import type { Tienda } from '../../adaptadores/pagos/pasarela.js';
import { ErrorConflicto, ErrorNoEncontrado, ErrorValidacion } from '../../comun/errores.js';
import type { Reloj } from '../../comun/reloj.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type {
  ComprasRepositorio,
  FilaSuscripcion,
  PlanEnTienda,
} from './suscripciones.compras.repositorio.js';
import { cuentaEnTienda } from './suscripciones.cuenta-tienda.js';
import type { DatosNuevaSuscripcion } from './suscripciones.validadores.js';

/** La suscripción tal como la ve la app (A44): sin datos de la compra en la tienda. */
export interface SuscripcionApp {
  id: string;
  estado: FilaSuscripcion['estado'];
  planId: number;
  tienda: Tienda;
  pruebaId: number | null;
  /** Producto que la app compra en la tienda (contenido.plan_producto_tienda). */
  idProducto: string;
  /** Lo que la app pasa a la tienda al comprar, para ligar la compra a esta suscripción. */
  cuentaTienda: string;
  periodoFin: Date | null;
  /** Solo en la App Store: una bajada de plan rige desde la siguiente renovación (RN-05). */
  cambioEnRenovacion: { planId: number; desde: Date } | null;
}

export interface DependenciasCompras {
  unidadDeTrabajo: UnidadDeTrabajo;
  reloj: Reloj;
  repositorio: ComprasRepositorio;
}

const RESTRICCION_UNA_VIGENTE = 'ux_suscripcion_vigente';

function violaUnaVigente(error: unknown): boolean {
  const { code, constraint } = (error ?? {}) as { code?: unknown; constraint?: unknown };
  return code === '23505' && constraint === RESTRICCION_UNA_VIGENTE;
}

function errorDePrueba(mensaje: string, motivo: string): ErrorValidacion {
  return new ErrorValidacion([{ lugar: 'cuerpo', ruta: 'pruebaId', mensaje, motivo }], mensaje);
}

export function aSuscripcionApp(fila: FilaSuscripcion): SuscripcionApp {
  return {
    id: fila.id,
    estado: fila.estado,
    planId: fila.planId,
    tienda: fila.tienda,
    pruebaId: fila.pruebaId,
    idProducto: fila.idProducto,
    cuentaTienda: cuentaEnTienda(fila.id),
    periodoFin: fila.periodoFin,
    cambioEnRenovacion: null,
  };
}

/** RN-05: Una prueba exige elegir una prueba que exista; Todas las pruebas no lleva prueba. */
async function pruebaDelPlan(
  dependencias: DependenciasCompras,
  plan: PlanEnTienda,
  pruebaId: number | undefined,
  tx: Ejecutor,
): Promise<number | null> {
  if (plan.alcance === 'todas') {
    if (pruebaId === undefined) return null;
    throw errorDePrueba('Todas las pruebas no lleva una prueba elegida.', 'prueba_no_corresponde');
  }
  if (pruebaId === undefined)
    throw errorDePrueba('Elige la prueba de tu plan Una prueba.', 'prueba_requerida');
  if (!(await dependencias.repositorio.pruebaExiste(pruebaId, tx)))
    throw errorDePrueba('La prueba elegida no existe.', 'prueba_inexistente');
  return pruebaId;
}

/** Lo que pidió el estudiante, ya validado contra el plan. */
interface Pedido {
  estudianteId: string;
  plan: PlanEnTienda;
  tienda: Tienda;
  pruebaId: number | null;
}

/** Con una pendiente sin compra en curso, la ajusta al nuevo pedido; si no, 409 (RN-26). */
async function reutilizar(
  dependencias: DependenciasCompras,
  vigente: FilaSuscripcion,
  pedido: Pedido,
  tx: Ejecutor,
): Promise<SuscripcionApp> {
  const { repositorio } = dependencias;
  if (vigente.estado !== 'pendiente')
    throw new ErrorConflicto(
      'Ya tienes una suscripción. Para cambiar de plan, elige el nuevo plan y cómpralo en la tienda.',
    );
  if (vigente.idCompraTienda !== null)
    throw new ErrorConflicto('Tu compra está esperando el pago en la tienda.');
  const { plan, tienda, pruebaId } = pedido;
  await repositorio.cambiarPlanPendiente(vigente.id, plan.planId, tienda, tx);
  await repositorio.fijarPrueba(vigente.id, pruebaId, tx);
  if (vigente.planId !== plan.planId) {
    await repositorio.registrarCambio(
      {
        suscripcionId: vigente.id,
        estadoAnterior: 'pendiente',
        estadoNuevo: 'pendiente',
        planAnterior: vigente.planId,
        planNuevo: plan.planId,
        origen: 'estudiante',
        ahora: dependencias.reloj(),
      },
      tx,
    );
  }
  return aSuscripcionApp({
    ...vigente,
    planId: plan.planId,
    tienda,
    idProducto: plan.idProducto,
    pruebaId,
  });
}

/** La pendiente nueva, con su prueba y el primer registro del historial (sin estado ni plan anterior). */
async function crearNueva(
  dependencias: DependenciasCompras,
  pedido: Pedido,
  tx: Ejecutor,
): Promise<SuscripcionApp> {
  const { repositorio } = dependencias;
  const { estudianteId, plan, tienda, pruebaId } = pedido;
  const ahora = dependencias.reloj();
  const id = await repositorio.insertarPendiente(
    { estudianteId, planId: plan.planId, tienda, ahora },
    tx,
  );
  await repositorio.fijarPrueba(id, pruebaId, tx);
  await repositorio.registrarCambio(
    {
      suscripcionId: id,
      estadoAnterior: null,
      estadoNuevo: 'pendiente',
      planAnterior: null,
      planNuevo: plan.planId,
      origen: 'estudiante',
      ahora,
    },
    tx,
  );
  return aSuscripcionApp({
    id,
    estudianteId,
    estado: 'pendiente',
    planId: plan.planId,
    tienda,
    idProducto: plan.idProducto,
    idCompraTienda: null,
    periodoFin: null,
    pruebaId,
  });
}

function crearOReutilizar(
  dependencias: DependenciasCompras,
  estudianteId: string,
  datos: DatosNuevaSuscripcion,
) {
  const { repositorio } = dependencias;
  return dependencias.unidadDeTrabajo.enTransaccion(async (tx) => {
    const plan = await repositorio.planEnTienda(datos.planId, datos.tienda, tx);
    if (!plan) throw new ErrorNoEncontrado('El plan no existe o no está disponible.');
    const pruebaId = await pruebaDelPlan(dependencias, plan, datos.pruebaId, tx);
    const pedido: Pedido = { estudianteId, plan, tienda: datos.tienda, pruebaId };
    const vigente = await repositorio.vigenteBloqueada(estudianteId, tx);
    if (vigente)
      return { suscripcion: await reutilizar(dependencias, vigente, pedido, tx), creada: false };
    return { suscripcion: await crearNueva(dependencias, pedido, tx), creada: true };
  });
}

export interface ComprasServicio {
  /**
   * CU-12 paso 3: crea la suscripción pendiente del plan elegido o reutiliza la pendiente del
   * estudiante. `creada` distingue la nueva (201) de la reutilizada (200).
   */
  crearPendiente(
    estudianteId: string,
    datos: DatosNuevaSuscripcion,
  ): Promise<{ suscripcion: SuscripcionApp; creada: boolean }>;
}

export function crearComprasServicio(dependencias: DependenciasCompras): ComprasServicio {
  return {
    // Dos pedidos a la vez no encuentran pendiente y ambos la crean: el índice de una sola vigente
    // rechaza el segundo, que se repite una vez y reutiliza la que ya existe.
    async crearPendiente(estudianteId, datos) {
      try {
        return await crearOReutilizar(dependencias, estudianteId, datos);
      } catch (error) {
        if (!violaUnaVigente(error)) throw error;
        return crearOReutilizar(dependencias, estudianteId, datos);
      }
    },
  };
}
