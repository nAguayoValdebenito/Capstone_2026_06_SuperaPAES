// Avisos de las tiendas (HU-44.1, CU-12 pasos 4 y 5, RN-17, RN-26). La API no confía en el tipo ni en
// el orden del aviso: verifica su origen y consulta a la tienda el estado de hoy de esa compra, fuera de
// la transacción (no bloquea filas mientras espera la red). Después, en una transacción, registra el
// aviso una sola vez, bloquea la suscripción y la lleva a ese estado si RN-26 lo permite, con su
// historial (origen pasarela, ligado al aviso) y el pago del cobro. Un aviso repetido no hace nada; uno
// que falló porque la tienda no respondió se procesa de nuevo cuando la tienda lo reintenta.
// Decisiones del 03/11/2026 en docs/contratos/HU-44.md.
import type {
  AvisoEntrante,
  AvisoVerificado,
  EstadoSuscripcion,
  PasarelasPorTienda,
  SuscripcionEnTienda,
} from '../../adaptadores/pagos/pasarela.js';
import { ErrorCompraNoValida, ErrorTiendaNoDisponible } from '../../comun/errores.js';
import { registro } from '../../comun/registro.js';
import type { Reloj } from '../../comun/reloj.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type {
  AvisosRepositorio,
  CambioDeAviso,
  ResultadoAviso,
} from './suscripciones.avisos.repositorio.js';
import type { ComprasRepositorio, FilaSuscripcion } from './suscripciones.compras.repositorio.js';
import { cuentaEnTienda } from './suscripciones.cuenta-tienda.js';
import { destinoDe, pasosHacia } from './suscripciones.transiciones.js';
import type {
  PlanDeProducto,
  ValidacionRepositorio,
} from './suscripciones.validacion.repositorio.js';

export interface DependenciasAvisos {
  unidadDeTrabajo: UnidadDeTrabajo;
  reloj: Reloj;
  pagos: PasarelasPorTienda;
  avisos: AvisosRepositorio;
  compras: ComprasRepositorio;
  validacion: ValidacionRepositorio;
}

interface Resultado {
  resultado: ResultadoAviso;
  detalle: string | null;
  suscripcionId: string | null;
  pagoId: string | null;
}

interface Contexto {
  d: DependenciasAvisos;
  aviso: AvisoVerificado;
  enTienda: SuscripcionEnTienda;
  eventoId: string;
  ahora: Date;
  tx: Ejecutor;
}

const ignorado = (detalle: string, suscripcionId: string | null = null): Resultado => ({
  resultado: 'ignorado',
  detalle,
  suscripcionId,
  pagoId: null,
});

/** La suscripción de la compra o, si ninguna la tiene, la pendiente o fallida de esa cuenta. */
async function suscripcionDe(c: Contexto): Promise<FilaSuscripcion | null> {
  const { avisos } = c.d;
  const { tienda } = c.aviso;
  const porCompra = await avisos.porCompra(tienda, c.enTienda.idCompraTienda, c.tx);
  const cuenta = c.enTienda.cuentaTienda?.toLowerCase();
  if (porCompra || !cuenta) return porCompra;
  const ids = await avisos.sinCompra(tienda, c.tx);
  const ligada = ids.find((id) => cuentaEnTienda(id) === cuenta);
  return ligada === undefined ? null : avisos.bloquearSinCompra(ligada, c.tx);
}

/** El plan del producto que informa la tienda; una pendiente o fallida solo se compra con su plan. */
async function planInformado(c: Contexto, s: FilaSuscripcion) {
  const { idProducto } = c.enTienda;
  if (idProducto === null) return { plan: null };
  const plan = await c.d.validacion.planDeProducto(c.aviso.tienda, idProducto, c.tx);
  const sinComprar = s.estado === 'pendiente' || s.estado === 'fallida';
  if (!plan || (sinComprar && plan.planId !== s.planId)) return { error: 'producto desconocido' };
  return { plan };
}

/** Período: solo crece mientras la suscripción da acceso; así un aviso atrasado no lo achica. */
function periodoTras(s: FilaSuscripcion, enTienda: SuscripcionEnTienda, final: EstadoSuscripcion) {
  const nuevo = enTienda.periodoFin;
  if ((final !== 'activa' && final !== 'en_mora') || nuevo === null) return s.periodoFin;
  return s.periodoFin !== null && s.periodoFin >= nuevo ? s.periodoFin : nuevo;
}

