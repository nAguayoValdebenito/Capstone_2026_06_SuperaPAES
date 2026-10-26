// HU-30.1 y HU-31.2: transacciones de inicio y entrega. Antes de entregar una pregunta nueva se exige
// cupo (HU-33 esc. 1, RF-A09): el estudiante no recibe una pregunta que no podría responder.
import type { Reloj } from '../../comun/reloj.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { CuentasServicio } from '../cuentas/index.js';
import type { CupoInvitacionesServicio } from '../cupo-invitaciones/index.js';
import {
  evaluacionCerrada,
  evaluacionConTiempoAbierta,
  evaluacionNoEncontrada,
  practicaCompleta,
  sinPreguntas,
  validacion,
} from './evaluaciones.errores.js';
import type { TemarioServicio } from '../temario/index.js';
import type {
  ContextoInicio,
  EvaluacionAbierta,
  EstructuraPractica,
  PracticaGuardada,
  PracticasRepositorio,
} from './evaluaciones.practicas.repositorio.js';
import type { SeleccionPractica } from './evaluaciones.seleccion.servicio.js';
import type { FiltrosSeleccion } from './evaluaciones.seleccion.tipos.js';
import type { DatosInicioPractica } from './evaluaciones.validadores.js';

export interface DependenciasPracticas {
  repositorio: PracticasRepositorio;
  unidadDeTrabajo: UnidadDeTrabajo;
  cuentas: Pick<CuentasServicio, 'obtenerPerfilPractica' | 'estadoParaCupo'>;
  temario: Pick<TemarioServicio, 'alcancePracticaValido'>;
  cupo: Pick<CupoInvitacionesServicio, 'exigirCupoDisponible'>;
  reloj: Reloj;
  seleccion: SeleccionPractica;
}

function filtrosDe({
  estudianteId,
  datos,
  contexto,
  dificultad,
}: {
  estudianteId: string;
  datos: DatosInicioPractica;
  contexto: ContextoInicio;
  dificultad?: FiltrosSeleccion['dificultad'];
}): FiltrosSeleccion {
  return {
    estudianteId,
    pruebaId: datos.pruebaId,
    ...(datos.ejeId !== undefined && { ejeId: datos.ejeId }),
    ...(datos.contenidoId !== undefined && { contenidoId: datos.contenidoId }),
    ...(datos.habilidadId !== undefined && { habilidadId: datos.habilidadId }),
    ...(dificultad && { dificultad }),
    iniciadaEn: contexto.iniciadaEn,
    nivelEscolarId: contexto.nivelEscolarId,
    entregadas: [],
  };
}

function alcanceDe(practica: PracticaGuardada): Partial<FiltrosSeleccion> {
  return {
    ...(practica.ejeId !== null && { ejeId: practica.ejeId }),
    ...(practica.contenidoId !== null && { contenidoId: practica.contenidoId }),
    ...(practica.habilidadId !== null && { habilidadId: practica.habilidadId }),
    ...(practica.dificultad !== null && { dificultad: practica.dificultad }),
  };
}

async function opcionesInsuficiencia(
  dependencias: DependenciasPracticas,
  filtros: FiltrosSeleccion,
  cantidad: number,
  tx: Ejecutor,
): Promise<string[]> {
  const opciones: string[] = [];
  if (filtros.dificultad) {
    const mezcla = { ...filtros };
    delete mezcla.dificultad;
    if ((await dependencias.seleccion.contarDisponibles(mezcla, tx)) >= cantidad)
      opciones.push('usar_mezcla');
  }
  if (filtros.ejeId || filtros.contenidoId || filtros.habilidadId) {
    const prueba = { ...filtros };
    delete prueba.ejeId;
    delete prueba.contenidoId;
    delete prueba.habilidadId;
    if ((await dependencias.seleccion.contarDisponibles(prueba, tx)) >= cantidad)
      opciones.push('ampliar_alcance');
  }
  return opciones;
}

async function perfilParaInicio(
  { cuentas, repositorio }: DependenciasPracticas,
  estudianteId: string,
  pruebaId: number,
  tx: Ejecutor,
): Promise<{ anioEgreso: number; abierta: EvaluacionAbierta | null }> {
  // La consulta del módulo cuentas bloquea app.estudiante: ordena dos inicios simultáneos.
  const perfil = await cuentas.obtenerPerfilPractica(estudianteId, tx, true);
  if (!perfil || perfil.anioEgreso === null || perfil.pruebas.length === 0)
    throw validacion('pruebaId', 'Completa tu perfil antes de practicar.', 'perfil_incompleto');
  const abierta = await repositorio.leerAbierta(estudianteId, tx);
  if (abierta?.conTiempo) throw evaluacionConTiempoAbierta();
  if (!perfil.pruebas.includes(pruebaId))
    throw validacion('pruebaId', 'Esa prueba no está en tu perfil.', 'prueba_no_elegida');
  return { anioEgreso: perfil.anioEgreso, abierta };
}

