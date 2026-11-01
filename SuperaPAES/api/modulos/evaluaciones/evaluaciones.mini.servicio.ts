import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { CuentasServicio } from '../cuentas/index.js';
import type { CupoInvitacionesServicio } from '../cupo-invitaciones/index.js';
import type { SuscripcionesServicio } from '../suscripciones/index.js';
import { ErrorAplicacion } from '../../comun/errores.js';
import { crearConTiempoRepositorio } from './evaluaciones.con-tiempo.repositorio.js';
import { crearEstructuraRepositorio } from './evaluaciones.estructura.repositorio.js';
import { armarEnsayo, armarEvaluacion, type DetalleEstructura } from './evaluaciones.estructura.js';
import {
  diagnosticoYaRendido,
  evaluacionConTiempoAbierta,
  sinPreguntas,
  validacion,
} from './evaluaciones.errores.js';
import type { EvaluacionesRepositorio } from './evaluaciones.repositorio.js';
import { crearPracticasRepositorio } from './evaluaciones.practicas.repositorio.js';
import { conReintentoDeInicio } from './evaluaciones.reintento-inicio.js';

interface DependenciasMini {
  unidadDeTrabajo: UnidadDeTrabajo;
  cuentas: Pick<CuentasServicio, 'obtenerPerfilPractica'>;
  cupo: Pick<CupoInvitacionesServicio, 'registrarUsoGratis' | 'usosGratisDelMes'>;
  seleccion: EvaluacionesRepositorio;
  suscripciones: Pick<SuscripcionesServicio, 'permiteEnsayoCompleto'>;
  azar: () => number;
}
const repositorio = crearConTiempoRepositorio();
const estructuras = crearEstructuraRepositorio();

async function perfilParaMini(
  cuentas: DependenciasMini['cuentas'],
  estudianteId: string,
  pruebaId: number,
  tx: Ejecutor,
) {
  const perfil = await cuentas.obtenerPerfilPractica(estudianteId, tx, true);
  if (!perfil?.anioEgreso || !perfil.pruebas.includes(pruebaId))
    throw validacion(
      'pruebaId',
      'Completa tu perfil y elige esta prueba antes de empezar.',
      'perfil_incompleto',
    );
  return { ...perfil, anioEgreso: perfil.anioEgreso };
}

async function leerEstructura(
  tipo: 'mini_ensayo' | 'diagnostico' | 'ensayo',
  pruebaId: number,
  nivelId: number | null,
  tx: Ejecutor,
) {
  const estructura = await estructuras.leer(tipo, pruebaId, nivelId, tx);
  if (!estructura)
    throw validacion(
      'pruebaId',
      `No hay una estructura activa de ${tipo === 'diagnostico' ? 'diagnóstico' : 'mini-ensayo'} para esta prueba.`,
      'prueba_sin_estructura',
    );
  return estructura;
}

/** Cuántos ejes o habilidades distintos tiene, sin los que el curso todavía no ve (RN-28). */
function contar(detalles: DetalleEstructura[], campo: 'ejeId' | 'habilidadId') {
  return new Set(detalles.filter((d) => d.disponible && d[campo] !== null).map((d) => d[campo]))
    .size;
}

// HU-40.3 (A25 y A26): lo que se muestra antes de empezar, sin crear la evaluación ni gastar el uso.
async function disponibilidadMini(
  dependencias: DependenciasMini,
  estudianteId: string,
  pruebaId: number,
) {
  return dependencias.unidadDeTrabajo.enTransaccion(async (tx) => {
    const perfil = await perfilParaMini(dependencias.cuentas, estudianteId, pruebaId, tx);
    const { ahora, nivelId } = await repositorio.contexto(perfil.anioEgreso, tx);
    const estructura = await leerEstructura('mini_ensayo', pruebaId, nivelId, tx);
    const usos = await dependencias.cupo.usosGratisDelMes(
      { estudianteId, pruebaId, estructuraId: estructura.id, ahora },
      tx,
    );
    const disponible = usos.conPlan || (usos.gratisRestantes ?? 0) > 0;
    return {
      pruebaId,
      cantidad: estructura.cantidad,
      duracionMin: estructura.duracionMin,
      ejes: contar(estructura.detalles, 'ejeId'),
      habilidades: contar(estructura.detalles, 'habilidadId'),
      ...usos,
      disponible,
      motivo: disponible ? null : 'limite_mensual',
    };
  });
}

