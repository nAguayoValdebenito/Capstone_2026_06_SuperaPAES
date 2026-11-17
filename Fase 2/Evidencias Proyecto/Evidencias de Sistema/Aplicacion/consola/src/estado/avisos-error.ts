// Avisos de error (C13, HU-50): la bandeja con sus filtros y su página, la pregunta elegida, el cierre de
// un aviso (resuelto o descartado) y la anulación de la pregunta, que pide antes cuántas evaluaciones se
// recalcularán. Cada acción vuelve a cargar la bandeja y deja un mensaje para el lector de pantalla.
import { useCallback, useRef, useState } from 'react';
import { impactoDeAnular } from '../servicios/evaluaciones';
import { anularPregunta, cerrarAviso, listarAvisos } from '../servicios/preguntas';
import { consultarListasOpciones } from '../servicios/temario';
import type {
  AvisoDeError,
  CierreAviso,
  EstadoFiltroAviso,
  FiltrosAvisos,
  PaginaDeAvisos,
  PreguntaAnulada,
  PreguntaConAvisos,
} from '../tipos/avisos-error';
import type { OpcionSelector } from '../utilidades/opciones';
import { useCarga, type Carga } from './carga';
import { mensajeDeError } from './usuarios-internos';

export const ESTADOS_FILTRO: readonly OpcionSelector[] = [
  { valor: 'pendiente', texto: 'Pendientes' },
  { valor: 'resuelto', texto: 'Resueltos' },
  { valor: 'descartado', texto: 'Descartados' },
  { valor: 'todos', texto: 'Todos' },
];

const FILTROS_INICIALES: FiltrosAvisos = { estado: 'pendiente', motivo: '' };

export interface MensajeAccion {
  tipo: 'exito' | 'error';
  texto: string;
}

/** La pregunta elegida en la bandeja; si no hay elección o ya no está, la primera. */
export function grupoElegido(
  grupos: readonly PreguntaConAvisos[],
  elegida: number | null,
): PreguntaConAvisos | null {
  return grupos.find((g) => g.pregunta.id === elegida) ?? grupos[0] ?? null;
}

/** Solo se anula una pregunta publicada (DAS, glosario; HU-50 esc. 3). */
export const sePuedeAnular = (grupo: PreguntaConAvisos): boolean =>
  grupo.pregunta.estado.codigo === 'publicada';

export const avisoPendiente = (aviso: AvisoDeError): boolean => aviso.estado.codigo === 'pendiente';

export function textoDeCierre(estado: CierreAviso): string {
  return estado === 'resuelto'
    ? 'Aviso resuelto. Quedó en la auditoría.'
    : 'Aviso descartado. Quedó en la auditoría.';
}

export function textoDeAnulacion({ evaluacionesRecalculadas, avisosCerrados }: PreguntaAnulada) {
  const evaluaciones = evaluacionesRecalculadas === 1 ? 'evaluación' : 'evaluaciones';
  const avisos = avisosCerrados === 1 ? 'aviso' : 'avisos';
  return (
    `Pregunta anulada: ya no se entrega. Se recalcularon ${String(evaluacionesRecalculadas)} ` +
    `${evaluaciones} y se resolvieron ${String(avisosCerrados)} ${avisos}.`
  );
}

/** El texto de la confirmación según lo que pudo contar la API antes de anular. */
export function textoDeImpacto(carga: Carga<{ evaluacionesCerradas: number }>): string {
  if (carga.tipo === 'cargando') return 'Contando las evaluaciones afectadas…';
  if (carga.tipo === 'fallida') return 'No se pudo contar las evaluaciones afectadas.';
  const n = carga.datos.evaluacionesCerradas;
  if (n === 0) return 'Por ahora no aparece en ninguna evaluación cerrada.';
  return `Se recalcularán ${String(n)} ${n === 1 ? 'evaluación cerrada' : 'evaluaciones cerradas'}.`;
}

/** Escape cierra la confirmación sin enviar nada. */
export function alPresionarTecla(tecla: string, cancelar: () => void): void {
  if (tecla === 'Escape') cancelar();
}

const cargarMotivos = async (senal: AbortSignal) =>
  (await consultarListasOpciones(senal)).motivosAviso;

function useAccion(recargar: () => void) {
  const [mensaje, setMensaje] = useState<MensajeAccion | null>(null);
  const [enCurso, setEnCurso] = useState(false);
  const ocupado = useRef(false);
  const ejecutar = async <T>(accion: () => Promise<T>, exito: (r: T) => string) => {
    if (ocupado.current) return false;
    ocupado.current = true;
    setEnCurso(true);
    setMensaje(null);
    try {
      setMensaje({ tipo: 'exito', texto: exito(await accion()) });
      return true;
    } catch (error) {
      setMensaje({ tipo: 'error', texto: mensajeDeError(error).mensaje });
      return false;
    } finally {
      ocupado.current = false;
      setEnCurso(false);
      recargar();
    }
  };
  return { mensaje, enCurso, ejecutar };
}

function useAnulacion() {
  const [preguntaId, setPreguntaId] = useState<number | null>(null);
  const cargar = useCallback(
    (senal: AbortSignal) => impactoDeAnular(preguntaId ?? 0, senal),
    [preguntaId],
  );
  const impacto = useCarga(preguntaId === null ? null : cargar);
  return { preguntaId, abrir: setPreguntaId, cerrar: () => setPreguntaId(null), impacto };
}

export function useAvisosError() {
  const [filtros, setFiltros] = useState<FiltrosAvisos>(FILTROS_INICIALES);
  const [pagina, setPagina] = useState(1);
  const [version, setVersion] = useState(0);
  const [elegida, setElegida] = useState<number | null>(null);
  const cargar = useCallback(
    (senal: AbortSignal) => listarAvisos(filtros, pagina, senal),
    [filtros, pagina],
  );
  const carga: Carga<PaginaDeAvisos> = useCarga(cargar, version);
  const motivos = useCarga(cargarMotivos);
  const recargar = () => setVersion((v) => v + 1);
  const { mensaje, enCurso, ejecutar } = useAccion(recargar);
  const anulacion = useAnulacion();
  const cambiarFiltro = (campo: keyof FiltrosAvisos, valor: string) => {
    setFiltros((actual) =>
      campo === 'estado'
        ? { ...actual, estado: (valor || 'pendiente') as EstadoFiltroAviso }
        : { ...actual, motivo: valor },
    );
    setPagina(1);
    setElegida(null);
  };
  const cerrar = (aviso: AvisoDeError, estado: CierreAviso) =>
    ejecutar(
      () => cerrarAviso(aviso.id, estado),
      () => textoDeCierre(estado),
    );
  const confirmarAnulacion = async () => {
    const id = anulacion.preguntaId;
    if (id === null) return;
    if (await ejecutar(() => anularPregunta(id), textoDeAnulacion)) anulacion.cerrar();
  };
  return {
    filtros,
    cambiarFiltro,
    carga,
    motivos,
    pagina,
    setPagina,
    elegida,
    elegir: setElegida,
    reintentar: recargar,
    mensaje,
    enCurso,
    cerrar,
    anulacion: { ...anulacion, confirmar: confirmarAnulacion },
  };
}

export type EstadoAvisosError = ReturnType<typeof useAvisosError>;
