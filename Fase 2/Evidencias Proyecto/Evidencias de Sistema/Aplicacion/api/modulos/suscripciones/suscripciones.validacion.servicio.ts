// Validación de compras (HU-43.1 esc. 2 y 3, CU-12 pasos 4 y 5, alternativos 1.b y 4.a). La API
// consulta la compra en la tienda fuera de la transacción (no bloquea filas mientras espera la red) y
// después, en una sola transacción, bloquea la suscripción, vuelve a comprobarla y aplica el resultado:
// estado, plan, compra, período, prueba de «Una prueba», historial (origen estudiante, RN-17) y pago
// (una vez por cobro). Repetir la misma compra no cambia nada. Solo cuenta lo que responde la tienda.
// La confirmación de Google (acknowledge) va después de la transacción: si falla, la suscripción sigue
// activa y se reintenta en la siguiente validación de esa compra, porque la tienda la sigue informando
// por confirmar.
import type {
  CompraVerificada,
  EstadoSuscripcion,
  PasarelaPago,
  PasarelasPorTienda,
} from '../../adaptadores/pagos/pasarela.js';
import {
  ErrorCompraNoValida,
  ErrorCompraYaRegistrada,
  ErrorConflicto,
  ErrorNoEncontrado,
  ErrorValidacion,
} from '../../comun/errores.js';
import { registro } from '../../comun/registro.js';
import type { Reloj } from '../../comun/reloj.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { ComprasRepositorio, FilaSuscripcion } from './suscripciones.compras.repositorio.js';
import { aSuscripcionApp, type SuscripcionApp } from './suscripciones.compras.servicio.js';
import { cuentaEnTienda } from './suscripciones.cuenta-tienda.js';
import type {
  PlanDeProducto,
  ValidacionRepositorio,
} from './suscripciones.validacion.repositorio.js';
import type { DatosCompra } from './suscripciones.validadores.js';

export interface DependenciasValidacion {
  unidadDeTrabajo: UnidadDeTrabajo;
  reloj: Reloj;
  pagos: PasarelasPorTienda;
  compras: ComprasRepositorio;
  validacion: ValidacionRepositorio;
}

interface Contexto {
  dependencias: DependenciasValidacion;
  suscripcion: FilaSuscripcion;
  compra: CompraVerificada;
  datos: DatosCompra;
  tx: Ejecutor;
}

const RESTRICCION_COMPRA_UNICA = 'suscripcion_id_compra_tienda_key';
const RESTRICCION_UNA_VIGENTE = 'ux_suscripcion_vigente';

/** RN-26: cancelada y vencida son estados finales. */
function exigirNoTerminada(suscripcion: FilaSuscripcion): void {
  if (suscripcion.estado === 'cancelada' || suscripcion.estado === 'vencida')
    throw new ErrorConflicto('Esta suscripción terminó. Para volver a suscribirte, elige un plan.');
}

/** La compra debe venir con la cuenta de esta suscripción (StoreKit puede escribirla en mayúsculas). */
function exigirCuenta(suscripcion: FilaSuscripcion, compra: CompraVerificada): void {
  if (compra.cuentaTienda?.toLowerCase() !== cuentaEnTienda(suscripcion.id))
    throw new ErrorCompraNoValida('otra_cuenta');
}

/**
 * RN-26: activa desde pendiente, fallida, activa o en mora; un pago en espera solo deja pendiente a
 * una pendiente, y un primer pago fallido solo deja fallida a una pendiente.
 */
function estadoTras(actual: EstadoSuscripcion, enTienda: CompraVerificada['estado']) {
  if (enTienda === 'activa') return 'activa';
  if (actual !== 'pendiente') return actual;
  return enTienda;
}

/** Una pendiente o fallida se compra con su plan; una activa o en mora puede cambiar de plan. */
async function planDeLaCompra(c: Contexto): Promise<PlanDeProducto> {
  const { suscripcion, compra, tx } = c;
  const plan = await c.dependencias.validacion.planDeProducto(
    suscripcion.tienda,
    compra.idProducto,
    tx,
  );
  if (!plan) throw new ErrorCompraNoValida('otro_producto');
  const sinComprar = suscripcion.estado === 'pendiente' || suscripcion.estado === 'fallida';
  if (sinComprar && plan.planId !== suscripcion.planId)
    throw new ErrorCompraNoValida('otro_producto');
  return plan;
}