async function prepararArmado(
  datos: {
    tipo: 'mini_ensayo' | 'diagnostico';
    pruebaId: number;
    nivelId: number | null;
    electivoId: number | null;
  },
  seleccion: EvaluacionesRepositorio,
  tx: Ejecutor,
) {
  const { tipo, pruebaId, nivelId, electivoId } = datos;
  const estructura = await leerEstructura(tipo, pruebaId, nivelId, tx);
  if (tipo === 'mini_ensayo' && estructura.codigo === 'CIE' && !electivoId)
    throw validacion(
      'pruebaId',
      'Elige tu electivo de Ciencias en el perfil antes de empezar.',
      'electivo_requerido',
    );
  const candidatas = await estructuras.candidatas(pruebaId, nivelId, tx);
  const preguntas = armarEvaluacion(
    estructura,
    candidatas,
    await seleccion.leerMezcla(tx),
    electivoId,
  );
  if (!preguntas) throw sinPreguntas(candidatas.length, estructura.cantidad, []);
  return { estructura, preguntas };
}

async function verificarDiagnostico(
  estudianteId: string,
  pruebaId: number,
  tipo: 'mini_ensayo' | 'diagnostico',
  tx: Ejecutor,
) {
  if (
    tipo === 'diagnostico' &&
    !(await repositorio.disponibilidadDiagnostico(estudianteId, pruebaId, tx)).disponible
  )
    throw diagnosticoYaRendido();
}

async function iniciar(
  dependencias: DependenciasMini,
  estudianteId: string,
  pruebaId: number,
  tipo: 'mini_ensayo' | 'diagnostico',
) {
  return dependencias.unidadDeTrabajo.enTransaccion(async (tx) => {
    const perfil = await perfilParaMini(dependencias.cuentas, estudianteId, pruebaId, tx);
    const abierta = await repositorio.abierta(estudianteId, tx);
    if (abierta?.conTiempo) throw evaluacionConTiempoAbierta(abierta);
    await verificarDiagnostico(estudianteId, pruebaId, tipo, tx);
    const { ahora, nivelId } = await repositorio.contexto(perfil.anioEgreso, tx);
    const { estructura, preguntas } = await prepararArmado(
      { tipo, pruebaId, nivelId, electivoId: perfil.electivoId ?? null },
      dependencias.seleccion,
      tx,
    );
    if (abierta) await crearPracticasRepositorio().cerrarAbandonada(abierta.id, tx);
    const electivoId =
      tipo === 'mini_ensayo' && estructura.codigo === 'CIE' ? (perfil.electivoId ?? null) : null;
    const id = await repositorio.crear(
      { tipo, estudianteId, estructura, ahora, preguntas, electivoId },
      tx,
    );
    if (tipo === 'mini_ensayo')
      await dependencias.cupo.registrarUsoGratis(
        { estudianteId, pruebaId, estructuraId: estructura.id, evaluacionId: id, ahora },
        tx,
      );
    return {
      id,
      pruebaId,
      cantidad: preguntas.length,
      duracionMin: estructura.duracionMin,
      venceEn: new Date(ahora.getTime() + estructura.duracionMin * 60_000),
      preguntas: await repositorio.preguntas(id, estudianteId, tx),
    };
  });
}

const sinPlanTodas = () => new ErrorAplicacion(403, 'SIN_PERMISO',
  'El ensayo completo requiere el plan Todas las pruebas.',
  { detalles: { motivo: 'plan_todas_requerido' } });

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

