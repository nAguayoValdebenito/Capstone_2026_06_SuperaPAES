// La pregunta nueva de una práctica o de un repaso (HU-31.2 y HU-39.1): el repaso entrega una fallada y la
// práctica, la que elige la selección dentro de lo que el estudiante eligió practicar.
import type { Ejecutor } from '../../db/transaccion.js';
import { sinPreguntas } from './evaluaciones.errores.js';
import type { EntregaGuardada, PracticaGuardada } from './evaluaciones.practicas.repositorio.js';
import type { EleccionFallada } from './evaluaciones.repaso.servicio.js';
import type { SeleccionPractica } from './evaluaciones.seleccion.servicio.js';
import type { FiltrosSeleccion, PreguntaSeleccionada } from './evaluaciones.seleccion.tipos.js';

export interface DependenciasEleccion {
  seleccion: SeleccionPractica;
  elegirFallada: EleccionFallada;
}

export interface EstadoEntrega {
  estudianteId: string;
  practica: PracticaGuardada;
  entregas: EntregaGuardada[];
}

function alcanceDe(practica: PracticaGuardada): Partial<FiltrosSeleccion> {
  return {
    ...(practica.ejeId !== null && { ejeId: practica.ejeId }),
    ...(practica.contenidoId !== null && { contenidoId: practica.contenidoId }),
    ...(practica.habilidadId !== null && { habilidadId: practica.habilidadId }),
    ...(practica.dificultad !== null && { dificultad: practica.dificultad }),
  };
}

export async function elegirNueva(
  { seleccion, elegirFallada }: DependenciasEleccion,
  { estudianteId, practica, entregas }: EstadoEntrega,
  tx: Ejecutor,
): Promise<PreguntaSeleccionada> {
  const faltan = practica.cantidad - entregas.length;
  if (practica.esRepaso) {
    const entregadas = entregas.map(({ preguntaId }) => preguntaId);
    const fallada = await elegirFallada(estudianteId, practica, entregadas, tx);
    if (!fallada) throw sinPreguntas(0, faltan, []);
    return fallada;
  }
  const filtros: FiltrosSeleccion = {
    estudianteId,
    pruebaId: practica.pruebaId,
    ...alcanceDe(practica),
    nivelEscolarId: practica.nivelEscolarId,
    iniciadaEn: practica.iniciadaEn,
    entregadas: entregas.map(({ preguntaId, version }) => ({ preguntaId, version })),
  };
  const pregunta = await seleccion.elegirSiguiente({ ...filtros, cantidad: practica.cantidad }, tx);
  if (pregunta) return pregunta;
  throw sinPreguntas(await seleccion.contarDisponibles(filtros, tx), faltan, []);
}
