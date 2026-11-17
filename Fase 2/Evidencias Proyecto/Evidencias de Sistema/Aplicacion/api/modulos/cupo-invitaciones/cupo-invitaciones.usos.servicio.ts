import { ErrorAplicacion } from '../../comun/errores.js';
import type { Ejecutor } from '../../db/transaccion.js';
import type { CoberturaSuscripcion } from './cupo-invitaciones.cupo.servicio.js';
import { crearUsosRepositorio, type UsoGratis } from './cupo-invitaciones.usos.repositorio.js';

/** Si el estudiante puede iniciar otro mini-ensayo de esa prueba este mes (A25 y A26, RN-05). */
export interface UsosGratisDelMes {
  /** Con una suscripción que cubre la prueba, sin límite (RN-04). */
  conPlan: boolean;
  /** Usos gratis que le quedan este mes; `null` con plan. */
  gratisRestantes: number | null;
}

export interface UsosGratis {
  registrarUsoGratis(datos: UsoGratis, tx: Ejecutor): Promise<void>;
  usosGratisDelMes(datos: Omit<UsoGratis, 'evaluacionId'>, tx: Ejecutor): Promise<UsosGratisDelMes>;
}

export function crearUsosGratis(suscripciones: CoberturaSuscripcion): UsosGratis {
  const repositorio = crearUsosRepositorio();
  return {
    async usosGratisDelMes(datos, tx) {
      if (await suscripciones.cubrePrueba(datos.estudianteId, datos.pruebaId, tx))
        return { conPlan: true, gratisRestantes: null };
      const { maximo, usados } = await repositorio.delMes(datos, tx);
      return { conPlan: false, gratisRestantes: Math.max(0, maximo - usados) };
    },
    async registrarUsoGratis(datos, tx) {
      if (await suscripciones.cubrePrueba(datos.estudianteId, datos.pruebaId, tx)) return;
      if (await repositorio.registrar(datos, tx)) return;
      throw new ErrorAplicacion(
        409,
        'USO_GRATIS_AGOTADO',
        'Ya usaste tu mini-ensayo gratis de esta prueba este mes. Puedes esperar al próximo mes o ver los planes.',
        { detalles: { motivo: 'limite_mensual', opciones: ['esperar_proximo_mes', 'ver_planes'] } },
      );
    },
  };
}
