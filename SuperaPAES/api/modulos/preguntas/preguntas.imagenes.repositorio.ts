// SQL de las imágenes de las preguntas y de los textos de lectura (migración 007). La tabla
// contenido.imagen es de este módulo. Una imagen se guarda una sola vez por su huella y nunca se modifica
// ni se borra (lo impide un disparador). Consultas siempre parametrizadas; cada método acepta la
// transacción en curso.
import type { Ejecutor } from '../../db/transaccion.js';

export interface ImagenNueva {
  huella: string;
  datos: Buffer;
  ancho: number;
  alto: number;
  creadoPor: string;
}

/** La imagen guardada; `nueva` es falso si ya existía una con la misma huella. */
export interface ImagenGuardada {
  id: string;
  ancho: number;
  alto: number;
  bytes: number;
  nueva: boolean;
}

export interface ImagenesRepositorio {
  guardar(imagen: ImagenNueva, tx?: Ejecutor): Promise<ImagenGuardada>;
  /** Los bytes en WebP, o null si no hay una imagen con esa huella. */
  datosPorHuella(huella: string, tx?: Ejecutor): Promise<Buffer | null>;
}

interface FilaImagen {
  id: string;
  ancho: number;
  alto: number;
  bytes: number;
}

const COLUMNAS = 'id::text AS id, ancho, alto, bytes';

export function crearImagenesRepositorio(bd: Ejecutor): ImagenesRepositorio {
  return {
    async guardar(imagen, tx = bd) {
      const { rows } = await tx.query<FilaImagen>(
        `INSERT INTO contenido.imagen (huella, ancho, alto, bytes, datos, creado_por, creado_en)
         VALUES ($1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (huella) DO NOTHING
         RETURNING ${COLUMNAS}`,
        [
          imagen.huella,
          imagen.ancho,
          imagen.alto,
          imagen.datos.length,
          imagen.datos,
          imagen.creadoPor,
        ],
      );
      const nueva = rows[0];
      if (nueva) return { ...nueva, nueva: true };
      const existente = await tx.query<FilaImagen>(
        `SELECT ${COLUMNAS} FROM contenido.imagen WHERE huella = $1`,
        [imagen.huella],
      );
      const fila = existente.rows[0];
      if (!fila) throw new Error('La imagen no se guardó ni existía.');
      return { ...fila, nueva: false };
    },

    async datosPorHuella(huella, tx = bd) {
      const { rows } = await tx.query<{ datos: Buffer }>(
        'SELECT datos FROM contenido.imagen WHERE huella = $1',
        [huella],
      );
      return rows[0]?.datos ?? null;
    },
  };
}
