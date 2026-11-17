// SQL del temario para el generador de preguntas con IA (HU-16.2): el contenido con su eje, su curso y su
// prueba, las habilidades de la prueba y los tipos de pregunta que admite. Solo lecturas, parametrizadas.
import type { Ejecutor } from '../../db/transaccion.js';

/** Un contenido con su eje y su prueba. */
export interface FilaContenidoParaGenerar {
  contenidoId: number;
  nombre: string;
  descriptores: string | null;
  activo: boolean;
  curso: string | null;
  ejeId: number;
  ejeNombre: string;
  pruebaId: number;
  pruebaCodigo: string;
  pruebaNombre: string;
  opcionesMax: number;
  requiereTexto: boolean;
}

/** Una habilidad de la prueba con sus criterios (contenido.habilidad). */
export interface HabilidadParaGenerar {
  id: number;
  codigo: string;
  nombre: string;
  criterios: string | null;
}

const CONTENIDO = `
  SELECT c.id AS "contenidoId", c.nombre, c.descriptores, c.activo, ne.nombre AS curso,
         e.id AS "ejeId", e.nombre AS "ejeNombre",
         p.id AS "pruebaId", p.codigo AS "pruebaCodigo", p.nombre AS "pruebaNombre",
         p.opciones_max AS "opcionesMax", (p.textos IS NOT NULL) AS "requiereTexto"
    FROM contenido.contenido_tematico c
    JOIN contenido.eje_tematico e ON e.id = c.eje_id
    JOIN contenido.prueba p ON p.id = c.prueba_id
    LEFT JOIN contenido.nivel_escolar ne ON ne.id = c.nivel_escolar_id
   WHERE c.id = $1`;

export function crearTemarioGeneracionRepositorio(bd: Ejecutor) {
  return {
    async contenido(
      contenidoId: number,
      tx: Ejecutor = bd,
    ): Promise<FilaContenidoParaGenerar | null> {
      const { rows } = await tx.query<FilaContenidoParaGenerar>(CONTENIDO, [contenidoId]);
      return rows[0] ?? null;
    },
    async habilidades(pruebaId: number, tx: Ejecutor = bd): Promise<HabilidadParaGenerar[]> {
      const { rows } = await tx.query<HabilidadParaGenerar>(
        'SELECT id, codigo, nombre, criterios FROM contenido.habilidad WHERE prueba_id = $1 ORDER BY codigo',
        [pruebaId],
      );
      return rows;
    },
    async tiposPregunta(pruebaId: number, tx: Ejecutor = bd): Promise<string[]> {
      const { rows } = await tx.query<{ codigo: string }>(
        `SELECT t.codigo FROM contenido.prueba_tipo_pregunta pt
           JOIN contenido.tipo_pregunta t ON t.id = pt.tipo_pregunta_id
          WHERE pt.prueba_id = $1 ORDER BY t.codigo`,
        [pruebaId],
      );
      return rows.map((fila) => fila.codigo);
    },
  };
}
