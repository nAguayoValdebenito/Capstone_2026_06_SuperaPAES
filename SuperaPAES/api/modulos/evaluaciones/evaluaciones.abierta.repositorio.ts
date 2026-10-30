// Evaluación abierta del estudiante, para retomarla donde quedó (HU-60.1, CU-28, RF-A22), y cierre
// periódico de las vencidas y de las prácticas sin actividad con app.cerrar_vencidas (RN-19, RN-21).
import type { Ejecutor } from '../../db/transaccion.js';
import {
  ALCANCE_Y_DIFICULTAD,
  JOINS_ALCANCE,
  type ResumenPractica,
} from './evaluaciones.resumen.repositorio.js';

interface Codigo {
  codigo: string;
  nombre: string;
}

/** Lo que la app muestra para retomar (A12 y A29). */
export interface EvaluacionParaRetomar {
  id: string;
  tipo: Codigo;
  prueba: Codigo & { id: number };
  /** Lo que se eligió practicar: el encabezado de A17 al retomar. */
  alcance: ResumenPractica['alcance'];
  dificultad: ResumenPractica['dificultad'];
  cantidad: number;
  respondidas: number;
  iniciadaEn: Date;
  /** Hora de término de una evaluación con tiempo; `null` en la práctica y el repaso. */
  venceEn: Date | null;
  /** Según el reloj de la base, para no depender de la hora del teléfono; `null` sin tiempo. */
  segundosRestantes: number | null;
}

export interface FilaAbierta extends EvaluacionParaRetomar {
  /** Con tiempo y con la hora de término cumplida (RN-21). */
  vencida: boolean;
  /** Sin tiempo y sin respuestas durante las horas de inactividad (RN-19). */
  inactiva: boolean;
}

// RN-19 deja una sola abierta por estudiante: se bloquea para que nadie la cierre mientras tanto.
const ABIERTA = `SELECT e.id::text AS id,
  jsonb_build_object('codigo', t.codigo, 'nombre', t.nombre) AS tipo,
  jsonb_build_object('id', p.id, 'codigo', p.codigo, 'nombre', p.nombre) AS prueba,
  ${ALCANCE_Y_DIFICULTAD},
  e.cantidad_preguntas AS cantidad,
  (SELECT COUNT(*)::int FROM app.evaluacion_item i
    WHERE i.evaluacion_id = e.id AND i.respondida_en IS NOT NULL) AS respondidas,
  e.iniciada_en AS "iniciadaEn", e.vence_en AS "venceEn",
  CASE WHEN e.vence_en IS NOT NULL
    THEN GREATEST(0, CEIL(EXTRACT(EPOCH FROM e.vence_en - now())))::int
  END AS "segundosRestantes",
  COALESCE(e.vence_en <= now(), false) AS vencida,
  NOT t.con_tiempo AND e.ultima_actividad_en < now() - $2 * INTERVAL '1 hour' AS inactiva
 FROM app.evaluacion e
 JOIN contenido.tipo_evaluacion t ON t.id = e.tipo_evaluacion_id
 JOIN contenido.prueba p ON p.id = e.prueba_id
 ${JOINS_ALCANCE}
 WHERE e.estudiante_id = $1 AND e.cerrada_en IS NULL
 FOR UPDATE OF e`;

export function crearAbiertaRepositorio(bd: Ejecutor) {
  return {
    async leerAbierta(
      estudianteId: string,
      horas: number,
      tx: Ejecutor,
    ): Promise<FilaAbierta | null> {
      const { rows } = await tx.query<FilaAbierta>(ABIERTA, [estudianteId, horas]);
      return rows[0] ?? null;
    },
    /** La cierra y la corrige: con tiempo, en su hora de término (RN-21). */
    async cerrar(id: string, estado: 'tiempo_agotado' | 'abandonada', tx: Ejecutor): Promise<void> {
      await tx.query('SELECT app.cerrar_evaluacion($1, $2)', [id, estado]);
    },
    /** Cierra todas las vencidas y las prácticas sin actividad; devuelve cuántas cerró. */
    async cerrarVencidas(): Promise<number> {
      const { rows } = await bd.query<{ cerradas: number }>(
        'SELECT app.cerrar_vencidas() AS cerradas',
      );
      return rows[0]?.cerradas ?? 0;
    },
  };
}

export type AbiertaRepositorio = ReturnType<typeof crearAbiertaRepositorio>;
