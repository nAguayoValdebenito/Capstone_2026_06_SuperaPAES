// Único lugar con SQL del módulo temario. Consultas siempre parametrizadas ($1, $2...).
// Tablas que pertenecen a este módulo (ningún otro módulo las escribe):
//   - contenido.area
//   - contenido.prueba
//   - contenido.prueba_tipo_pregunta
//   - contenido.eje_tematico
//   - contenido.contenido_tematico
//   - contenido.habilidad
//   - contenido.area_carrera_prueba (pruebas y electivo que sugiere cada área de carrera)
// Cada método recibe un Ejecutor opcional (tx) para sumarse a la transacción del servicio.
import type { Ejecutor } from '../../db/transaccion.js';

/** Área de especialidad de los docentes (contenido.area). */
export interface Area {
  id: number;
  nombre: string;
}

export interface TemarioRepositorio {
  listarAreas(tx?: Ejecutor): Promise<Area[]>;
}

export function crearTemarioRepositorio(bd: Ejecutor): TemarioRepositorio {
  return {
    async listarAreas(tx = bd) {
      const { rows } = await tx.query<Area>(
        'SELECT id, nombre FROM contenido.area ORDER BY nombre',
      );
      return rows;
    },
  };
}
