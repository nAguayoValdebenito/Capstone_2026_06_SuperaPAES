// Reglas de negocio del módulo suscripciones: planes, suscripciones compradas en Google Play o la
// App Store, pagos, historial de estados y avisos de las tiendas.
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
// La pasarela de cada tienda llega desde la FabricaProveedores; este módulo nunca crea una.
import type { PasarelasPorTienda } from '../../adaptadores/fabrica.js';
import type { Reloj } from '../../comun/reloj.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { DependenciasCorreoMora } from './suscripciones.avisos.correo.js';
import {
  crearCierreRepositorio,
  type CierreRepositorio,
} from './suscripciones.cierre.repositorio.js';
import { crearAvisosRepositorio } from './suscripciones.avisos.repositorio.js';
import { crearAvisosServicio, type AvisosServicio } from './suscripciones.avisos.servicio.js';
import { crearComprasRepositorio } from './suscripciones.compras.repositorio.js';
import { crearComprasServicio, type ComprasServicio } from './suscripciones.compras.servicio.js';
import {
  crearTrazabilidadRepositorio,
  type TrazabilidadRepositorio,
} from './suscripciones.trazabilidad.repositorio.js';
import {
  crearTrazabilidadServicio,
  type TrazabilidadServicio,
} from './suscripciones.trazabilidad.servicio.js';
import { crearValidacionRepositorio } from './suscripciones.validacion.repositorio.js';
import {
  crearValidacionServicio,
  type ValidacionServicio,
} from './suscripciones.validacion.servicio.js';
import {
  crearSuscripcionesRepositorio,
  type SuscripcionesRepositorio,
  type SuscripcionVigente,
} from './suscripciones.repositorio.js';

export interface DependenciasSuscripcionesServicio {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  /** Hora actual, para las reglas que dependen del tiempo. */
  reloj: Reloj;
  pagos: PasarelasPorTienda;
  /** Solo para pruebas: reemplaza al repositorio que se crea con crearSuscripcionesRepositorio(bd). */
  repositorio?: SuscripcionesRepositorio;
  /** Solo para pruebas: reemplaza al de la trazabilidad en la consola (HU-56). */
  repositorioTrazabilidad?: TrazabilidadRepositorio;
  /** CU-12 4.b: el correo de mora (cuentas, proveedor de correo y segundo plano). */
  correoMora?: DependenciasCorreoMora;
}

/**
 * recibirAviso (HU-44.1) verifica y procesa un aviso de una tienda (RN-17): se registra una sola vez en
 * app.evento_pasarela y cada cambio de estado o de plan queda en app.suscripcion_evento, con el plan
 * anterior y el nuevo, partiendo del último registro.
 */
export interface SuscripcionesServicio
  extends ComprasServicio, ValidacionServicio, TrazabilidadServicio, AvisosServicio {
  /**
   * RN-04: ¿una suscripción activa o en mora cubre la prueba? Si la cubre, responder no descuenta
   * cupo (lo pregunta cupo-invitaciones dentro de la transacción de la respuesta).
   */
  cubrePrueba(estudianteId: string, pruebaId: number, tx: Ejecutor): Promise<boolean>;
  /** HU-42: el ensayo oficial exige alcance Todas las pruebas. */
  permiteEnsayoCompleto(estudianteId: string, tx: Ejecutor): Promise<boolean>;
  /**
   * RN-34: la suscripción activa o en mora del estudiante, que la tienda sigue cobrando; `null` si
   * no tiene. La pide privacidad antes de borrar la cuenta (HU-08.2, A42b).
   */
  vigenteDe(estudianteId: string): Promise<SuscripcionVigente | null>;
  /**
   * HU-45.1 (CU-12 1.a), tarea horaria: deja cancelada cada activa que canceló la renovación y terminó
   * su período pagado hace más de un día, por si el aviso de vencimiento de la tienda no llegó. Cada
   * cierre queda en el historial con origen sistema. Devuelve cuántas cerró.
   */
  cerrarCanceladasVencidas(): Promise<number>;
}

/** HU-45.1: cierra en una transacción las canceladas que terminaron su período (ver la interfaz). */
function cerrarCanceladas(
  dependencias: DependenciasSuscripcionesServicio,
  cierre: CierreRepositorio,
  compras: ReturnType<typeof crearComprasRepositorio>,
): Promise<number> {
  return dependencias.unidadDeTrabajo.enTransaccion(async (tx) => {
    const ahora = dependencias.reloj();
    const porCerrar = await cierre.porCerrar(ahora, tx);
    for (const { id, planId } of porCerrar) {
      await cierre.cancelar(id, tx);
      await compras.registrarCambio(
        {
          suscripcionId: id,
          estadoAnterior: 'activa',
          estadoNuevo: 'cancelada',
          planAnterior: planId,
          planNuevo: planId,
          origen: 'sistema',
          detalle: 'Terminó el período pagado sin renovación',
          ahora,
        },
        tx,
      );
    }
    return porCerrar.length;
  });
}

export function crearSuscripcionesServicio(
  dependencias: DependenciasSuscripcionesServicio,
): SuscripcionesServicio {
  const repositorio = dependencias.repositorio ?? crearSuscripcionesRepositorio(dependencias.bd);
  const comprasRepositorio = crearComprasRepositorio(dependencias.bd);
  const base = { unidadDeTrabajo: dependencias.unidadDeTrabajo, reloj: dependencias.reloj };
  const compras = crearComprasServicio({ ...base, repositorio: comprasRepositorio });
  const validacionRepositorio = crearValidacionRepositorio(dependencias.bd);
  const validacion = crearValidacionServicio({
    ...base,
    pagos: dependencias.pagos,
    compras: comprasRepositorio,
    validacion: validacionRepositorio,
  });
  const avisos = crearAvisosServicio({
    ...base,
    pagos: dependencias.pagos,
    avisos: crearAvisosRepositorio(dependencias.bd),
    compras: comprasRepositorio,
    validacion: validacionRepositorio,
    ...(dependencias.correoMora && { correoMora: dependencias.correoMora }),
  });
  const trazabilidad = crearTrazabilidadServicio(
    dependencias.repositorioTrazabilidad ?? crearTrazabilidadRepositorio(dependencias.bd),
  );
  return {
    ...compras,
    ...validacion,
    ...trazabilidad,
    ...avisos,
    // Sigue solo el estado (RN-26): los avisos de las tiendas (HU-44) la pasan a cancelada o vencida
    // al terminar su período; sin avisos, una activa sigue cubriendo después de periodo_fin (A-03).
    cubrePrueba: (estudianteId, pruebaId, tx) =>
      repositorio.cubrePrueba(estudianteId, pruebaId, tx),
    permiteEnsayoCompleto: (estudianteId, tx) =>
      repositorio.permiteEnsayoCompleto(estudianteId, tx),
    vigenteDe: (estudianteId) => repositorio.vigenteDe(estudianteId),
    cerrarCanceladasVencidas: () =>
      cerrarCanceladas(dependencias, crearCierreRepositorio(dependencias.bd), comprasRepositorio),
  };
}
