import type { Ejecutor } from '../../db/transaccion.js';
import {
  type ContenidoConsultaFila,
  crearTemarioConsultaRepositorio,
} from './temario.consulta.repositorio.js';
import type { Area, ContenidoTemario, PruebaTemario, TemarioServicio } from './temario.servicio.js';

export interface ContenidoConsulta extends ContenidoTemario {
  area: Area;
  curso: string | null;
  descriptores: string | null;
  activo: boolean;
}

export interface PruebaConsulta extends Omit<PruebaTemario, 'ejes' | 'habilidades'> {
  ejes: { id: number; nombre: string; contenidos: ContenidoConsulta[] }[];
  habilidades: { id: number; codigo: string; nombre: string; criterios: string | null }[];
}

export interface ConsultaTemario {
  areas: Area[];
  pruebas: PruebaConsulta[];
}

function completarContenido(c: ContenidoTemario, detalles: Map<number, ContenidoConsultaFila>) {
  const detalle = detalles.get(c.id);
  if (!detalle) throw new Error('Faltan los datos de un contenido del temario.');
  return {
    ...c,
    descriptores: detalle.descriptores,
    activo: detalle.activo,
    curso: detalle.curso,
    area: { id: detalle.areaId, nombre: detalle.areaNombre },
  };
}

/** HU-10 esc. 3 / CP-07: permite contrastar lo cargado sin ofrecer la edición de HU-14. */
export async function consultarTemario(
  servicio: Pick<TemarioServicio, 'listarAreas' | 'listarTemario'>,
  bd: Ejecutor,
): Promise<ConsultaTemario> {
  const repositorio = crearTemarioConsultaRepositorio(bd);
  const areas = await servicio.listarAreas();
  const pruebas = await servicio.listarTemario();
  const detalles = new Map((await repositorio.contenidos()).map((c) => [c.id, c]));
  const habilidades = await repositorio.habilidades();
  return {
    areas,
    pruebas: pruebas.map((p) => ({
      ...p,
      ejes: p.ejes.map((e) => ({
        ...e,
        contenidos: e.contenidos.map((c) => completarContenido(c, detalles)),
      })),
      habilidades: habilidades
        .filter((h) => h.pruebaId === p.id)
        .map(({ id, codigo, nombre, criterios }) => ({ id, codigo, nombre, criterios })),
    })),
  };
}