function errorDePrueba(mensaje: string, motivo: string): ErrorValidacion {
  return new ErrorValidacion([{ lugar: 'cuerpo', ruta: 'pruebaId', mensaje, motivo }], mensaje);
}

/**
 * RN-05: Todas las pruebas no lleva prueba; al bajar a Una prueba hay que elegirla. Cambiar solo la
 * prueba de Una prueba no pasa por la tienda y queda fuera de HU-43.1.
 */
async function pruebaDelPlan(c: Contexto, plan: PlanDeProducto): Promise<number | null> {
  const elegida = c.datos.pruebaId;
  const actual = c.suscripcion.pruebaId;
  if (plan.alcance === 'todas') {
    if (elegida === undefined) return null;
    throw errorDePrueba('Todas las pruebas no lleva una prueba elegida.', 'prueba_no_corresponde');
  }
  if (elegida === undefined) {
    if (actual === null)
      throw errorDePrueba('Elige la prueba de tu plan Una prueba.', 'prueba_requerida');
    return actual;
  }
  if (actual !== null && elegida !== actual)
    throw new ErrorConflicto('Por ahora no se puede cambiar la prueba de tu plan Una prueba.');
  if (!(await c.dependencias.compras.pruebaExiste(elegida, c.tx)))
    throw errorDePrueba('La prueba elegida no existe.', 'prueba_inexistente');
  return elegida;
}

/** App Store: una bajada rige al renovar; se informa sin guardar un cambio programado (RN-05). */
async function cambioEnRenovacion(c: Contexto, planId: number, periodoFin: Date | null) {
  const siguiente = c.compra.productoRenovacion;
  if (siguiente === null || periodoFin === null) return null;
  const plan = await c.dependencias.validacion.planDeProducto(
    c.suscripcion.tienda,
    siguiente,
    c.tx,
  );
  return plan && plan.planId !== planId ? { planId: plan.planId, desde: periodoFin } : null;
}

async function registrarHistorialYPago(
  c: Contexto,
  estado: EstadoSuscripcion,
  plan: PlanDeProducto,
  ahora: Date,
): Promise<void> {
  const { suscripcion, compra, tx } = c;
  if (estado !== suscripcion.estado || plan.planId !== suscripcion.planId) {
    await c.dependencias.compras.registrarCambio(
      {
        suscripcionId: suscripcion.id,
        estadoAnterior: suscripcion.estado,
        estadoNuevo: estado,
        planAnterior: suscripcion.planId,
        planNuevo: plan.planId,
        origen: 'estudiante',
        ahora,
      },
      tx,
    );
  }
  if (estado !== 'activa' || compra.idPagoPasarela === null || compra.periodoFin === null) return;
  await c.dependencias.validacion.registrarPago(
    {
      suscripcionId: suscripcion.id,
      idPagoPasarela: compra.idPagoPasarela,
      montoClp: plan.precioClp,
      periodoInicio: compra.periodoInicio,
      periodoFin: compra.periodoFin,
      meses: plan.meses,
      ahora,
    },
    tx,
  );
}

interface Resultado {
  plan: PlanDeProducto;
  idProducto: string;
  pruebaId: number | null;
  periodoFin: Date | null;
}

/** Solo una compra activa cambia el plan, la prueba y el período; un pago en espera o fallido, no. */
async function resultadoDe(
  c: Contexto,
  estado: EstadoSuscripcion,
  comprado: PlanDeProducto,
): Promise<Resultado> {
  const { suscripcion, compra } = c;
  if (estado !== 'activa')
    return {
      plan: { ...comprado, planId: suscripcion.planId },
      idProducto: suscripcion.idProducto,
      pruebaId: suscripcion.pruebaId,
      periodoFin: suscripcion.periodoFin,
    };
  return {
    plan: comprado,
    idProducto: comprado.idProducto,
    pruebaId: await pruebaDelPlan(c, comprado),
    periodoFin: compra.periodoFin,
  };
}

async function exigirCompraLibre(c: Contexto): Promise<void> {
  const enOtra = await c.dependencias.validacion.compraEnOtraSuscripcion(
    c.compra.idCompraTienda,
    c.suscripcion.id,
    c.tx,
  );
  if (enOtra) throw new ErrorCompraYaRegistrada();
}

