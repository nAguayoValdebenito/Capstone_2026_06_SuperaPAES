import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { CuentasServicio } from '../cuentas/index.js';
import type { SuscripcionesServicio } from '../suscripciones/index.js';
import { ErrorAplicacion } from '../../comun/errores.js';
import { crearConTiempoRepositorio } from './evaluaciones.con-tiempo.repositorio.js';
import { crearEstructuraRepositorio } from './evaluaciones.estructura.repositorio.js';
import { armarEnsayo } from './evaluaciones.estructura.js';
import { evaluacionConTiempoAbierta, sinPreguntas, validacion } from './evaluaciones.errores.js';
import type { EvaluacionesRepositorio } from './evaluaciones.repositorio.js';
import { crearPracticasRepositorio } from './evaluaciones.practicas.repositorio.js';
import { conReintentoDeInicio } from './evaluaciones.reintento-inicio.js';
import { leerEstructura, perfilParaMini } from './evaluaciones.mini.servicio.js';

interface DependenciasEnsayo {
  unidadDeTrabajo: UnidadDeTrabajo;
  cuentas: Pick<CuentasServicio, 'obtenerPerfilPractica'>;
  suscripciones: Pick<SuscripcionesServicio, 'permiteEnsayoCompleto'>;
  seleccion: EvaluacionesRepositorio;
  azar: () => number;
}

const repositorio = crearConTiempoRepositorio();
const estructuras = crearEstructuraRepositorio();
const sinPlanTodas = () =>
  new ErrorAplicacion(
    403,
    'SIN_PERMISO',
    'El ensayo completo requiere el plan Todas las pruebas.',
    {
      detalles: { motivo: 'plan_todas_requerido' },
    },
  );

function sortearNoPuntuables(
  grupos: NonNullable<ReturnType<typeof armarEnsayo>>,
  cantidad: number,
  azar: () => number,
): Set<string> {
  const bolsas = new Map<string, { id: string; cantidad: number }[]>();
  for (const { pregunta, grupo } of grupos) {
    const clave = grupo ? String(grupo.orden) + (grupo.esElectivo ? 'e' : 'c') : 'total';
    const bolsa = bolsas.get(clave) ?? [];
    bolsa.push({ id: pregunta.preguntaId, cantidad: grupo?.noPuntuables ?? cantidad });
    bolsas.set(clave, bolsa);
  }
  const elegidas = new Set<string>();
  for (const bolsa of bolsas.values()) {
    const tomar = bolsa[0]!.cantidad;
    for (let i = 0; i < tomar; i++) {
      const indice = i + Math.floor(azar() * (bolsa.length - i));
      [bolsa[i], bolsa[indice]] = [bolsa[indice]!, bolsa[i]!];
      elegidas.add(bolsa[i]!.id);
    }
  }
  return elegidas;
}

async function disponibilidadEnsayo(
  dependencias: DependenciasEnsayo,
  estudianteId: string,
  pruebaId: number,
) {
  return dependencias.unidadDeTrabajo.enTransaccion(async (tx) => {
    const perfil = await perfilParaMini(dependencias.cuentas, estudianteId, pruebaId, tx);
    const estructura = await leerEstructura('ensayo', pruebaId, null, tx);
    const plan = await dependencias.suscripciones.permiteEnsayoCompleto(estudianteId, tx);
    const electivo = estructura.codigo !== 'CIE' || Boolean(perfil.electivoId);
    const disponible = plan && electivo;
    return {
      pruebaId,
      cantidad: estructura.cantidad,
      duracionMin: estructura.duracionMin,
      textos: estructura.textos,
      sinPuntaje: estructura.noPuntuables ?? 0,
      disponible,
      motivo: !plan ? 'plan_todas_requerido' : !electivo ? 'electivo_requerido' : null,
    };
  });
}

function electivoParaEnsayo(codigo: string, electivoId: number | null): number | null {
  if (codigo !== 'CIE') return null;
  if (!electivoId)
    throw validacion(
      'pruebaId',
      'Elige tu electivo de Ciencias en el perfil antes de empezar.',
      'electivo_requerido',
    );
  return electivoId;
}

async function guardarEnsayo(
  estudianteId: string,
  pruebaId: number,
  tx: Ejecutor,
  datos: Parameters<typeof repositorio.crear>[0],
) {
  const id = await repositorio.crear(datos, tx);
  return {
    id,
    pruebaId,
    cantidad: datos.preguntas.length,
    duracionMin: datos.estructura.duracionMin,
    venceEn: new Date(datos.ahora.getTime() + datos.estructura.duracionMin * 60_000),
    preguntas: await repositorio.preguntas(id, estudianteId, tx),
  };
}

async function iniciarEnsayo(
  dependencias: DependenciasEnsayo,
  estudianteId: string,
  pruebaId: number,
) {
  return dependencias.unidadDeTrabajo.enTransaccion(async (tx) => {
    const perfil = await perfilParaMini(dependencias.cuentas, estudianteId, pruebaId, tx);
    if (!(await dependencias.suscripciones.permiteEnsayoCompleto(estudianteId, tx)))
      throw sinPlanTodas();
    const abierta = await repositorio.abierta(estudianteId, tx);
    if (abierta?.conTiempo) throw evaluacionConTiempoAbierta(abierta);
    const { ahora } = await repositorio.contexto(perfil.anioEgreso, tx);
    const estructura = await leerEstructura('ensayo', pruebaId, null, tx);
    const electivoId = electivoParaEnsayo(estructura.codigo, perfil.electivoId ?? null);
    const candidatas = await estructuras.candidatas(pruebaId, null, tx, estudianteId);
    const grupos = armarEnsayo(
      estructura,
      candidatas,
      await dependencias.seleccion.leerMezcla(tx),
      electivoId,
    );
    if (!grupos) throw sinPreguntas(candidatas.length, estructura.cantidad, []);
    const preguntas = grupos.map(({ pregunta }) => pregunta);
    const noPuntuables = sortearNoPuntuables(
      grupos,
      estructura.noPuntuables ?? 0,
      dependencias.azar,
    );
    const tablaConversionId = await estructuras.tablaReciente(pruebaId, electivoId, tx);
    if (abierta) await crearPracticasRepositorio().cerrarAbandonada(abierta.id, tx);
    return guardarEnsayo(estudianteId, pruebaId, tx, {
      tipo: 'ensayo',
      estudianteId,
      estructura,
      ahora,
      preguntas,
      electivoId,
      noPuntuables,
      tablaConversionId,
    });
  });
}

export function crearEnsayoServicio(dependencias: DependenciasEnsayo) {
  return {
    disponibilidadEnsayo: (estudianteId: string, pruebaId: number) =>
      disponibilidadEnsayo(dependencias, estudianteId, pruebaId),
    iniciarEnsayo: (estudianteId: string, pruebaId: number) =>
      conReintentoDeInicio(() => iniciarEnsayo(dependencias, estudianteId, pruebaId)),
  };
}
export type EnsayoServicio = ReturnType<typeof crearEnsayoServicio>;
