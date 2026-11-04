// HU-52.1, CU-24: solo editar; el plan y sus productos se guardan junto con la auditoría.
import { ErrorConflicto, ErrorNoEncontrado, ErrorValidacion } from '../../comun/errores.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import {
  crearPlanesRepositorio,
  type OpcionesPlanes,
  type PlanAdministrable,
  type PlanesRepositorio,
} from './suscripciones.planes.repositorio.js';
import type { DatosEditarPlan } from './suscripciones.planes.validadores.js';

export interface DependenciasPlanes {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  administracion: Pick<AdministracionServicio, 'registrarAuditoria'>;
  repositorioPlanes?: PlanesRepositorio;
}

export interface PlanesServicio {
  listarPlanes(): Promise<OpcionesPlanes & { planes: PlanAdministrable[] }>;
  editarPlan(autorId: string, id: number, datos: DatosEditarPlan): Promise<PlanAdministrable>;
}

function validarOpciones(datos: DatosEditarPlan, opciones: OpcionesPlanes): void {
  if (!opciones.alcances.some((o) => o.id === datos.alcanceId)) {
    throw new ErrorValidacion([], 'El alcance elegido no existe.');
  }
  if (!opciones.periodicidades.some((o) => o.id === datos.periodicidadId)) {
    throw new ErrorValidacion([], 'Elige una periodicidad mensual o anual existente.');
  }
}

async function traducirRestricciones<T>(trabajo: () => Promise<T>): Promise<T> {
  try {
    return await trabajo();
  } catch (error) {
    if (typeof error !== 'object' || error === null || !('code' in error)) throw error;
    if (error.code === '23505') {
      throw new ErrorConflicto(
        'Ya existe un plan con ese nombre, alcance y periodicidad, o producto en la tienda.',
      );
    }
    throw error;
  }
}

export function crearPlanesServicio(d: DependenciasPlanes): PlanesServicio {
  const repositorio = d.repositorioPlanes ?? crearPlanesRepositorio(d.bd);
  return {
    async listarPlanes() {
      const [planes, opciones] = await Promise.all([repositorio.listar(), repositorio.opciones()]);
      return { planes, ...opciones };
    },
    editarPlan: (autorId, id, datos) =>
      traducirRestricciones(() =>
        d.unidadDeTrabajo.enTransaccion(async (tx) => {
          const antes = await repositorio.obtener(id, tx, true);
          if (!antes) throw new ErrorNoEncontrado('El plan no existe.');
          validarOpciones(datos, await repositorio.opciones(tx));
          await repositorio.editar(id, datos, tx);
          const despues = await repositorio.obtener(id, tx);
          if (!despues) throw new ErrorNoEncontrado('El plan no existe.');
          await d.administracion.registrarAuditoria(
            {
              usuarioId: autorId,
              accion: 'editar_plan',
              entidad: 'plan',
              entidadId: String(id),
              antes: { ...antes },
              despues: { ...despues },
            },
            tx,
          );
          return despues;
        }),
      ),
  };
}
