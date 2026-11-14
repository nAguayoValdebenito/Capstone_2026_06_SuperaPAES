// Calibración de la dificultad (D04, HU-26 y HU-53, RN-15). Para el docente: su bandeja, la confirmación
// antes de decidir (Escape la cierra) y el aviso del resultado; cada decisión vuelve a cargar la bandeja.
// Para el administrador, en el banco (C02): las confirmadas y las estadísticas de las preguntas de la
// página. Aquí también se arma el texto del acierto con su rango, que la pantalla muestra siempre junto a
// la barra.
import { useCallback, useRef, useState } from 'react';
import { estadisticasDePreguntas } from '../servicios/evaluaciones';
import { decidirCalibracion, listarCalibracion, listarConfirmadas } from '../servicios/revision';
import type {
  ConfirmadaCalibracion,
  DificultadConRango,
  EstadisticaPregunta,
  ItemCalibracion,
} from '../tipos/calibracion';
import { useCarga, type Carga } from './carga';
import { mensajeDeError } from './usuarios-internos';

const numero = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });

/** «28 %», con coma decimal. */
export const porcentaje = (valor: number): string => `${numero.format(valor)} %`;

/** El rango esperado de la dificultad: «40–70 %». */
export const rangoEsperado = ({ aciertoEsperadoMin, aciertoEsperadoMax }: DificultadConRango) =>
  `${String(aciertoEsperadoMin)}–${String(aciertoEsperadoMax)} %`;

/** Dónde cae el acierto respecto del rango: el estado se dice con texto, no solo con color. */
export function posicionEnRango(acierto: number, dificultad: DificultadConRango): string {
  if (acierto < dificultad.aciertoEsperadoMin) return 'bajo el rango';
  if (acierto > dificultad.aciertoEsperadoMax) return 'sobre el rango';
  return 'dentro del rango';
}

/** «28 % · esperado 40–70 %, bajo el rango»; sin intentos, «Sin respuestas». */
export function textoDeAcierto(acierto: number | null, dificultad: DificultadConRango): string {
  if (acierto === null) return 'Sin respuestas';
  return `${porcentaje(acierto)} · esperado ${rangoEsperado(dificultad)}, ${posicionEnRango(acierto, dificultad)}`;
}

/** Tiempo promedio por respuesta: «55 s» o «2 min 5 s»; sin dato, «—». */
export function textoDeTiempo(segundos: number | null): string {
  if (segundos === null) return '—';
  if (segundos < 60) return `${String(segundos)} s`;
  const resto = segundos % 60;
  return `${String(Math.floor(segundos / 60))} min${resto ? ` ${String(resto)} s` : ''}`;
}

/** Intentos, acierto y tiempo de una pregunta del banco (HU-53): «40 intentos · 28 % · 55 s». */
export function textoDeEstadistica(estadistica: EstadisticaPregunta | undefined): string {
  if (!estadistica || estadistica.intentos === 0) return 'Sin respuestas';
  const intentos = `${String(estadistica.intentos)} ${estadistica.intentos === 1 ? 'intento' : 'intentos'}`;
  const acierto =
    estadistica.porcentajeAcierto === null ? '' : ` · ${porcentaje(estadistica.porcentajeAcierto)}`;
  const tiempo =
    estadistica.tiempoPromedioSeg === null
      ? ''
      : ` · ${textoDeTiempo(estadistica.tiempoPromedioSeg)}`;
  return `${intentos}${acierto}${tiempo}`;
}

