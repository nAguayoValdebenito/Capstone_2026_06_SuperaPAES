import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { CuentasServicio } from '../cuentas/index.js';
import type { CupoInvitacionesServicio } from '../cupo-invitaciones/index.js';
import { crearConTiempoRepositorio } from './evaluaciones.con-tiempo.repositorio.js';
import { crearEstructuraRepositorio } from './evaluaciones.estructura.repositorio.js';
import { armarEvaluacion } from './evaluaciones.estructura.js';
import { evaluacionConTiempoAbierta, sinPreguntas, validacion } from './evaluaciones.errores.js';
import type { EvaluacionesRepositorio } from './evaluaciones.repositorio.js';
import { crearPracticasRepositorio } from './evaluaciones.practicas.repositorio.js';
import { conReintentoDeInicio } from './evaluaciones.reintento-inicio.js';

interface DependenciasMini {
  unidadDeTrabajo: UnidadDeTrabajo;
  cuentas: Pick<CuentasServicio, 'obtenerPerfilPractica'>;
  cupo: Pick<CupoInvitacionesServicio, 'registrarUsoGratis'>;
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

async function prepararArmado(
  datos: { pruebaId: number; nivelId: number | null; electivoId: number | null },
  seleccion: EvaluacionesRepositorio,
  tx: Ejecutor,
) {
  const { pruebaId, nivelId, electivoId } = datos;
  const estructura = await estructuras.leer(pruebaId, nivelId, tx);
  if (!estructura)
    throw validacion(
      'pruebaId',
      'No hay una estructura activa de mini-ensayo para esta prueba.',
      'prueba_sin_estructura',
    );
  if (estructura.codigo === 'CIE' && !electivoId)
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

async function iniciar(dependencias: DependenciasMini, estudianteId: string, pruebaId: number) {
  return dependencias.unidadDeTrabajo.enTransaccion(async (tx) => {
    const perfil = await perfilParaMini(dependencias.cuentas, estudianteId, pruebaId, tx);
    const abierta = await repositorio.abierta(estudianteId, tx);
    if (abierta?.conTiempo) throw evaluacionConTiempoAbierta(abierta);
    const { ahora, nivelId } = await repositorio.contexto(perfil.anioEgreso, tx);
    const { estructura, preguntas } = await prepararArmado(
      { pruebaId, nivelId, electivoId: perfil.electivoId ?? null },
      dependencias.seleccion,
      tx,
    );
    if (abierta) await crearPracticasRepositorio().cerrarAbandonada(abierta.id, tx);
    const electivoId = estructura.codigo === 'CIE' ? (perfil.electivoId ?? null) : null;
    const id = await repositorio.crear(
      { estudianteId, estructura, ahora, preguntas, electivoId },
      tx,
    );
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
    iniciarMiniEnsayo: (estudianteId: string, pruebaId: number) =>
      conReintentoDeInicio(() => iniciar(dependencias, estudianteId, pruebaId)),
  };
}
export type MiniServicio = ReturnType<typeof crearMiniServicio>;
