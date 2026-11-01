import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { CuentasServicio } from '../cuentas/index.js';
import type { CupoInvitacionesServicio } from '../cupo-invitaciones/index.js';
import { crearConTiempoRepositorio } from './evaluaciones.con-tiempo.repositorio.js';
import { crearEstructuraRepositorio } from './evaluaciones.estructura.repositorio.js';
import { armarEvaluacion, type DetalleEstructura } from './evaluaciones.estructura.js';
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
  tipo: 'mini_ensayo' | 'diagnostico',
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

/** Preguntas, minutos, ejes y habilidades de la estructura según el curso del estudiante (A16 y A26). */
async function cifrasAntesDeEmpezar(
  dependencias: DependenciasMini,
  datos: { tipo: 'mini_ensayo' | 'diagnostico'; estudianteId: string; pruebaId: number },
  tx: Ejecutor,
) {
  const { tipo, estudianteId, pruebaId } = datos;
  const perfil = await perfilParaMini(dependencias.cuentas, estudianteId, pruebaId, tx);
  const { ahora, nivelId } = await repositorio.contexto(perfil.anioEgreso, tx);
  const estructura = await leerEstructura(tipo, pruebaId, nivelId, tx);
  const cifras = {
    pruebaId,
    cantidad: estructura.cantidad,
    duracionMin: estructura.duracionMin,
    ejes: contar(estructura.detalles, 'ejeId'),
    habilidades: contar(estructura.detalles, 'habilidadId'),
  };
  return { ahora, estructura, cifras };
}

// HU-40.3 (A25 y A26): lo que se muestra antes de empezar, sin crear la evaluación ni gastar el uso.
function disponibilidadMini(
  dependencias: DependenciasMini,
  estudianteId: string,
  pruebaId: number,
) {
  return dependencias.unidadDeTrabajo.enTransaccion(async (tx) => {
    const { ahora, estructura, cifras } = await cifrasAntesDeEmpezar(
      dependencias,
      { tipo: 'mini_ensayo', estudianteId, pruebaId },
      tx,
    );
    const usos = await dependencias.cupo.usosGratisDelMes(
      { estudianteId, pruebaId, estructuraId: estructura.id, ahora },
      tx,
    );
    const disponible = usos.conPlan || (usos.gratisRestantes ?? 0) > 0;
    return { ...cifras, ...usos, disponible, motivo: disponible ? null : 'limite_mensual' };
  });
}

// HU-36.2 (A16 y A25): si ya lo rindió este año escolar, con sus cifras para ofrecerlo.
function disponibilidadDiagnostico(
  dependencias: DependenciasMini,
  estudianteId: string,
  pruebaId: number,
) {
  return dependencias.unidadDeTrabajo.enTransaccion(async (tx) => {
    const { cifras } = await cifrasAntesDeEmpezar(
      dependencias,
      { tipo: 'diagnostico', estudianteId, pruebaId },
      tx,
    );
    const estado = await repositorio.disponibilidadDiagnostico(estudianteId, pruebaId, tx);
    return { ...cifras, ...estado, motivo: estado.disponible ? null : 'ya_rendido' };
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

export function crearMiniServicio(dependencias: DependenciasMini) {
  return {
    disponibilidadDiagnostico: (estudianteId: string, pruebaId: number) =>
      disponibilidadDiagnostico(dependencias, estudianteId, pruebaId),
    disponibilidadMiniEnsayo: (estudianteId: string, pruebaId: number) =>
      disponibilidadMini(dependencias, estudianteId, pruebaId),
    iniciarMiniEnsayo: (estudianteId: string, pruebaId: number) =>
      conReintentoDeInicio(() => iniciar(dependencias, estudianteId, pruebaId, 'mini_ensayo')),
    iniciarDiagnostico: (estudianteId: string, pruebaId: number) =>
      conReintentoDeInicio(() => iniciar(dependencias, estudianteId, pruebaId, 'diagnostico')),
  };
}
export type MiniServicio = ReturnType<typeof crearMiniServicio>;