/** «1 docente confirmó · 2 la descartaron», o null si nadie decidió aún. */
export function textoDeDecisiones({
  confirmaciones,
  descartes,
}: Pick<ItemCalibracion, 'confirmaciones' | 'descartes'>): string | null {
  const partes = [
    confirmaciones > 0 &&
      `${String(confirmaciones)} ${confirmaciones === 1 ? 'docente confirmó' : 'docentes confirmaron'}`,
    descartes > 0 && `${String(descartes)} ${descartes === 1 ? 'la descartó' : 'la descartaron'}`,
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(' · ') : null;
}

/** Lo que pregunta la confirmación antes de guardar la decisión. */
export function textoDeConfirmacion(dificultadCorresponde: boolean, item: ItemCalibracion): string {
  return dificultadCorresponde
    ? `La pregunta P-${item.preguntaId} saldrá de tu bandeja. La dificultad ${item.dificultad.nombre.toLowerCase()} se mantiene.`
    : `El administrador verá que la dificultad ${item.dificultad.nombre.toLowerCase()} de P-${item.preguntaId} no corresponde y podrá retirarla para una nueva revisión con dos docentes.`;
}

export function textoDeResultado(dificultadCorresponde: boolean, preguntaId: string): string {
  return dificultadCorresponde
    ? `Descartaste P-${preguntaId}: la dificultad se mantiene.`
    : `Confirmaste que la dificultad de P-${preguntaId} no corresponde. Quedó para el administrador.`;
}

/** Escape cierra la confirmación sin enviar nada. */
export function alPresionarTecla(tecla: string, cancelar: () => void): void {
  if (tecla === 'Escape') cancelar();
}

export interface MensajeCalibracion {
  tipo: 'exito' | 'error';
  texto: string;
}

/** La decisión que espera confirmación. */
export interface DecisionPendiente {
  item: ItemCalibracion;
  dificultadCorresponde: boolean;
}

const cargarBandeja = (senal: AbortSignal) => listarCalibracion(senal);

/** D04 (docente): la bandeja, la decisión por confirmar y su resultado. */
export function useCalibracion() {
  const [version, setVersion] = useState(0);
  const carga: Carga<ItemCalibracion[]> = useCarga(cargarBandeja, version);
  const [pendiente, setPendiente] = useState<DecisionPendiente | null>(null);
  const [mensaje, setMensaje] = useState<MensajeCalibracion | null>(null);
  const [enCurso, setEnCurso] = useState(false);
  const ocupado = useRef(false);
  const recargar = () => setVersion((v) => v + 1);
  const confirmar = async () => {
    if (!pendiente || ocupado.current) return;
    const { item, dificultadCorresponde } = pendiente;
    ocupado.current = true;
    setEnCurso(true);
    try {
      await decidirCalibracion(item.preguntaId, dificultadCorresponde);
      setMensaje({
        tipo: 'exito',
        texto: textoDeResultado(dificultadCorresponde, item.preguntaId),
      });
      setPendiente(null);
    } catch (error) {
      setMensaje({ tipo: 'error', texto: mensajeDeError(error).mensaje });
    } finally {
      ocupado.current = false;
      setEnCurso(false);
      recargar();
    }
  };
  return {
    carga,
    reintentar: recargar,
    pendiente,
    abrir: (item: ItemCalibracion, dificultadCorresponde: boolean) => {
      setMensaje(null);
      setPendiente({ item, dificultadCorresponde });
    },
    cancelar: () => setPendiente(null),
    confirmar,
    mensaje,
    enCurso,
  };
}

export type EstadoCalibracion = ReturnType<typeof useCalibracion>;

/** C02 (administrador): las confirmadas; `version` cambia cuando el banco vuelve a cargar. */
export function useConfirmadas(version: number): Carga<ConfirmadaCalibracion[]> {
  return useCarga(listarConfirmadas, version);
}

/** C02: las estadísticas de las preguntas de la página, por id. Si fallan, la tabla dice «Sin datos». */
export function useEstadisticasDelBanco(ids: readonly number[]): Map<string, EstadisticaPregunta> {
  const clave = ids.join(',');
  const cargar = useCallback(
    (senal: AbortSignal) =>
      estadisticasDePreguntas(clave ? clave.split(',').map(Number) : [], senal),
    [clave],
  );
  const carga = useCarga(cargar);
  return new Map(carga.tipo === 'lista' ? carga.datos.map((e) => [e.preguntaId, e]) : []);
}
