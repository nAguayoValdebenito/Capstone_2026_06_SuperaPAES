// SQL de publicar, retirar y volver a borrador una pregunta (HU-24, CU-21, RF-G09, RF-G10, RN-13).
// La base revisa que el cambio de etapa esté permitido (transicion_estado_pregunta), que una pregunta
// publicada tenga dificultad asignada y deja el cambio en el historial a nombre de quien lo hizo.
// Consultas siempre parametrizadas.
import type { Ejecutor } from '../../db/transaccion.js';
import type { Opcion } from './preguntas.repositorio.js';

/** La etapa actual de la pregunta y si los docentes ya le asignaron dificultad. */
export interface EtapaDePregunta {
  estado: Opcion;
  conDificultad: boolean;
}

export interface PublicacionRepositorio {
  /** La etapa de la pregunta, reservada (FOR UPDATE) hasta el fin de la transacción; null si no existe. */
  reservar(id: string, tx: Ejecutor): Promise<EtapaDePregunta | null>;
  /** Pasa la pregunta a la etapa `hacia` (por su código) y devuelve la etapa nueva. */
  cambiarEtapa(id: string, hacia: string, tx: Ejecutor): Promise<Opcion>;
}

const RESERVAR = `
  SELECT json_build_object('codigo', e.codigo, 'nombre', e.nombre) AS estado,
         p.dificultad_asignada_id IS NOT NULL AS "conDificultad"
    FROM contenido.pregunta p
    JOIN contenido.estado_pregunta e ON e.id = p.estado_pregunta_id
   WHERE p.id = $1
     FOR UPDATE OF p`;

const CAMBIAR_ETAPA = `
  UPDATE contenido.pregunta p
     SET estado_pregunta_id = e.id, actualizado_en = now()
    FROM contenido.estado_pregunta e
   WHERE p.id = $1 AND e.codigo = $2
  RETURNING e.codigo, e.nombre`;

export function crearPublicacionRepositorio(): PublicacionRepositorio {
  return {
    async reservar(id, tx) {
      const { rows } = await tx.query<EtapaDePregunta>(RESERVAR, [id]);
      return rows[0] ?? null;
    },

    async cambiarEtapa(id, hacia, tx) {
      const { rows } = await tx.query<Opcion>(CAMBIAR_ETAPA, [id, hacia]);
      const estado = rows[0];
      if (!estado) throw new Error('La pregunta no cambió de etapa.');
      return estado;
    },
  };
}