/** Una activa o en mora con un pago en espera o fallido en la tienda queda igual. */
async function aplicar(c: Contexto): Promise<SuscripcionApp> {
  const { suscripcion, compra, tx } = c;
  const estado = estadoTras(suscripcion.estado, compra.estado);
  if (estado !== 'activa' && estado === suscripcion.estado && estado !== 'pendiente')
    return aSuscripcionApp(suscripcion);
  const comprado = await planDeLaCompra(c);
  await exigirCompraLibre(c);
  const r = await resultadoDe(c, estado, comprado);
  const ahora = c.dependencias.reloj();
  await c.dependencias.validacion.aplicarCompra(
    {
      suscripcionId: suscripcion.id,
      estado,
      planId: r.plan.planId,
      idCompraTienda: compra.idCompraTienda,
      periodoFin: r.periodoFin,
      ahora,
    },
    tx,
  );
  if (r.pruebaId !== suscripcion.pruebaId)
    await c.dependencias.compras.fijarPrueba(suscripcion.id, r.pruebaId, tx);
  await registrarHistorialYPago(c, estado, r.plan, ahora);
  return {
    ...aSuscripcionApp({ ...suscripcion, estado, ...r, planId: r.plan.planId }),
    cambioEnRenovacion:
      estado === 'activa' ? await cambioEnRenovacion(c, r.plan.planId, r.periodoFin) : null,
  };
}

/** Dos validaciones a la vez: la compra única o la única vigente las detiene en la base. */
function traducirConflicto(error: unknown): unknown {
  const { code, constraint } = (error ?? {}) as { code?: unknown; constraint?: unknown };
  if (code !== '23505') return error;
  if (constraint === RESTRICCION_COMPRA_UNICA) return new ErrorCompraYaRegistrada();
  if (constraint === RESTRICCION_UNA_VIGENTE)
    return new ErrorConflicto('Ya tienes otra suscripción en curso.');
  return error;
}

/** Confirma la compra en la tienda; si falla, lo registra sin la compra y se reintenta después. */
async function confirmar(pasarela: PasarelaPago, compra: CompraVerificada, suscripcionId: string) {
  try {
    await pasarela.confirmarCompra({
      idProducto: compra.idProducto,
      idCompraTienda: compra.idCompraTienda,
    });
  } catch (error) {
    registro.error(
      'No se pudo confirmar la compra en la tienda; se reintenta al volver a validarla',
      {
        tienda: compra.tienda,
        suscripcionId,
        error: error instanceof Error ? error.name : 'otro',
      },
    );
  }
}

export interface ValidacionServicio {
  /**
   * HU-43.1: valida la compra de la suscripción con su tienda y la activa, la deja pendiente o fallida,
   * o cambia su plan. Una suscripción ajena o inexistente responde 404.
   */
  validarCompra(
    estudianteId: string,
    suscripcionId: string,
    datos: DatosCompra,
  ): Promise<SuscripcionApp>;
}

export function crearValidacionServicio(dependencias: DependenciasValidacion): ValidacionServicio {
  const { validacion } = dependencias;
  const buscar = async (estudianteId: string, id: string, tx?: Ejecutor) => {
    const suscripcion = await validacion.suscripcionDe(estudianteId, id, tx, tx !== undefined);
    if (!suscripcion) throw new ErrorNoEncontrado('La suscripción no existe.');
    exigirNoTerminada(suscripcion);
    return suscripcion;
  };
  return {
    async validarCompra(estudianteId, suscripcionId, datos) {
      const antes = await buscar(estudianteId, suscripcionId);
      const pasarela = dependencias.pagos[antes.tienda];
      const compra = await pasarela.verificarCompra(datos.idCompraTienda);
      const resultado = await dependencias.unidadDeTrabajo
        .enTransaccion(async (tx) => {
          const suscripcion = await buscar(estudianteId, suscripcionId, tx);
          exigirCuenta(suscripcion, compra);
          return aplicar({ dependencias, suscripcion, compra, datos, tx });
        })
        .catch((error: unknown) => {
          throw traducirConflicto(error);
        });
      if (compra.porConfirmar && resultado.estado === 'activa')
        await confirmar(pasarela, compra, suscripcionId);
      return resultado;
    },
  };
}