/** HU-45.1: sin renovación sigue activa y guarda cuándo canceló; al terminar, cancelada lo conserva. */
function canceladaTras(antes: Date | null, c: Contexto, final: EstadoSuscripcion) {
  if (final === 'activa') return c.enTienda.renovacionAutomatica ? null : (antes ?? c.ahora);
  if (final === 'cancelada') return antes ?? c.ahora;
  return antes;
}

const mismaFecha = (a: Date | null, b: Date | null) =>
  (a?.getTime() ?? null) === (b?.getTime() ?? null);

/** Registra cada paso en el historial; el cambio de plan va en el último (o solo, si no hay pasos). */
async function registrarHistorial(
  c: Contexto,
  s: FilaSuscripcion,
  pasos: EstadoSuscripcion[],
  planNuevo: number,
) {
  const tramos = pasos.length > 0 ? pasos : [s.estado];
  const detalle =
    c.enTienda.fin === 'reembolso' ? 'Reembolso o revocación de la tienda' : undefined;
  for (const [i, estado] of tramos.entries()) {
    const ultimo = i === tramos.length - 1;
    await c.d.compras.registrarCambio(
      {
        suscripcionId: s.id,
        estadoAnterior: i === 0 ? s.estado : (tramos[i - 1] ?? s.estado),
        estadoNuevo: estado,
        planAnterior: s.planId,
        planNuevo: ultimo ? planNuevo : s.planId,
        origen: 'pasarela',
        eventoPasarelaId: c.eventoId,
        ...(ultimo && detalle ? { detalle } : {}),
        ahora: c.ahora,
      },
      c.tx,
    );
  }
}

/** El pago del cobro informado, una vez por cobro (RN-17); devuelve su id si es de este aviso. */
async function registrarPago(
  c: Contexto,
  s: FilaSuscripcion,
  plan: PlanDeProducto,
): Promise<string | null> {
  const { idPagoPasarela, periodoFin, periodoInicio } = c.enTienda;
  if (idPagoPasarela === null || periodoFin === null) return null;
  if (await c.d.avisos.pagoId(s.id, idPagoPasarela, c.tx)) return null;
  await c.d.validacion.registrarPago(
    {
      suscripcionId: s.id,
      idPagoPasarela,
      montoClp: plan.precioClp,
      periodoInicio,
      periodoFin,
      meses: plan.meses,
      ahora: c.ahora,
    },
    c.tx,
  );
  return c.d.avisos.pagoId(s.id, idPagoPasarela, c.tx);
}

/** El plan con que queda: el de la tienda si queda activa; si no, el que tenía. */
async function planFinal(c: Contexto, s: FilaSuscripcion, plan: PlanDeProducto | null) {
  if (plan) return plan;
  const actual = await c.d.validacion.planDeProducto(c.aviso.tienda, s.idProducto, c.tx);
  if (!actual) throw new Error('La suscripción no tiene su producto en la tienda.');
  return actual;
}

/** Lleva la suscripción a lo que informa la tienda, o explica por qué no. */
/** El cambio que deja la suscripción como la informa la tienda. */
async function cambioHacia(
  c: Contexto,
  s: FilaSuscripcion,
  final: EstadoSuscripcion,
  plan: PlanDeProducto,
) {
  const antes = await c.d.avisos.canceladaEn(s.id, c.tx);
  const cambio: CambioDeAviso = {
    suscripcionId: s.id,
    estado: final,
    planId: plan.planId,
    idCompraTienda: s.idCompraTienda ?? c.enTienda.idCompraTienda,
    periodoFin: periodoTras(s, c.enTienda, final),
    canceladaEn: canceladaTras(antes, c, final),
    ahora: c.ahora,
  };
  const igual =
    cambio.estado === s.estado &&
    cambio.planId === s.planId &&
    cambio.idCompraTienda === s.idCompraTienda &&
    mismaFecha(cambio.periodoFin, s.periodoFin) &&
    mismaFecha(cambio.canceladaEn, antes);
  return { cambio, igual };
}