async function estructuraParaInicio(
  repositorio: PracticasRepositorio,
  datos: DatosInicioPractica,
  tx: Ejecutor,
): Promise<EstructuraPractica> {
  const estructura = await repositorio.leerEstructura(datos.pruebaId, tx);
  if (!estructura)
    throw validacion(
      'pruebaId',
      'No hay una estructura activa de práctica para esa prueba.',
      'prueba_sin_estructura',
    );
  if (datos.cantidad < estructura.cantidadMin || datos.cantidad > estructura.cantidadMax)
    throw validacion(
      'cantidad',
      `La cantidad debe estar entre ${estructura.cantidadMin} y ${estructura.cantidadMax}.`,
      'cantidad_fuera_de_rango',
    );
  return estructura;
}

async function validarAlcanceYDificultad(
  { temario, repositorio }: DependenciasPracticas,
  datos: DatosInicioPractica,
  contexto: ContextoInicio,
  tx: Ejecutor,
): Promise<FiltrosSeleccion['dificultad']> {
  const alcance = {
    pruebaId: datos.pruebaId,
    ...(datos.ejeId !== undefined && { ejeId: datos.ejeId }),
    ...(datos.contenidoId !== undefined && { contenidoId: datos.contenidoId }),
    ...(datos.habilidadId !== undefined && { habilidadId: datos.habilidadId }),
    nivelEscolarId: contexto.nivelEscolarId,
  };
  if (!(await temario.alcancePracticaValido(alcance, tx))) {
    const ruta = datos.ejeId ? 'ejeId' : datos.contenidoId ? 'contenidoId' : 'habilidadId';
    throw validacion(
      ruta,
      'El alcance no pertenece a la prueba o el contenido aún no corresponde a tu curso.',
      'alcance_no_disponible',
    );
  }
  const dificultad =
    datos.dificultadId === undefined
      ? undefined
      : await repositorio.leerDificultad(datos.dificultadId, tx);
  if (dificultad === null)
    throw validacion('dificultadId', 'La dificultad indicada no existe.', 'dificultad_inexistente');
  return dificultad;
}

/** 409 CUPO_AGOTADO si no queda cupo del día, ni saldo, ni una suscripción que cubra la prueba. */
async function exigirCupo(
  { cuentas, cupo, reloj }: DependenciasPracticas,
  estudianteId: string,
  pruebaId: number,
  tx: Ejecutor,
): Promise<void> {
  const cuenta = await cuentas.estadoParaCupo(estudianteId, tx);
  const correoVerificado = cuenta?.correoVerificado ?? false;
  await cupo.exigirCupoDisponible({ estudianteId, pruebaId, correoVerificado, ahora: reloj() }, tx);
}

async function exigirDisponibilidad(
  dependencias: DependenciasPracticas,
  filtros: FiltrosSeleccion,
  cantidad: number,
  tx: Ejecutor,
): Promise<void> {
  const disponibles = await dependencias.seleccion.contarDisponibles(filtros, tx);
  if (disponibles < cantidad)
    throw sinPreguntas(
      disponibles,
      cantidad,
      await opcionesInsuficiencia(dependencias, filtros, cantidad, tx),
    );
}

