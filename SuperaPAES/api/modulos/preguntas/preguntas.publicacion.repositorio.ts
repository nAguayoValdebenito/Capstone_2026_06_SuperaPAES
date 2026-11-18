// SQL de publicar, retirar y volver a borrador una pregunta (HU-24, CU-21, RF-G09, RF-G10, RN-13).
// La base revisa que el cambio de etapa esté permitido (transicion_estado_pregunta), que una pregunta
// publicada tenga dificultad asignada y deja el cambio en el historial a nombre de quien lo hizo.
// Consultas siempre parametrizadas.
import type { Ejecutor } from '../../db/transaccion.js';
import type { Opcion } from './preguntas.repositorio.js';

/** La etapa actual de la pregunta. */
export interface EtapaDePregunta {
  estado: Opcion;
}

export interface PublicacionRepositorio {
  /** La etapa de la pregunta, reservada (FOR UPDATE) hasta el fin de la transacción; null si no existe. */
  reservar(id: string, tx: Ejecutor): Promise<EtapaDePregunta | null>;
  /** Pasa la pregunta a la etapa `hacia` (por su código) y devuelve la etapa nueva. */
  cambiarEtapa(id: string, hacia: string, tx: Ejecutor): Promise<Opcion>;
  /** Modo de pruebas: la dificultad asignada es la sugerida, o media si no tiene. */
  asignarDificultadSugerida(id: string, tx: Ejecutor): Promise<void>;
}

const RESERVAR = `
  SELECT json_build_object('codigo', e.codigo, 'nombre', e.nombre) AS estado
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

const ASIGNAR_SUGERIDA = `
  UPDATE contenido.pregunta
     SET dificultad_asignada_id = COALESCE(
           dificultad_sugerida_id,
           (SELECT id FROM contenido.dificultad WHERE codigo = 'media'))
   WHERE id = $1`;

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

    async asignarDificultadSugerida(id, tx) {
      await tx.query(ASIGNAR_SUGERIDA, [id]);
    },
  };
}
