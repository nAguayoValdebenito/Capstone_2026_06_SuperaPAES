// Reglas de negocio del módulo suscripciones: planes, suscripciones compradas en Google Play o la
// App Store, pagos, historial de estados y avisos de las tiendas.
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
// La pasarela de cada tienda llega desde la FabricaProveedores; este módulo nunca crea una.
import type { PasarelasPorTienda } from '../../adaptadores/fabrica.js';
import type { Reloj } from '../../comun/reloj.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import {
  crearPlanesServicio,
  type DependenciasPlanes,
  type PlanesServicio,
} from './suscripciones.planes.servicio.js';
import type { DependenciasCorreoMora } from './suscripciones.avisos.correo.js';
import {
  crearCierreRepositorio,
  type CierreRepositorio,
} from './suscripciones.cierre.repositorio.js';
import { crearAvisosRepositorio } from './suscripciones.avisos.repositorio.js';
import { gestionEnTienda } from './suscripciones.gestion-tienda.js';
import {
  crearAvisoRenovacion,
  type DependenciasAvisoRenovacion,
  type ResultadoRenovacion,
} from './suscripciones.renovacion.servicio.js';
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
  type FilaVigente,
  type PlanOfrecido,
  type SuscripcionesRepositorio,
  type SuscripcionVigente,
} from './suscripciones.repositorio.js';

export interface DependenciasSuscripcionesServicio {
  administracion: DependenciasPlanes['administracion'];
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
  /** HU-45.2: paquete de la app en Google Play; sin él se abre la lista de suscripciones. */
  paqueteGooglePlay?: string;
  /** HU-45.3: el aviso de renovación anual (auditoría, cuentas, correo y candados). */
  avisoRenovacion?: DependenciasAvisoRenovacion;
}

/**
 * recibirAviso (HU-44.1) verifica y procesa un aviso de una tienda (RN-17): se registra una sola vez en
 * app.evento_pasarela y cada cambio de estado o de plan queda en app.suscripcion_evento, con el plan
 * anterior y el nuevo, partiendo del último registro.
 */
export interface SuscripcionesServicio
  extends
    ComprasServicio,
    ValidacionServicio,
    TrazabilidadServicio,
    AvisosServicio,
    PlanesServicio {
  /**
   * RN-04: ¿una suscripción activa o en mora cubre la prueba? Si la cubre, responder no descuenta
   * cupo (lo pregunta cupo-invitaciones dentro de la transacción de la respuesta). Una activa cubre
   * hasta un día después del fin de su período, por si el aviso de la tienda no llega (A-03).
   */
  cubrePrueba(estudianteId: string, pruebaId: number, tx: Ejecutor): Promise<boolean>;
  /** CU-12 paso 1 (A43): los planes activos, con su precio y su producto en cada tienda. */
  planesOfrecidos(): Promise<PlanOfrecido[]>;
  /** HU-42: el ensayo oficial exige alcance Todas las pruebas. */
  permiteEnsayoCompleto(estudianteId: string, tx: Ejecutor): Promise<boolean>;
  /**
   * RN-34: la suscripción activa o en mora del estudiante, que la tienda sigue cobrando; `null` si
   * no tiene. La pide privacidad antes de borrar la cuenta (HU-08.2, A42b) y la muestra Mi suscripción
   * (A44), con la dirección para gestionarla en la tienda (HU-45.2).
   */
  vigenteDe(estudianteId: string): Promise<SuscripcionVigente | null>;
  /**
   * HU-45.1 (CU-12 1.a), tarea horaria: deja cancelada cada activa que canceló la renovación y terminó
   * su período pagado hace más de un día, por si el aviso de vencimiento de la tienda no llegó. Cada
   * cierre queda en el historial con origen sistema. Devuelve cuántas cerró.
   */
  cerrarCanceladasVencidas(): Promise<number>;
  /**
   * HU-45.3 (CU-12 4.c), tarea horaria: avisa por correo cada renovación anual de los próximos 7 días
   * que todavía no tiene aviso y lo registra en la auditoría. El que falla se reintenta la hora siguiente.
   */
  avisarRenovaciones(): Promise<ResultadoRenovacion>;
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

/** La vigente con la dirección de su tienda, sin el producto (HU-45.2). */
function conGestion(fila: FilaVigente | null, paquete?: string): SuscripcionVigente | null {
  if (!fila) return null;
  const { idProducto, ...vigente } = fila;
  return { ...vigente, gestionUrl: gestionEnTienda(fila.tienda, idProducto, paquete) };
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
    ...crearPlanesServicio(dependencias),
    ...compras,
    ...validacion,
    ...trazabilidad,
    ...avisos,
    planesOfrecidos: () => repositorio.planesOfrecidos(),
    cubrePrueba: (estudianteId, pruebaId, tx) =>
      repositorio.cubrePrueba(estudianteId, pruebaId, dependencias.reloj(), tx),
    permiteEnsayoCompleto: (estudianteId, tx) =>
      repositorio.permiteEnsayoCompleto(estudianteId, dependencias.reloj(), tx),
    vigenteDe: async (estudianteId) =>
      conGestion(
        await repositorio.vigenteDe(estudianteId, dependencias.reloj()),
        dependencias.paqueteGooglePlay,
      ),
    cerrarCanceladasVencidas: () =>
      cerrarCanceladas(dependencias, crearCierreRepositorio(dependencias.bd), comprasRepositorio),
    avisarRenovaciones: crearAvisoRenovacion(dependencias),
  };
}
