// HU-39.1 (RF-A15, CU-09, A24): el repaso de errores. Se corrige al responder y no usa cupo (RN-04). Con el plan
// Todas las pruebas se repasan todas las falladas; en los demás, las más recientes, hasta repaso_sin_plan.
// La cantidad es la del máximo de la estructura o las que haya: quien tiene 3 errores repasa 3. Después de crearlo
// se usa con las rutas de la práctica: siguiente, responder, cerrar y resumen.
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { CuentasServicio } from '../cuentas/index.js';
import type { SuscripcionesServicio } from '../suscripciones/index.js';
import { evaluacionConTiempoAbierta, sinPreguntas, validacion } from './evaluaciones.errores.js';
import type { PracticasRepositorio } from './evaluaciones.practicas.repositorio.js';
import type { FilaPorRepasar, RepasoRepositorio } from './evaluaciones.repaso.repositorio.js';
import type { DatosInicioRepaso } from './evaluaciones.validadores.js';

export interface DependenciasRepaso {
  repositorio: RepasoRepositorio;
  practicas: Pick<PracticasRepositorio, 'leerAbierta' | 'cerrarAbandonada'>;
  unidadDeTrabajo: UnidadDeTrabajo;
  cuentas: Pick<CuentasServicio, 'obtenerPerfilPractica'>;
  administracion: Pick<AdministracionServicio, 'obtenerParametroEntero'>;
  suscripciones: Pick<SuscripcionesServicio, 'permiteEnsayoCompleto'>;
}

interface PruebaPorRepasar {
  id: number;
  codigo: string;
  nombre: string;
  preguntas: number;
  ejes: { id: number; nombre: string; preguntas: number }[];
}

/** RN-04: `null` con el plan Todas las pruebas, que repasa todas. */
async function limiteDe(
  { administracion, suscripciones }: DependenciasRepaso,
  estudianteId: string,
  tx: Ejecutor,
): Promise<number | null> {
  if (await suscripciones.permiteEnsayoCompleto(estudianteId, tx)) return null;
  return administracion.obtenerParametroEntero('repaso_sin_plan', tx);
}

function agrupar(filas: FilaPorRepasar[]): PruebaPorRepasar[] {
  const pruebas = new Map<number, PruebaPorRepasar>();
  for (const fila of filas) {
    const prueba = pruebas.get(fila.pruebaId) ?? {
      id: fila.pruebaId,
      codigo: fila.pruebaCodigo,
      nombre: fila.pruebaNombre,
      preguntas: 0,
      ejes: [],
    };
    prueba.preguntas += fila.preguntas;
    prueba.ejes.push({ id: fila.ejeId, nombre: fila.ejeNombre, preguntas: fila.preguntas });
    pruebas.set(fila.pruebaId, prueba);
  }
  return [...pruebas.values()];
}

async function iniciar(
  dependencias: DependenciasRepaso,
  estudianteId: string,
  { pruebaId, ejeId }: DatosInicioRepaso,
) {
  const { repositorio, practicas, cuentas, unidadDeTrabajo } = dependencias;
  return unidadDeTrabajo.enTransaccion(async (tx) => {
    // La consulta del módulo cuentas bloquea app.estudiante: ordena dos inicios simultáneos.
    await cuentas.obtenerPerfilPractica(estudianteId, tx, true);
    const abierta = await practicas.leerAbierta(estudianteId, tx);
    if (abierta?.conTiempo) throw evaluacionConTiempoAbierta();
    const estructura = await repositorio.leerEstructura(pruebaId, tx);
    if (!estructura)
      throw validacion('pruebaId', 'Esa prueba no tiene repaso.', 'prueba_sin_estructura');
    const limite = await limiteDe(dependencias, estudianteId, tx);
    const alcance = { pruebaId, ...(ejeId !== undefined && { ejeId }) };
    const disponibles = await repositorio.contarDelAlcance(
      { estudianteId, limite, ...alcance },
      tx,
    );
    if (disponibles === 0) throw sinPreguntas(0, 1, []);
    if (abierta) await practicas.cerrarAbandonada(abierta.id, tx);
    const cantidad = Math.min(estructura.cantidadMax, disponibles);
    const id = await repositorio.crear(
      { estudianteId, ...alcance, estructuraId: estructura.id, cantidad },
      tx,
    );
    return { id, pruebaId, ejeId: ejeId ?? null, cantidad, entregadas: 0 };
  });
}

export function crearRepasoServicio(dependencias: DependenciasRepaso) {
  const { repositorio, unidadDeTrabajo } = dependencias;
  return {
    /** A24: cuántas preguntas hay por repasar, en total y por prueba y eje, dentro del límite. */
    porRepasar: (estudianteId: string) =>
      unidadDeTrabajo.enTransaccion(async (tx) => {
        const limite = await limiteDe(dependencias, estudianteId, tx);
        return {
          total: await repositorio.contarTotal(estudianteId, tx),
          limite,
          pruebas: agrupar(await repositorio.listar(estudianteId, limite, tx)),
        };
      }),
    iniciarRepaso: (estudianteId: string, datos: DatosInicioRepaso) =>
      iniciar(dependencias, estudianteId, datos),
  };
}

/** La siguiente pregunta de un repaso; la pide la entrega de la práctica. */
export function crearEleccionFallada(dependencias: DependenciasRepaso) {
  return async (
    estudianteId: string,
    alcance: { pruebaId: number; ejeId: number | null },
    entregadas: string[],
    tx: Ejecutor,
  ) =>
    dependencias.repositorio.siguienteFallada(
      {
        estudianteId,
        limite: await limiteDe(dependencias, estudianteId, tx),
        pruebaId: alcance.pruebaId,
        ...(alcance.ejeId !== null && { ejeId: alcance.ejeId }),
      },
      entregadas,
      tx,
    );
}

export type RepasoServicio = ReturnType<typeof crearRepasoServicio>;
export type EleccionFallada = ReturnType<typeof crearEleccionFallada>;
