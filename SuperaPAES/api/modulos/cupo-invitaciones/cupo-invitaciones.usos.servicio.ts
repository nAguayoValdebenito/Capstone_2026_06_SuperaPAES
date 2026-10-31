import { ErrorAplicacion } from '../../comun/errores.js';
import type { Ejecutor } from '../../db/transaccion.js';
import type { CoberturaSuscripcion } from './cupo-invitaciones.cupo.servicio.js';
import { crearUsosRepositorio, type UsoGratis } from './cupo-invitaciones.usos.repositorio.js';

export interface UsosGratis {
  registrarUsoGratis(datos: UsoGratis, tx: Ejecutor): Promise<void>;
}

export function crearUsosGratis(suscripciones: CoberturaSuscripcion): UsosGratis {
  const repositorio = crearUsosRepositorio();
  return {
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
