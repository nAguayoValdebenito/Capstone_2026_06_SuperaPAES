// HU-62.1 (RF-A24, CU-30, A34): el historial del estudiante, de la más reciente a la más antigua y por páginas.
// Solo las evaluaciones cerradas: una abierta se retoma (CU-30 2.c). Nada del historial se borra.
import { paginaConTotal, type Pagina } from '../../db/paginacion.js';
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

export interface FilaHistorial {
  id: string;
  tipo: Codigo;
  prueba: Codigo & { id: number };
  /** `abandonada`, `tiempo_agotado` o `entregada`: A34 marca las abandonadas. */
  estado: Codigo;
  alcance: ResumenPractica['alcance'];
  dificultad: ResumenPractica['dificultad'];
  cerradaEn: Date;
  cantidad: number;
  correctas: number;
  porcentaje: number | null;
  /** Solo en el ensayo completo. */
  puntaje: number | null;
  /** Fecha del recálculo por una pregunta anulada (CU-30 2.b). */
  recalculadoEn: Date | null;
}

export interface FiltroHistorial {
  estudianteId: string;
  pruebaId?: number | undefined;
  tipo?: string | undefined;
  pagina: number;
  porPagina: number;
}

const DESDE = `FROM app.evaluacion e
 JOIN contenido.tipo_evaluacion t ON t.id=e.tipo_evaluacion_id
 JOIN contenido.prueba p ON p.id=e.prueba_id
 JOIN contenido.estado_evaluacion ee ON ee.id=e.estado_evaluacion_id
 LEFT JOIN app.resultado_evaluacion r ON r.evaluacion_id=e.id
 ${JOINS_ALCANCE}
 WHERE e.estudiante_id=$1 AND e.cerrada_en IS NOT NULL
   AND ($2::int IS NULL OR e.prueba_id=$2) AND ($3::text IS NULL OR t.codigo=$3)`;

const PAGINA = `SELECT e.id::text AS id,
  jsonb_build_object('codigo', t.codigo, 'nombre', t.nombre) AS tipo,
  jsonb_build_object('id', p.id, 'codigo', p.codigo, 'nombre', p.nombre) AS prueba,
  jsonb_build_object('codigo', ee.codigo, 'nombre', ee.nombre) AS estado,
  ${ALCANCE_Y_DIFICULTAD},
  e.cerrada_en AS "cerradaEn", e.cantidad_preguntas AS cantidad,
  COALESCE(r.correctas, 0)::int AS correctas, r.porcentaje::float8 AS porcentaje, r.puntaje,
  r.recalculado_en AS "recalculadoEn", count(*) OVER ()::int AS total
 ${DESDE}
 ORDER BY e.cerrada_en DESC, e.id DESC
 LIMIT $4 OFFSET $5`;

const CONTEO = `SELECT count(*)::int AS total ${DESDE}`;

export function crearHistorialRepositorio(bd: Ejecutor) {
  return {
    listar({
      estudianteId,
      pruebaId,
      tipo,
      pagina,
      porPagina,
    }: FiltroHistorial): Promise<Pagina<FilaHistorial>> {
      return paginaConTotal<FilaHistorial & Record<string, unknown>>(
        bd,
        [PAGINA, CONTEO],
        [estudianteId, pruebaId ?? null, tipo ?? null],
        [porPagina, (pagina - 1) * porPagina],
      );
    },
  };
}

export type HistorialRepositorio = ReturnType<typeof crearHistorialRepositorio>;
