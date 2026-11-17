// Consulta de C07: datos existentes del temario, sin cambiar catálogos ni el modelo.
import type { Ejecutor } from '../../db/transaccion.js';

export interface ContenidoConsultaFila {
  id: number;
  descriptores: string | null;
  activo: boolean;
  curso: string | null;
  areaId: number;
  areaNombre: string;
}

export interface HabilidadConsultaFila {
  id: number;
  pruebaId: number;
  codigo: string;
  nombre: string;
  criterios: string | null;
}

export function crearTemarioConsultaRepositorio(bd: Ejecutor) {
  return {
    async contenidos(): Promise<ContenidoConsultaFila[]> {
      const { rows } = await bd.query<ContenidoConsultaFila>(
        `SELECT c.id, c.descriptores, c.activo, ne.nombre AS curso,
                a.id AS "areaId", a.nombre AS "areaNombre"
           FROM contenido.contenido_tematico c
           JOIN contenido.area a ON a.id = c.area_id
           LEFT JOIN contenido.nivel_escolar ne ON ne.id = c.nivel_escolar_id
          ORDER BY c.id`,
      );
      return rows;
    },
    async habilidades(): Promise<HabilidadConsultaFila[]> {
      const { rows } = await bd.query<HabilidadConsultaFila>(
        `SELECT id, prueba_id AS "pruebaId", codigo, nombre, criterios
           FROM contenido.habilidad ORDER BY prueba_id, id`,
      );
      return rows;
    },
  };
}
