// Secciones de la consola: ruta, página y roles de cuenta que pueden verlas, en el orden del menú
// lateral (DAS 7.4: 14 del administrador, C01 a C16, y 4 del docente revisor, D01 a D04).
// Fuente única para las rutas y el menú: agregar una sección es agregar una entrada aquí.
import type { ComponentType } from 'react';
import type { NombreIcono } from '../componentes/Icono';
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
import type { RolCuentaInterna, UsuarioInterno } from '../tipos';

export interface Seccion {
  ruta: string;
  titulo: string;
  roles: readonly RolCuentaInterna[];
  Pagina: ComponentType;
  /** Grupo del menú lateral (los grupos siguen el orden del DAS 7.4: cada uno junta secciones vecinas). */
  grupo: string;
  /** Ícono de la sección en el menú lateral. */
  icono: NombreIcono;
  /** `false`: la ruta existe y se abre por su URL, pero no aparece en el menú lateral. */
  enMenu?: boolean;
}

const deRol =
  (roles: readonly RolCuentaInterna[]) =>
  (grupo: string) =>
  (ruta: string, titulo: string, icono: NombreIcono, Pagina: ComponentType): Seccion => ({
    ruta,
    titulo,
    roles,
    Pagina,
    grupo,
    icono,
  });
const admin = deRol(['admin']);
const docente = deRol(['docente']);
const general = admin('General');
const contenido = admin('Contenido');
const administracion = admin('Administración');
const atencion = admin('Atención');
const estudiantes = admin('Estudiantes');
const trabajoDocente = docente('Mi trabajo');

export const SECCIONES: readonly Seccion[] = [
  // Administrador (C01 a C16)
  general('/panel', 'Panel', 'panel', PaginaPanel),
  contenido('/banco', 'Banco de preguntas', 'banco', PaginaBanco),
  contenido('/revisiones', 'Revisiones', 'revisar', PaginaRevisiones),
  contenido('/generador', 'Generador IA', 'chispa', PaginaGenerador),
  contenido('/temario', 'Temario', 'temario', PaginaTemario),
  contenido('/evaluaciones', 'Evaluaciones', 'reloj', PaginaEvaluaciones),
  contenido('/listas-opciones', 'Listas de opciones', 'lista', PaginaListasOpciones),
  administracion('/usuarios-internos', 'Usuarios internos', 'usuarios', PaginaUsuariosInternos),
  administracion('/planes', 'Planes', 'etiqueta', PaginaPlanes),
  administracion('/configuracion', 'Configuración', 'ajustes', PaginaConfiguracion),
  atencion('/avisos-error', 'Avisos de error', 'bandera', PaginaAvisosError),
  atencion('/solicitudes-datos', 'Solicitudes de datos', 'escudo', PaginaSolicitudesDatos),
  estudiantes('/estudiantes', 'Estudiantes', 'estudiantes', PaginaEstudiantes),
  estudiantes('/suscripciones', 'Suscripciones', 'tarjeta', PaginaSuscripciones),
  // Docente revisor (D01 a D04)
  trabajoDocente('/revision', 'Mis revisiones', 'revisar', PaginaRevision),
  trabajoDocente('/desempates', 'Desempates', 'balanza', PaginaDesempates),
  // Clasificar dificultad (D03) sigue disponible por su URL, pero no aparece en el menú lateral.
  {
    ...trabajoDocente(
      '/clasificar-dificultad',
      'Clasificar dificultad',
      'capas',
      PaginaClasificarDificultad,
    ),
    enMenu: false,
  },
  trabajoDocente('/calibracion', 'Calibración', 'objetivo', PaginaCalibracion),
];

/**
 * Primera sección de cada rol: a dónde lleva la raíz `/`. El administrador entra al Banco de
 * preguntas mientras el Panel esté pendiente (HU-48, DAS 7.4).
 */
export const INICIO_POR_ROL: Record<RolCuentaInterna, string> = {
  admin: '/banco',
  docente: '/revision',
};

/** Secciones del rol que se muestran en el menú lateral, en su orden. */
export function seccionesDelRol(rol: RolCuentaInterna): Seccion[] {
  return SECCIONES.filter((s) => s.roles.includes(rol) && s.enMenu !== false);
}

/** A dónde redirigir a quien abre una ruta de esos roles, o `null` si puede verla. */
export function redireccionDeRuta(
  usuario: UsuarioInterno | null,
  roles: readonly RolCuentaInterna[],
): string | null {
  if (!usuario) return '/ingreso';
  return roles.includes(usuario.rol) ? null : INICIO_POR_ROL[usuario.rol];
}

/** Las secciones del menú del rol, juntas por grupo y en el orden del DAS 7.4. */
export function gruposDelRol(rol: RolCuentaInterna): { grupo: string; secciones: Seccion[] }[] {
  const grupos: { grupo: string; secciones: Seccion[] }[] = [];
  for (const seccion of seccionesDelRol(rol)) {
    const ultimo = grupos.at(-1);
    if (ultimo?.grupo === seccion.grupo) ultimo.secciones.push(seccion);
    else grupos.push({ grupo: seccion.grupo, secciones: [seccion] });
  }
  return grupos;
}

/** La sección a la que pertenece una ruta (incluye /banco/nueva, /banco/:id y /banco/importar). */
export function seccionDeRuta(ruta: string): Seccion | undefined {
  return SECCIONES.find((s) => ruta === s.ruta || ruta.startsWith(`${s.ruta}/`));
}

/** Nombre del rol de la sesión, como lo muestran el menú y las migas. */
export const NOMBRE_ROL_SESION: Record<RolCuentaInterna, string> = {
  admin: 'Administrador',
  docente: 'Docente',
};

const SUBPAGINAS: readonly { patron: RegExp; titulo: string }[] = [
  { patron: /^\/banco\/importar$/, titulo: 'Importar preguntas' },
  { patron: /^\/banco\/nueva$/, titulo: 'Nueva pregunta' },
  { patron: /^\/banco\/\d+$/, titulo: 'Pregunta' },
];

/** El título de una página que se abre desde una sección y no va en el menú (C03, C04). */
export function tituloDeSubpagina(ruta: string): string | null {
  return SUBPAGINAS.find((s) => s.patron.test(ruta))?.titulo ?? null;
}
