// C15 · Estudiantes: el listado de la consola, paginado desde la API. Junta los datos de la cuenta y los
// intereses del perfil (de cuentas) con la suscripción vigente, que pregunta al servicio de suscripciones.
// Filtros opcionales: suscripción vigente o no, un área de carrera de interés (o ninguna) y cuenta
// verificada o no. El de suscripción usa los ids que entrega suscripciones (cada módulo lee sus tablas).
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
  /** Lo que el listado pregunta al servicio de suscripciones (sin importar el módulo). */
  suscripciones: {
    /** De los estudiantes pedidos, los que tienen una suscripción vigente. */
    estudiantesConVigente(estudianteIds: readonly string[]): Promise<Set<string>>;
    /** Todos los estudiantes con suscripción vigente, para filtrar por suscripción. */
    idsConVigente(): Promise<string[]>;
  };
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
    async listarEstudiantes({ suscripcion, interes, verificado, pagina, porPagina }) {
      const vigentes = suscripcion ? await dependencias.suscripciones.idsConVigente() : null;
      const { filas, total } = await repositorio.listar({
        soloIds: suscripcion === 'activa' ? vigentes : null,
        sinIds: suscripcion === 'sin' ? vigentes : null,
        interes: interes ?? null,
        verificado: verificado ?? null,
        limite: porPagina,
        desde: (pagina - 1) * porPagina,
      });
      const conVigente = await dependencias.suscripciones.estudiantesConVigente(
        filas.map((fila) => fila.id),
      );
      return {
        estudiantes: filas.map((fila) => ({ ...fila, suscripcionActiva: conVigente.has(fila.id) })),
        paginacion: { pagina, porPagina, total },
      };
    },
  };
}
