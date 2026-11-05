// Seguimiento de las revisiones para el administrador (C06, HU-21 y HU-23): cada pregunta con sus dos revisores,
// el desempate, la fecha límite, cuántas hay en cada grupo y las áreas sin docentes suficientes.
import type { Reloj } from '../../comun/reloj.js';
import type { AdministracionServicio } from '../administracion/index.js';
import { GRUPOS_SEGUIMIENTO, type GrupoSeguimiento } from './revision.reglas.js';
import {
  type AreaSinDocentes,
  type AsignacionSeguida,
  type FilaSeguimiento,
  type SeguimientoRepositorio,
} from './revision.seguimiento.repositorio.js';

export interface DependenciasSeguimiento {
  reloj: Reloj;
  repositorio: SeguimientoRepositorio;
  administracion: Pick<AdministracionServicio, 'obtenerParametroEntero'>;
}

export interface ConsultaSeguimiento {
  grupo: GrupoSeguimiento;
  pagina: number;
  porPagina: number;
}

export interface DocenteSeguido {
  correo: string;
  estado: string;
  decision: string | null;
  dificultad: string | null;
}

export interface PreguntaSeguida extends Omit<FilaSeguimiento, 'estado' | 'estadoNombre'> {
  estado: { codigo: string; nombre: string };
  revisores: DocenteSeguido[];
  desempate: DocenteSeguido | null;
  /** La fecha límite más próxima entre las revisiones pendientes; null si no queda ninguna. */
  venceEn: Date | null;
}

export interface VistaSeguimiento {
  preguntas: PreguntaSeguida[];
  conteos: Record<GrupoSeguimiento, number>;
  sinDocentes: AreaSinDocentes[];
  plazoDias: number;
}

export interface Seguimiento {
  listarSeguimiento(consulta: ConsultaSeguimiento): Promise<{
    seguimiento: VistaSeguimiento;
    paginacion: { pagina: number; porPagina: number; total: number };
  }>;
}

const aDocente = ({ correo, estado, decision, dificultad }: AsignacionSeguida): DocenteSeguido => ({
  correo,
  estado,
  decision,
  dificultad,
});

function venceAntes(asignaciones: readonly AsignacionSeguida[]): Date | null {
  const pendientes = asignaciones.filter(({ estado }) => estado === 'pendiente');
  const fechas = pendientes.map(({ venceEn }) => venceEn.getTime());
  return fechas.length > 0 ? new Date(Math.min(...fechas)) : null;
}

function aPreguntaSeguida(
  { estado, estadoNombre, ...fila }: FilaSeguimiento,
  asignaciones: readonly AsignacionSeguida[],
): PreguntaSeguida {
  const propias = asignaciones.filter(({ preguntaId }) => preguntaId === fila.id);
  const desempate = propias.find(({ rol }) => rol === 'desempate');
  return {
    ...fila,
    estado: { codigo: estado, nombre: estadoNombre },
    revisores: propias.filter(({ rol }) => rol === 'revisor').map(aDocente),
    desempate: desempate ? aDocente(desempate) : null,
    venceEn: venceAntes(propias),
  };
}

export function crearSeguimiento(d: DependenciasSeguimiento): Seguimiento {
  return {
    async listarSeguimiento({ grupo, pagina, porPagina }) {
      const ahora = d.reloj();
      const desde = (pagina - 1) * porPagina;
      const filas = await d.repositorio.listar([ahora, grupo], porPagina, desde);
      const [asignaciones, porGrupo, requeridos, plazoDias] = await Promise.all([
        d.repositorio.asignaciones(filas.map(({ id }) => id)),
        d.repositorio.contarPorGrupo(ahora),
        d.administracion.obtenerParametroEntero('revisores_requeridos'),
        d.administracion.obtenerParametroEntero('dias_plazo_revision'),
      ]);
      const conteos = Object.fromEntries(
        GRUPOS_SEGUIMIENTO.map((clave) => [clave, porGrupo[clave] ?? 0]),
      ) as Record<GrupoSeguimiento, number>;
      return {
        seguimiento: {
          preguntas: filas.map((fila) => aPreguntaSeguida(fila, asignaciones)),
          conteos,
          sinDocentes: await d.repositorio.areasSinDocentes(requeridos),
          plazoDias,
        },
        paginacion: { pagina, porPagina, total: conteos[grupo] },
      };
    },
  };
}
