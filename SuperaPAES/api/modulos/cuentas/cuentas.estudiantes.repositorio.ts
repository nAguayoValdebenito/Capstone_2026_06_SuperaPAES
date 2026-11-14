// SQL del listado de estudiantes de la consola (C15), aparte de cuentas.repositorio.ts para que cada
// archivo quede corto. Lee app.estudiante y app.estudiante_interes_carrera (del módulo cuentas) y el
// nombre de cada área en contenido.area_carrera (lista de opciones). Consultas parametrizadas.
import { type Pagina, paginaConTotal } from '../../db/paginacion.js';
import type { Ejecutor } from '../../db/transaccion.js';

/** Un estudiante del listado, sin la suscripción (es de otro módulo). Nunca lleva el hash. */
export interface FilaEstudianteListado {
  id: string;
  nombre: string;
  correo: string;
  correoVerificado: boolean;
  /** Nombres de las áreas de carrera de interés del perfil, en el orden de la lista de opciones. */
  intereses: string[];
}

/** Código de interés que pide a quienes no marcaron ningún área de carrera. */
export const SIN_INTERESES = 'ninguno';

export interface ConsultaListadoEstudiantes {
  /** Solo estos estudiantes (por ejemplo, los con suscripción vigente); null no limita. */
  soloIds: readonly string[] | null;
  /** Sin estos estudiantes (por ejemplo, los con suscripción vigente); null no excluye. */
  sinIds: readonly string[] | null;
  /** Código del área de carrera de interés, o SIN_INTERESES; null no filtra. */
  interes: string | null;
  /** Con el correo verificado (true) o sin verificar (false); null no filtra. */
  verificado: boolean | null;
  limite: number;
  desde: number;
}

export interface EstudiantesListadoRepositorio {
  /** Sin las cuentas eliminadas, del registro más reciente al más antiguo. */
  listar(
    consulta: ConsultaListadoEstudiantes,
    tx?: Ejecutor,
  ): Promise<Pagina<FilaEstudianteListado>>;
}

// $3 = 'ninguno' pide a quienes no marcaron intereses; otro código, a quienes marcaron esa área.
const FILTRO = `
   WHERE e.eliminado_en IS NULL
     AND ($1::bigint[] IS NULL OR e.id = ANY($1::bigint[]))
     AND ($2::bigint[] IS NULL OR e.id <> ALL($2::bigint[]))
     AND ($3::text IS NULL
          OR ($3 = '${SIN_INTERESES}') <> EXISTS (
               SELECT 1 FROM app.estudiante_interes_carrera i
                 JOIN contenido.area_carrera ac ON ac.id = i.area_carrera_id
                WHERE i.estudiante_id = e.id AND ($3 = '${SIN_INTERESES}' OR ac.codigo = $3)))
     AND ($4::boolean IS NULL OR e.correo_verificado = $4)`;

const LISTAR = `
  SELECT e.id::text AS id, e.nombre, e.correo, e.correo_verificado AS "correoVerificado",
         COALESCE((SELECT array_agg(ac.nombre ORDER BY ac.orden, ac.id)
                     FROM app.estudiante_interes_carrera i
                     JOIN contenido.area_carrera ac ON ac.id = i.area_carrera_id
                    WHERE i.estudiante_id = e.id), '{}') AS intereses,
         count(*) OVER ()::int AS total
    FROM app.estudiante e
  ${FILTRO}
   ORDER BY e.creado_en DESC, e.id DESC
   LIMIT $5 OFFSET $6`;

const TOTAL = `SELECT count(*)::int AS total FROM app.estudiante e ${FILTRO}`;

export function crearEstudiantesListadoRepositorio(bd: Ejecutor): EstudiantesListadoRepositorio {
  return {
    listar: ({ soloIds, sinIds, interes, verificado, limite, desde }, tx = bd) =>
      paginaConTotal<FilaEstudianteListado>(
        tx,
        [LISTAR, TOTAL],
        [soloIds, sinIds, interes, verificado],
        [limite, desde],
      ),
  };
}
