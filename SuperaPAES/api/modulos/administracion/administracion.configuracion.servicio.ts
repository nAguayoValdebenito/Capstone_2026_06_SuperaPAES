// HU-51.1: listar y cambiar parámetros con control de concurrencia y auditoría atómica.
import { ErrorConflicto, ErrorNoEncontrado } from '../../comun/errores.js';
import type { UnidadDeTrabajo, Ejecutor } from '../../db/transaccion.js';
import type { AdministracionRepositorio, EntradaAuditoria } from './administracion.repositorio.js';
import {
  crearConfiguracionRepositorio,
  type ConfiguracionRepositorio,
  type FilaConfiguracion,
} from './administracion.configuracion.repositorio.js';
import {
  reglaConfiguracion,
  validarValorConfiguracion,
} from './administracion.configuracion.reglas.js';

export interface ParametroConfiguracion {
  clave: string;
  nombre: string;
  descripcion: string;
  valor: unknown;
  unidad: string;
  editable: boolean;
  regla: string;
  actualizadoEn: Date;
  actualizadoPor: string | null;
}

export interface ConfiguracionServicio {
  listarConfiguracion(): Promise<{ parametros: ParametroConfiguracion[] }>;
  cambiarConfiguracion(
    autorId: string,
    clave: string,
    cambio: { valor: unknown; actualizadoEn: string },
  ): Promise<ParametroConfiguracion>;
}

export interface DependenciasConfiguracion {
  repositorio: ConfiguracionRepositorio;
  unidadDeTrabajo: UnidadDeTrabajo;
  registrarAuditoria: (entrada: EntradaAuditoria, tx: Ejecutor) => Promise<void>;
}

function aParametro(fila: FilaConfiguracion): ParametroConfiguracion {
  const regla = reglaConfiguracion(fila.clave);
  return {
    ...fila,
    nombre: regla?.nombre ?? fila.clave,
    unidad: regla?.unidad ?? '',
    editable: regla?.editable ?? false,
    regla: regla?.regla ?? 'Sin regla documentada',
  };
}

async function cambiar(
  d: DependenciasConfiguracion,
  autorId: string,
  clave: string,
  cambio: { valor: unknown; actualizadoEn: string },
) {
  return d.unidadDeTrabajo.enTransaccion(async (tx) => {
    const anterior = await d.repositorio.buscar(clave, true, tx);
    if (!anterior) throw new ErrorNoEncontrado('El parámetro no existe.');
    const valor = validarValorConfiguracion(clave, cambio.valor);
    if (anterior.actualizadoEn.toISOString() !== cambio.actualizadoEn) {
      throw new ErrorConflicto(
        'Otro administrador modificó este parámetro. Recarga el valor vigente.',
      );
    }
    const nuevo = await d.repositorio.actualizar(clave, valor, autorId, tx);
    await d.registrarAuditoria(
      {
        usuarioId: autorId,
        accion: 'cambiar_configuracion',
        entidad: 'configuracion',
        entidadId: clave,
        antes: { clave, valor: anterior.valor },
        despues: { clave, valor: nuevo.valor },
      },
      tx,
    );
    return aParametro(nuevo);
  });
}

export function crearConfiguracionServicio(d: DependenciasConfiguracion): ConfiguracionServicio {
  return {
    listarConfiguracion: async () => ({
      parametros: (await d.repositorio.listar()).map(aParametro),
    }),
    cambiarConfiguracion: (autorId, clave, cambio) => cambiar(d, autorId, clave, cambio),
  };
}

export function crearConfiguracionDe(
  bd: Ejecutor,
  unidadDeTrabajo: UnidadDeTrabajo,
  registrarAuditoria: DependenciasConfiguracion['registrarAuditoria'],
  repositorio?: ConfiguracionRepositorio,
): ConfiguracionServicio {
  return crearConfiguracionServicio({
    repositorio: repositorio ?? crearConfiguracionRepositorio(bd),
    unidadDeTrabajo,
    registrarAuditoria,
  });
}

/** Lecturas vigentes para los otros módulos: nunca usan un valor de respaldo. */
export function crearLecturaConfiguracion(
  repositorio: Pick<AdministracionRepositorio, 'leerParametro'>,
) {
  return {
    obtenerParametroTexto: async (clave: string, tx?: Ejecutor) => {
      const valor = await repositorio.leerParametro(clave, tx);
      if (typeof valor !== 'string' || valor.trim() === '') {
        throw new Error('Parámetro de texto ausente o inválido.');
      }
      return valor;
    },
    obtenerParametroNumero: async (clave: string, tx?: Ejecutor) => {
      const valor = await repositorio.leerParametro(clave, tx);
      if (typeof valor !== 'number' || !Number.isFinite(valor)) {
        throw new Error(`contenido.configuracion no tiene un número en ${clave}.`);
      }
      return valor;
    },
    obtenerParametroEntero: async (clave: string, tx?: Ejecutor) => {
      const valor = await repositorio.leerParametro(clave, tx);
      if (typeof valor !== 'number' || !Number.isInteger(valor)) {
        throw new Error(`contenido.configuracion no tiene un entero en ${clave}.`);
      }
      return valor;
    },
  };
}
