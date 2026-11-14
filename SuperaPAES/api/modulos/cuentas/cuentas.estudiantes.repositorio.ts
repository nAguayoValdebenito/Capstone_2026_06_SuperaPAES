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

export interface ConsultaListadoEstudiantes {
  /** Parte del nombre o del correo, sin distinguir mayúsculas; null lista a todos. */
  buscar: string | null;
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

const FILTRO = `
   WHERE e.eliminado_en IS NULL
     AND ($1::text IS NULL
          OR position(lower($1) IN lower(e.nombre)) > 0
          OR position(lower($1) IN lower(e.correo)) > 0)`;

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
   LIMIT $2 OFFSET $3`;

const TOTAL = `SELECT count(*)::int AS total FROM app.estudiante e ${FILTRO}`;

export function crearEstudiantesListadoRepositorio(bd: Ejecutor): EstudiantesListadoRepositorio {
  return {
    listar: ({ buscar, limite, desde }, tx = bd) =>
      paginaConTotal<FilaEstudianteListado>(tx, [LISTAR, TOTAL], [buscar], [limite, desde]),
  };
}
