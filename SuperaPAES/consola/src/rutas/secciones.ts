// Secciones de la consola: ruta, página, grupo del menú y roles de cuenta que pueden verlas.
// Fuente única para las rutas y el menú: agregar una sección es agregar una entrada aquí.
import type { ComponentType } from 'react';
import { PaginaAuditoria } from '../paginas/auditoria/PaginaAuditoria';
import { PaginaAvisosError } from '../paginas/avisos-error/PaginaAvisosError';
import { PaginaBanco } from '../paginas/banco/PaginaBanco';
import { PaginaClasificarDificultad } from '../paginas/clasificar-dificultad/PaginaClasificarDificultad';
import { PaginaConfiguracion } from '../paginas/configuracion/PaginaConfiguracion';
import { PaginaDesempates } from '../paginas/desempates/PaginaDesempates';
import { PaginaEstudiantes } from '../paginas/estudiantes/PaginaEstudiantes';
import { PaginaGenerador } from '../paginas/generador/PaginaGenerador';
import { PaginaPanel } from '../paginas/panel/PaginaPanel';
import { PaginaPlanes } from '../paginas/planes/PaginaPlanes';
import { PaginaRevision } from '../paginas/revision/PaginaRevision';
import { PaginaRevisiones } from '../paginas/revisiones/PaginaRevisiones';
import { PaginaSolicitudesDatos } from '../paginas/solicitudes-datos/PaginaSolicitudesDatos';
import { PaginaSuscripciones } from '../paginas/suscripciones/PaginaSuscripciones';
import { PaginaTemario } from '../paginas/temario/PaginaTemario';
import { PaginaUsuariosInternos } from '../paginas/usuarios-internos/PaginaUsuariosInternos';
import type { RolCuentaInterna } from '../tipos';

export type GrupoMenu = 'General' | 'Contenido' | 'Estudiantes' | 'Administración' | 'Revisión';

export interface Seccion {
  ruta: string;
  titulo: string;
  grupo: GrupoMenu;
  roles: readonly RolCuentaInterna[];
  Pagina: ComponentType;
}

const admin = ['admin'] as const;
const docente = ['docente'] as const;

export const SECCIONES: readonly Seccion[] = [
  // Administrador
  { ruta: '/panel', titulo: 'Panel', grupo: 'General', roles: admin, Pagina: PaginaPanel },
  {
    ruta: '/banco',
    titulo: 'Banco de preguntas',
    grupo: 'Contenido',
    roles: admin,
    Pagina: PaginaBanco,
  },
  {
    ruta: '/generador',
    titulo: 'Generador IA',
    grupo: 'Contenido',
    roles: admin,
    Pagina: PaginaGenerador,
  },
  {
    ruta: '/revisiones',
    titulo: 'Revisiones',
    grupo: 'Contenido',
    roles: admin,
    Pagina: PaginaRevisiones,
  },
  { ruta: '/temario', titulo: 'Temario', grupo: 'Contenido', roles: admin, Pagina: PaginaTemario },
  {
    ruta: '/avisos-error',
    titulo: 'Avisos de error',
    grupo: 'Contenido',
    roles: admin,
    Pagina: PaginaAvisosError,
  },
  {
    ruta: '/estudiantes',
    titulo: 'Estudiantes',
    grupo: 'Estudiantes',
    roles: admin,
    Pagina: PaginaEstudiantes,
  },
  {
    ruta: '/suscripciones',
    titulo: 'Suscripciones',
    grupo: 'Estudiantes',
    roles: admin,
    Pagina: PaginaSuscripciones,
  },
  {
    ruta: '/solicitudes-datos',
    titulo: 'Solicitudes de datos',
    grupo: 'Estudiantes',
    roles: admin,
    Pagina: PaginaSolicitudesDatos,
  },
  {
    ruta: '/usuarios-internos',
    titulo: 'Usuarios internos',
    grupo: 'Administración',
    roles: admin,
    Pagina: PaginaUsuariosInternos,
  },
  {
    ruta: '/planes',
    titulo: 'Planes',
    grupo: 'Administración',
    roles: admin,
    Pagina: PaginaPlanes,
  },
  {
    ruta: '/configuracion',
    titulo: 'Configuración',
    grupo: 'Administración',
    roles: admin,
    Pagina: PaginaConfiguracion,
  },
  {
    ruta: '/auditoria',
    titulo: 'Auditoría',
    grupo: 'Administración',
    roles: admin,
    Pagina: PaginaAuditoria,
  },
  // Docente
  {
    ruta: '/revision',
    titulo: 'Revisión',
    grupo: 'Revisión',
    roles: docente,
    Pagina: PaginaRevision,
  },
  {
    ruta: '/desempates',
    titulo: 'Desempates',
    grupo: 'Revisión',
    roles: docente,
    Pagina: PaginaDesempates,
  },
  {
    ruta: '/clasificar-dificultad',
    titulo: 'Clasificar dificultad',
    grupo: 'Revisión',
    roles: docente,
    Pagina: PaginaClasificarDificultad,
  },
];

/** Primera sección de cada rol: a dónde lleva la raíz `/`. */
export const INICIO_POR_ROL: Record<RolCuentaInterna, string> = {
  admin: '/panel',
  docente: '/revision',
};

export function seccionesDelRol(rol: RolCuentaInterna): Seccion[] {
  return SECCIONES.filter((s) => s.roles.includes(rol));
}
