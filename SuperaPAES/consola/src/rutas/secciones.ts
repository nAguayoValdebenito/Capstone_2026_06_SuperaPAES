// Secciones de la consola: ruta, página y roles de cuenta que pueden verlas, en el orden del menú
// lateral (DAS 7.4: 14 del administrador, C01 a C16, y 4 del docente revisor, D01 a D04).
// Fuente única para las rutas y el menú: agregar una sección es agregar una entrada aquí.
import type { ComponentType } from 'react';
import { PaginaAvisosError } from '../paginas/avisos-error/PaginaAvisosError';
import { PaginaBanco } from '../paginas/banco/PaginaBanco';
import { PaginaCalibracion } from '../paginas/calibracion/PaginaCalibracion';
import { PaginaClasificarDificultad } from '../paginas/clasificar-dificultad/PaginaClasificarDificultad';
import { PaginaConfiguracion } from '../paginas/configuracion/PaginaConfiguracion';
import { PaginaDesempates } from '../paginas/desempates/PaginaDesempates';
import { PaginaEstudiantes } from '../paginas/estudiantes/PaginaEstudiantes';
import { PaginaEvaluaciones } from '../paginas/evaluaciones/PaginaEvaluaciones';
import { PaginaGenerador } from '../paginas/generador/PaginaGenerador';
import { PaginaListasOpciones } from '../paginas/listas-opciones/PaginaListasOpciones';
import { PaginaPanel } from '../paginas/panel/PaginaPanel';
import { PaginaPlanes } from '../paginas/planes/PaginaPlanes';
import { PaginaRevision } from '../paginas/revision/PaginaRevision';
import { PaginaRevisiones } from '../paginas/revisiones/PaginaRevisiones';
import { PaginaSolicitudesDatos } from '../paginas/solicitudes-datos/PaginaSolicitudesDatos';
import { PaginaSuscripciones } from '../paginas/suscripciones/PaginaSuscripciones';
import { PaginaTemario } from '../paginas/temario/PaginaTemario';
import { PaginaUsuariosInternos } from '../paginas/usuarios-internos/PaginaUsuariosInternos';
import type { RolCuentaInterna } from '../tipos';

export interface Seccion {
  ruta: string;
  titulo: string;
  roles: readonly RolCuentaInterna[];
  Pagina: ComponentType;
}

const deRol =
  (roles: readonly RolCuentaInterna[]) =>
  (ruta: string, titulo: string, Pagina: ComponentType): Seccion => ({
    ruta,
    titulo,
    roles,
    Pagina,
  });
const admin = deRol(['admin']);
const docente = deRol(['docente']);

export const SECCIONES: readonly Seccion[] = [
  // Administrador (C01 a C16)
  admin('/panel', 'Panel', PaginaPanel),
  admin('/banco', 'Banco de preguntas', PaginaBanco),
  admin('/revisiones', 'Revisiones', PaginaRevisiones),
  admin('/generador', 'Generador IA', PaginaGenerador),
  admin('/temario', 'Temario', PaginaTemario),
  admin('/evaluaciones', 'Evaluaciones', PaginaEvaluaciones),
  admin('/listas-opciones', 'Listas de opciones', PaginaListasOpciones),
  admin('/usuarios-internos', 'Usuarios internos', PaginaUsuariosInternos),
  admin('/planes', 'Planes', PaginaPlanes),
  admin('/configuracion', 'Configuración', PaginaConfiguracion),
  admin('/avisos-error', 'Avisos de error', PaginaAvisosError),
  admin('/solicitudes-datos', 'Solicitudes de datos', PaginaSolicitudesDatos),
  admin('/estudiantes', 'Estudiantes', PaginaEstudiantes),
  admin('/suscripciones', 'Suscripciones', PaginaSuscripciones),
  // Docente revisor (D01 a D04)
  docente('/revision', 'Mis revisiones', PaginaRevision),
  docente('/desempates', 'Desempates', PaginaDesempates),
  docente('/clasificar-dificultad', 'Clasificar dificultad', PaginaClasificarDificultad),
  docente('/calibracion', 'Calibración', PaginaCalibracion),
];

/**
 * Primera sección de cada rol: a dónde lleva la raíz `/`. El administrador entra al Banco de
 * preguntas mientras el Panel esté pendiente (HU-48, DAS 7.4).
 */
export const INICIO_POR_ROL: Record<RolCuentaInterna, string> = {
  admin: '/banco',
  docente: '/revision',
};

export function seccionesDelRol(rol: RolCuentaInterna): Seccion[] {
  return SECCIONES.filter((s) => s.roles.includes(rol));
}