async function disponibilidadEnsayo(dependencias: DependenciasMini, estudianteId: string, pruebaId: number) {
  return dependencias.unidadDeTrabajo.enTransaccion(async (tx) => {
    await perfilParaMini(dependencias.cuentas, estudianteId, pruebaId, tx);
    const estructura = await leerEstructura('ensayo', pruebaId, null, tx);
    const disponible = await dependencias.suscripciones.permiteEnsayoCompleto(estudianteId, tx);
    return { pruebaId, cantidad: estructura.cantidad, duracionMin: estructura.duracionMin,
      textos: estructura.textos, sinPuntaje: estructura.noPuntuables ?? 0,
      disponible, motivo: disponible ? null : 'plan_todas_requerido' };
  });
}

function electivoParaEnsayo(codigo: string, electivoId: number | null): number | null {
  if (codigo !== 'CIE') return null;
  if (!electivoId)
    throw validacion('pruebaId', 'Elige tu electivo de Ciencias en el perfil antes de empezar.', 'electivo_requerido');
  return electivoId;
}

async function iniciarEnsayo(dependencias: DependenciasMini, estudianteId: string, pruebaId: number) {
  return dependencias.unidadDeTrabajo.enTransaccion(async (tx) => {
    const perfil = await perfilParaMini(dependencias.cuentas, estudianteId, pruebaId, tx);
    if (!(await dependencias.suscripciones.permiteEnsayoCompleto(estudianteId, tx))) throw sinPlanTodas();
    const abierta = await repositorio.abierta(estudianteId, tx);
    if (abierta?.conTiempo) throw evaluacionConTiempoAbierta(abierta);
    const { ahora } = await repositorio.contexto(perfil.anioEgreso, tx);
    const estructura = await leerEstructura('ensayo', pruebaId, null, tx);
    const electivoId = electivoParaEnsayo(estructura.codigo, perfil.electivoId ?? null);
    const candidatas = await estructuras.candidatas(pruebaId, null, tx, estudianteId);
    const grupos = armarEnsayo(estructura, candidatas, await dependencias.seleccion.leerMezcla(tx), electivoId);
    if (!grupos) throw sinPreguntas(candidatas.length, estructura.cantidad, []);
    const preguntas = grupos.map(({ pregunta }) => pregunta);
    const noPuntuables = sortearNoPuntuables(grupos, estructura.noPuntuables ?? 0, dependencias.azar);
    if (abierta) await crearPracticasRepositorio().cerrarAbandonada(abierta.id, tx);
    const id = await repositorio.crear({ tipo: 'ensayo', estudianteId, estructura, ahora,
      preguntas, electivoId, noPuntuables }, tx);
    return { id, pruebaId, cantidad: preguntas.length, duracionMin: estructura.duracionMin,
      venceEn: new Date(ahora.getTime() + estructura.duracionMin * 60_000),
      preguntas: await repositorio.preguntas(id, estudianteId, tx) };
  });
}

export function crearMiniServicio(dependencias: DependenciasMini) {
  return {
    disponibilidadDiagnostico: (estudianteId: string, pruebaId: number) =>
      dependencias.unidadDeTrabajo.enTransaccion(async (tx) => {
        await perfilParaMini(dependencias.cuentas, estudianteId, pruebaId, tx);
        const estado = await repositorio.disponibilidadDiagnostico(estudianteId, pruebaId, tx);
        return { pruebaId, ...estado, motivo: estado.disponible ? null : 'ya_rendido' };
      }),
    disponibilidadMiniEnsayo: (estudianteId: string, pruebaId: number) =>
      disponibilidadMini(dependencias, estudianteId, pruebaId),
    iniciarMiniEnsayo: (estudianteId: string, pruebaId: number) =>
      conReintentoDeInicio(() => iniciar(dependencias, estudianteId, pruebaId, 'mini_ensayo')),
    iniciarDiagnostico: (estudianteId: string, pruebaId: number) =>
      conReintentoDeInicio(() => iniciar(dependencias, estudianteId, pruebaId, 'diagnostico')),
    disponibilidadEnsayo: (estudianteId: string, pruebaId: number) =>
      disponibilidadEnsayo(dependencias, estudianteId, pruebaId),
    iniciarEnsayo: (estudianteId: string, pruebaId: number) =>
      conReintentoDeInicio(() => iniciarEnsayo(dependencias, estudianteId, pruebaId)),
  };
}
export type MiniServicio = ReturnType<typeof crearMiniServicio>;
