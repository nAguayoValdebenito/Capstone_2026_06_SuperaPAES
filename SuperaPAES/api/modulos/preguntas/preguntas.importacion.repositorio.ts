// SQL de las importaciones (contenido.importacion, HU-13.1): cada archivo importado con su resultado y
// el detalle de las filas con error. Las preguntas se crean con preguntas.edicion.repositorio.ts, que
// les pone el id de la importación: de ahí sale su origen «importación».
import type { Ejecutor } from '../../db/transaccion.js';

export interface RegistroImportacion {
  usuarioId: string;
  nombreArchivo: string;
  filasTotal: number;
  filasCreadas: number;
  filasConError: number;
  /** Las filas con error y sus motivos, como los mostró el informe. */
  errores: readonly unknown[];
}

export interface PreguntasImportacionRepositorio {
  /** Devuelve el id de la importación. */
  insertar(registro: RegistroImportacion, tx: Ejecutor): Promise<string>;
}

const INSERTAR = `
  INSERT INTO contenido.importacion (usuario_id, nombre_archivo, filas_total, filas_creadas,
                                     filas_con_error, errores, creado_en)
  VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())
  RETURNING id::text AS id`;

export function crearPreguntasImportacionRepositorio(): PreguntasImportacionRepositorio {
  return {
    async insertar(registro, tx) {
      const { rows } = await tx.query<{ id: string }>(INSERTAR, [
        registro.usuarioId,
        registro.nombreArchivo,
        registro.filasTotal,
        registro.filasCreadas,
        registro.filasConError,
        registro.errores.length > 0 ? JSON.stringify(registro.errores) : null,
      ]);
      const id = rows[0]?.id;
      if (id === undefined) throw new Error('La importación no se guardó.');
      return id;
    },
  };
}
