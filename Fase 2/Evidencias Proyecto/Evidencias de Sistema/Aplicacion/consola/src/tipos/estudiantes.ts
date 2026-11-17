// C15 · Estudiantes: lo que entrega /admin/cuentas/estudiantes (listado paginado) y su confirmación.
import type { Paginacion } from './index';

export interface EstudianteConsola {
  id: number;
  nombre: string;
  correo: string;
  correoVerificado: boolean;
  /** Tiene una suscripción vigente según la API (activa o en mora, RN-34). */
  suscripcionActiva: boolean;
  /** Áreas de carrera de interés de su perfil; vacío si no marcó ninguna. */
  intereses: string[];
}

export interface ListadoEstudiantes {
  estudiantes: EstudianteConsola[];
  paginacion: Paginacion;
}

/** Filtros del listado; un valor vacío es «Todos». `interes` es el código del área o «ninguno». */
export interface FiltrosEstudiantes {
  suscripcion: '' | 'activa' | 'sin';
  interes: string;
  verificado: '' | 'si' | 'no';
}