/** Lleva la suscripción a lo que informa la tienda, o explica por qué no. */
async function aplicar(c: Contexto, s: FilaSuscripcion): Promise<Resultado> {
  const informado = await planInformado(c, s);
  if ('error' in informado) return ignorado('Producto desconocido', s.id);
  const pasos = pasosHacia(s.estado, c.enTienda);
  if (pasos === null)
    return ignorado(`Cambio no permitido: ${s.estado} → ${destinoDe(s.estado, c.enTienda)}`, s.id);
  const final = pasos.at(-1) ?? s.estado;
  const plan = await planFinal(c, s, final === 'activa' ? informado.plan : null);
  const { cambio, igual } = await cambioHacia(c, s, final, plan);
  const pagoId = final === 'activa' ? await registrarPago(c, s, plan) : null;
  if (igual && pagoId === null) return ignorado('Sin cambios', s.id);
  await c.d.avisos.aplicar(cambio, c.tx);
  if (pasos.length > 0 || cambio.planId !== s.planId)
    await registrarHistorial(c, s, pasos, cambio.planId);
  return { resultado: 'procesado', detalle: null, suscripcionId: s.id, pagoId };
}

/** Lo que la tienda informa de la compra, o el motivo para ignorar el aviso. */
type Consulta = SuscripcionEnTienda | { ignorar: string };

async function procesarEn(c: Omit<Contexto, 'enTienda'>, consulta: Consulta) {
  if ('ignorar' in consulta) return ignorado(consulta.ignorar);
  const contexto = { ...c, enTienda: consulta };
  const suscripcion = await suscripcionDe(contexto);
  return suscripcion ? aplicar(contexto, suscripcion) : ignorado('Compra desconocida');
}

/**
 * Lo que la tienda informa hoy de la compra del aviso. Un reembolso o una revocación la terminan
 * aunque la tienda todavía la muestre vigente (decisión del 03/11/2026: queda cancelada).
 */
async function consultar(d: DependenciasAvisos, aviso: AvisoVerificado): Promise<Consulta> {
  if (aviso.idCompraTienda === null) return { ignorar: 'Aviso sin compra' };
  try {
    const enTienda = await d.pagos[aviso.tienda].consultarSuscripcion(aviso.idCompraTienda);
    return aviso.reembolso === true
      ? { ...enTienda, estado: 'terminada', fin: 'reembolso', idPagoPasarela: null }
      : enTienda;
  } catch (error) {
    if (!(error instanceof ErrorCompraNoValida)) throw error;
    const motivo = error.motivo === 'no_encontrada' ? 'Compra desconocida' : 'Estado no atendido';
    return { ignorar: `${motivo} en la tienda (${error.motivo})` };
  }
}

export interface AvisosServicio {
  /**
   * HU-44.1: verifica un aviso de la tienda (sin origen válido, la pasarela lo rechaza y no se
   * registra), consulta su compra y lo procesa una sola vez. Si la tienda no responde, el aviso queda
   * con error y se lanza ErrorTiendaNoDisponible (503) para que la tienda lo reintente.
   */
  recibirAviso(tienda: AvisoVerificado['tienda'], entrante: AvisoEntrante): Promise<void>;
}

export function crearAvisosServicio(d: DependenciasAvisos): AvisosServicio {
  /** En una transacción: registra el aviso (o espera al igual) y lo cierra con su resultado. */
  const unaVez = (
    aviso: AvisoVerificado,
    trabajo: (c: Omit<Contexto, 'enTienda'>) => Promise<Resultado>,
  ) =>
    d.unidadDeTrabajo.enTransaccion(async (tx) => {
      const ahora = d.reloj();
      const registrado = await d.avisos.registrar(aviso, ahora, tx);
      if (registrado.resultado === 'procesado' || registrado.resultado === 'ignorado') return;
      const r = await trabajo({ d, aviso, eventoId: registrado.id, ahora, tx });
      await d.avisos.cerrar(registrado.id, { ...r, ahora }, tx);
      registro.info('Aviso de tienda', {
        tienda: aviso.tienda,
        tipo: aviso.tipo,
        resultado: r.resultado,
      });
    });
  return {
    async recibirAviso(tienda, entrante) {
      const aviso = await d.pagos[tienda].verificarAviso(entrante);
      let consulta: Consulta;
      try {
        consulta = await consultar(d, aviso);
      } catch (error) {
        if (!(error instanceof ErrorTiendaNoDisponible)) throw error;
        await unaVez(aviso, () =>
          Promise.resolve({
            resultado: 'error' as const,
            detalle: 'La tienda no respondió',
            suscripcionId: null,
            pagoId: null,
          }),
        );
        throw error;
      }
      await unaVez(aviso, (c) => procesarEn(c, consulta));
    },
  };
}
