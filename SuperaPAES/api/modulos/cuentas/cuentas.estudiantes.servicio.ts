// C15 · Estudiantes: el listado de la consola, paginado desde la API. Junta los datos de la cuenta y los
// intereses del perfil (de cuentas) con la suscripción vigente, que pregunta al servicio de suscripciones.
import type { Paginacion } from '../../comun/respuesta.js';
import type { Ejecutor } from '../../db/transaccion.js';
import {
  crearEstudiantesListadoRepositorio,
  type EstudiantesListadoRepositorio,
  type FilaEstudianteListado,
} from './cuentas.estudiantes.repositorio.js';
import type { ConsultaEstudiantes } from './cuentas.validadores.js';

/** Una fila de la tabla de C15: solo lo que muestra, más lo que necesita para confirmar la cuenta. */
export interface EstudianteListado extends FilaEstudianteListado {
  /** Tiene una suscripción vigente (activa o en mora, RN-34), según el módulo suscripciones. */
  suscripcionActiva: boolean;
}

export interface DependenciasListado {
  bd: Ejecutor;
  /** De los estudiantes pedidos, los que tienen una suscripción vigente (servicio de suscripciones). */
  estudiantesConVigente: (estudianteIds: readonly string[]) => Promise<Set<string>>;
  /** Solo para pruebas: reemplaza al que se crea con crearEstudiantesListadoRepositorio(bd). */
  repositorioListado?: EstudiantesListadoRepositorio;
}

export interface ListadoEstudiantes {
  /** C15: estudiantes registrados, con o sin suscripción, del más reciente al más antiguo. */
  listarEstudiantes(
    consulta: ConsultaEstudiantes,
  ): Promise<{ estudiantes: EstudianteListado[]; paginacion: Paginacion }>;
}

export function crearListadoEstudiantes(dependencias: DependenciasListado): ListadoEstudiantes {
  const repositorio =
    dependencias.repositorioListado ?? crearEstudiantesListadoRepositorio(dependencias.bd);
  return {
    async listarEstudiantes({ buscar, pagina, porPagina }) {
      const { filas, total } = await repositorio.listar({
        buscar: buscar || null,
        limite: porPagina,
        desde: (pagina - 1) * porPagina,
      });
      const conVigente = await dependencias.estudiantesConVigente(filas.map((fila) => fila.id));
      return {
        estudiantes: filas.map((fila) => ({ ...fila, suscripcionActiva: conVigente.has(fila.id) })),
        paginacion: { pagina, porPagina, total },
      };
    },
  };
}
