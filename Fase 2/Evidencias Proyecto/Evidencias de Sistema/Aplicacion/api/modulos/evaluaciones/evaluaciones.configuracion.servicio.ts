// Configuración de evaluaciones para el administrador (C08, HU-63.1, CU-31). Cada cambio queda en la auditoría y
// vale para las evaluaciones siguientes: las ya rendidas guardan sus preguntas y su resultado (4.b).
import { ErrorConflicto, ErrorNoEncontrado, ErrorValidacion } from '../../comun/errores.js';
import type { UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import {
  problemaDeLaEstructura,
  problemaDeLasFilas,
  type EdicionEstructura,
} from './evaluaciones.configuracion.reglas.js';
import type {
  ConfiguracionRepositorio,
  FilaEstructura,
  FilaReparto,
  FilaTabla,
  Opcion,
} from './evaluaciones.configuracion.repositorio.js';

export interface DependenciasConfiguracion {
  unidadDeTrabajo: UnidadDeTrabajo;
  repositorio: ConfiguracionRepositorio;
  administracion: Pick<AdministracionServicio, 'registrarAuditoria'>;
}

export interface EstructuraConReparto extends FilaEstructura {
  reparto: Omit<FilaReparto, 'estructuraId'>[];
}

export interface DatosNuevaTabla {
  pruebaId: number;
  procesoId: number;
  anioAdmision: number;
  electivoAreaId: number | null;
  publicadaEn: string;
  filas: { correctas: number; puntaje: number }[];
}

export interface TablasDeLaPrueba {
  tablas: FilaTabla[];
  procesos: Opcion[];
  /** Los electivos de la prueba: si hay, cada tabla es de uno (Ciencias). */
  electivos: Opcion[];
}

export interface ConfiguracionEvaluaciones {
  listarEstructuras(pruebaId: number): Promise<EstructuraConReparto[]>;
  editarEstructura(
    autorId: string,
    id: number,
    datos: EdicionEstructura,
  ): Promise<EstructuraConReparto>;
  listarTablas(pruebaId: number): Promise<TablasDeLaPrueba>;
  cargarTabla(autorId: string, datos: DatosNuevaTabla): Promise<FilaTabla>;
}

const sinEstructura = ({ estructuraId: _, ...fila }: FilaReparto) => fila;

const conReparto = (estructura: FilaEstructura, reparto: readonly FilaReparto[]) => ({
  ...estructura,
  reparto: reparto.map(sinEstructura),
});

function exigir(problema: string | null, campo = 'reparto'): void {
  if (problema !== null) {
    throw new ErrorValidacion([{ lugar: 'cuerpo', ruta: campo, mensaje: problema }], problema);
  }
}

/** Con electivos, cada tabla es de uno de ellos; sin electivos, ninguna lo indica. */
function exigirElectivo(datos: DatosNuevaTabla, electivos: readonly { id: number }[]): void {
  const valido =
    electivos.length === 0
      ? datos.electivoAreaId === null
      : electivos.some(({ id }) => id === datos.electivoAreaId);
  exigir(valido ? null : 'Elige un electivo válido para esta prueba.', 'electivoAreaId');
}

function crearEdicion(d: DependenciasConfiguracion) {
  return (autorId: string, id: number, datos: EdicionEstructura) =>
    d.unidadDeTrabajo.enTransaccion(async (tx) => {
      const antes = await d.repositorio.bloquearEstructura(id, tx);
      if (!antes) throw new ErrorNoEncontrado('La estructura no existe.');
      const repartoAntes = await d.repositorio.repartoDe(id, tx);
      exigir(problemaDeLaEstructura(datos, antes, repartoAntes));
      const { reparto, ...cambio } = datos;
      await d.repositorio.actualizarEstructura(id, cambio, tx);
      for (const fila of reparto) await d.repositorio.actualizarReparto(fila.id, fila.cantidad, tx);
      const despues = await d.repositorio.bloquearEstructura(id, tx);
      const repartoDespues = await d.repositorio.repartoDe(id, tx);
      await d.administracion.registrarAuditoria(
        {
          usuarioId: autorId,
          accion: 'editar_estructura',
          entidad: 'estructura_evaluacion',
          entidadId: String(id),
          antes: { ...conReparto(antes, repartoAntes) },
          despues: { ...conReparto(despues!, repartoDespues) },
        },
        tx,
      );
      return conReparto(despues!, repartoDespues);
    });
}

function crearCarga(d: DependenciasConfiguracion) {
  return async (autorId: string, { filas, ...tabla }: DatosNuevaTabla) => {
    exigir(problemaDeLasFilas(filas), 'filas');
    exigirElectivo({ ...tabla, filas }, await d.repositorio.electivos(tabla.pruebaId));
    return d.unidadDeTrabajo.enTransaccion(async (tx) => {
      const nueva = { ...tabla, cargadaPor: autorId };
      if (await d.repositorio.existeTabla(nueva, tx)) {
        throw new ErrorConflicto('Ya existe una tabla de esa prueba, año y proceso.');
      }
      const id = await d.repositorio.crearTabla(nueva, filas, tx);
      await d.administracion.registrarAuditoria(
        {
          usuarioId: autorId,
          accion: 'cargar_tabla_conversion',
          entidad: 'tabla_conversion',
          entidadId: String(id),
          antes: null,
          despues: { ...tabla, filas: filas.length },
        },
        tx,
      );
      const guardadas = await d.repositorio.tablas(tabla.pruebaId, tx);
      return guardadas.find((fila) => fila.id === id)!;
    });
  };
}

export function crearConfiguracionEvaluaciones(
  d: DependenciasConfiguracion,
): ConfiguracionEvaluaciones {
  return {
    async listarEstructuras(pruebaId) {
      const [estructuras, repartos] = await Promise.all([
        d.repositorio.estructuras(pruebaId),
        d.repositorio.repartos(pruebaId),
      ]);
      return estructuras.map((estructura) =>
        conReparto(
          estructura,
          repartos.filter(({ estructuraId }) => estructuraId === estructura.id),
        ),
      );
    },
    editarEstructura: crearEdicion(d),
    async listarTablas(pruebaId) {
      const [tablas, procesos, electivos] = await Promise.all([
        d.repositorio.tablas(pruebaId),
        d.repositorio.procesos(),
        d.repositorio.electivos(pruebaId),
      ]);
      return { tablas, procesos, electivos };
    },
    cargarTabla: crearCarga(d),
  };
}
