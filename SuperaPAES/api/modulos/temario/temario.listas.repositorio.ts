// Consulta de C09 (HU-64.1): listas de opciones que la consola muestra, sin editarlas ni cambiar el modelo.
// Las listas no tienen servicio propio: temario las lee porque es dueño de area_carrera_prueba.
import type { Ejecutor } from '../../db/transaccion.js';

/** RN-09: mezcla global de una dificultad, en porcentaje. */
export interface DificultadLista {
  codigo: string;
  nombre: string;
  minimo: number;
  objetivo: number;
  maximo: number;
}

/** RN-25: área de carrera con las pruebas y el electivo de Ciencias que sugiere. */
export interface AreaCarreraLista {
  codigo: string;
  nombre: string;
  activa: boolean;
  pruebas: { codigo: string; nombre: string }[];
  /** Nombre del electivo sugerido (Biología, Física o Química); null si no corresponde. */
  electivo: string | null;
}

/** Opción de una lista que solo tiene código, nombre y si se ofrece (RF-C12: se puede desactivar). */
export interface OpcionLista {
  codigo: string;
  nombre: string;
  activa: boolean;
}

/** Tipo de evaluación con cómo se arma y su comportamiento (la base lo aplica a cada evaluación). */
export interface TipoEvaluacionLista {
  codigo: string;
  nombre: string;
  /** Nombre del modo de armado: adaptativo, falladas o estructura. */
  modoArmado: string;
  correccionInmediata: boolean;
  permiteCambiarRespuesta: boolean;
  conTiempo: boolean;
  permiteElegirAlcance: boolean;
  permiteElegirDificultad: boolean;
  filtraPorNivel: boolean;
  entregaPuntaje: boolean;
  unicaPorAnioEscolar: boolean;
  consumeCupo: boolean;
  cuentaParaProgreso: boolean;
}

/** Listas que solo tienen código, nombre y activo. Nombres fijos: nunca vienen del usuario. */
export type ListaSimple = 'motivosAviso' | 'tiposPregunta' | 'tiposTexto';

export interface TemarioListasRepositorio {
  dificultades(tx?: Ejecutor): Promise<DificultadLista[]>;
  areasCarrera(tx?: Ejecutor): Promise<AreaCarreraLista[]>;
  tiposEvaluacion(tx?: Ejecutor): Promise<TipoEvaluacionLista[]>;
  opciones(lista: ListaSimple, tx?: Ejecutor): Promise<OpcionLista[]>;
}

const DIFICULTADES = `
  SELECT codigo, nombre, mezcla_min AS minimo, mezcla_objetivo AS objetivo, mezcla_max AS maximo
    FROM contenido.dificultad
   ORDER BY orden`;

// Todas las áreas, activas o no; las pruebas sugeridas en el orden de las pruebas.
const AREAS_CARRERA = `
  SELECT ac.codigo, ac.nombre, ac.activo AS activa,
         COALESCE(json_agg(json_build_object('codigo', p.codigo, 'nombre', p.nombre) ORDER BY p.id)
                    FILTER (WHERE p.id IS NOT NULL), '[]'::json) AS pruebas,
         a.nombre AS electivo
    FROM contenido.area_carrera ac
    LEFT JOIN contenido.area a ON a.id = ac.electivo_area_id
    LEFT JOIN contenido.area_carrera_prueba acp ON acp.area_carrera_id = ac.id
    LEFT JOIN contenido.prueba p ON p.id = acp.prueba_id
   GROUP BY ac.id, a.nombre
   ORDER BY ac.orden, ac.id`;

const TIPOS_EVALUACION = `
  SELECT te.codigo, te.nombre, m.nombre AS "modoArmado",
         te.correccion_inmediata AS "correccionInmediata",
         te.permite_cambiar_respuesta AS "permiteCambiarRespuesta", te.con_tiempo AS "conTiempo",
         te.permite_elegir_alcance AS "permiteElegirAlcance",
         te.permite_elegir_dificultad AS "permiteElegirDificultad",
         te.filtra_por_nivel AS "filtraPorNivel", te.entrega_puntaje AS "entregaPuntaje",
         te.unica_por_anio_escolar AS "unicaPorAnioEscolar", te.consume_cupo AS "consumeCupo",
         te.cuenta_para_progreso AS "cuentaParaProgreso"
    FROM contenido.tipo_evaluacion te
    JOIN contenido.modo_armado m ON m.id = te.modo_armado_id
   ORDER BY te.id`;

const opcionesDe = (tabla: string) =>
  `SELECT codigo, nombre, activo AS activa FROM contenido.${tabla} ORDER BY id`;

const OPCIONES: Record<ListaSimple, string> = {
  motivosAviso: opcionesDe('motivo_reporte'),
  tiposPregunta: opcionesDe('tipo_pregunta'),
  tiposTexto: opcionesDe('tipo_texto'),
};

export function crearTemarioListasRepositorio(bd: Ejecutor): TemarioListasRepositorio {
  return {
    async dificultades(tx = bd) {
      const { rows } = await tx.query<DificultadLista>(DIFICULTADES);
      return rows;
    },
    async areasCarrera(tx = bd) {
      const { rows } = await tx.query<AreaCarreraLista>(AREAS_CARRERA);
      return rows;
    },
    async tiposEvaluacion(tx = bd) {
      const { rows } = await tx.query<TipoEvaluacionLista>(TIPOS_EVALUACION);
      return rows;
    },
    async opciones(lista, tx = bd) {
      const { rows } = await tx.query<OpcionLista>(OPCIONES[lista]);
      return rows;
    },
  };
}