async function iniciar(
  dependencias: DependenciasPracticas,
  estudianteId: string,
  datos: DatosInicioPractica,
) {
  const { repositorio, unidadDeTrabajo } = dependencias;
  return unidadDeTrabajo.enTransaccion(async (tx) => {
    const { anioEgreso, abierta } = await perfilParaInicio(
      dependencias,
      estudianteId,
      datos.pruebaId,
      tx,
    );
    const estructura = await estructuraParaInicio(repositorio, datos, tx);
    const contexto = await repositorio.leerContextoInicio(anioEgreso, tx);
    const dificultad = await validarAlcanceYDificultad(dependencias, datos, contexto, tx);
    // Antes de comprobar el banco y de cerrar la práctica abierta: sin cupo no se cierra nada.
    if (estructura.consumeCupo) await exigirCupo(dependencias, estudianteId, datos.pruebaId, tx);
    const filtros = filtrosDe({ estudianteId, datos, contexto, ...(dificultad && { dificultad }) });
    await exigirDisponibilidad(dependencias, filtros, datos.cantidad, tx);
    if (abierta) await repositorio.cerrarAbandonada(abierta.id, tx);
    const practica = await repositorio.crear(
      {
        estudianteId,
        pruebaId: datos.pruebaId,
        estructuraId: estructura.id,
        ...(datos.ejeId !== undefined && { ejeId: datos.ejeId }),
        ...(datos.contenidoId !== undefined && { contenidoId: datos.contenidoId }),
        ...(datos.habilidadId !== undefined && { habilidadId: datos.habilidadId }),
        ...(datos.dificultadId !== undefined && { dificultadId: datos.dificultadId }),
        cantidad: datos.cantidad,
        iniciadaEn: contexto.iniciadaEn,
      },
      tx,
    );
    return {
      id: practica.id,
      pruebaId: practica.pruebaId,
      ejeId: practica.ejeId,
      contenidoId: practica.contenidoId,
      habilidadId: practica.habilidadId,
      dificultadId: practica.dificultadId,
      dificultad: practica.dificultad ?? 'mezcla',
      cantidad: practica.cantidad,
      entregadas: 0,
    };
  });
}

async function siguiente(dependencias: DependenciasPracticas, estudianteId: string, id: string) {
  const { repositorio, unidadDeTrabajo, seleccion } = dependencias;
  return unidadDeTrabajo.enTransaccion(async (tx) => {
    const practica = await repositorio.leerPractica(id, estudianteId, tx);
    if (!practica) throw evaluacionNoEncontrada();
    if (practica.cerradaEn) throw evaluacionCerrada();
    const entregas = await repositorio.leerEntregas(id, tx);
    const ultima = entregas.at(-1);
    if (ultima?.respondidaEn === null)
      return mostrarItem({
        repositorio,
        itemId: ultima.id,
        estudianteId,
        total: practica.cantidad,
        tx,
      });
    if (entregas.length >= practica.cantidad) throw practicaCompleta();
    if (practica.consumeCupo) await exigirCupo(dependencias, estudianteId, practica.pruebaId, tx);
    const filtros: FiltrosSeleccion = {
      estudianteId,
      pruebaId: practica.pruebaId,
      ...alcanceDe(practica),
      nivelEscolarId: practica.nivelEscolarId,
      iniciadaEn: practica.iniciadaEn,
      entregadas: entregas.map(({ preguntaId, version }) => ({ preguntaId, version })),
    };
    const pregunta = await seleccion.elegirSiguiente(
      { ...filtros, cantidad: practica.cantidad },
      tx,
    );
    if (!pregunta) {
      const disponibles = await seleccion.contarDisponibles(filtros, tx);
      throw sinPreguntas(disponibles, practica.cantidad - entregas.length, []);
    }
    const itemId = await repositorio.insertarEntrega(practica, pregunta, entregas.length + 1, tx);
    return mostrarItem({ repositorio, itemId, estudianteId, total: practica.cantidad, tx });
  });
}

async function mostrarItem({
  repositorio,
  itemId,
  estudianteId,
  total,
  tx,
}: {
  repositorio: PracticasRepositorio;
  itemId: string;
  estudianteId: string;
  total: number;
  tx: Ejecutor;
}) {
  const item = await repositorio.leerItemVisible(itemId, estudianteId, tx);
  if (!item) throw new Error('El ítem pendiente no apareció en la vista de entrega.');
  return {
    id: item.id,
    orden: item.orden,
    total,
    enunciado: item.enunciado,
    texto:
      item.textoTitulo || item.textoContenido || item.textoImagen
        ? { titulo: item.textoTitulo, contenido: item.textoContenido, imagen: item.textoImagen }
        : null,
    alternativas: item.alternativas.map(({ id, letra, texto }) => ({ id, letra, texto })),
  };
}

export function crearPracticasServicio(dependencias: DependenciasPracticas) {
  return {
    iniciarPractica: (estudianteId: string, datos: DatosInicioPractica) =>
      iniciar(dependencias, estudianteId, datos),
    siguientePregunta: (estudianteId: string, id: string) =>
      siguiente(dependencias, estudianteId, id),
  };
}

export type PracticasServicio = ReturnType<typeof crearPracticasServicio>;
