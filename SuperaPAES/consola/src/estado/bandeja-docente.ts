// La bandeja de un docente con su formulario, común a Mis revisiones (D01, HU-22) y Desempates (D02,
// HU-23): la bandeja, la asignación que abre (la primera si no eligió otra) y su formulario. Al
// entregarla, sale de la bandeja, se abre la siguiente y la bandeja se vuelve a pedir (por si le
// asignaron otras). Mientras se guarda no se abre otra. Cancela las cargas al cambiar o al desmontar.
// Cada sección pone sus llamadas a la API, su validación y su aviso (revision-docente.ts y
// desempate-docente.ts).
import { type FormEvent, useEffect, useState } from 'react';
import type { RevisionPendiente } from '../tipos';
import {
  type CamposRevision,
  camposVacios,
  type ErroresRevision,
  erroresDeApi,
  type RespuestaCriterio,
} from './formulario-revision';
import { mensajeDeError } from './usuarios-internos';

type Fallida = { tipo: 'fallida'; codigo: string; mensaje: string };

export type CargaBandeja =
  { tipo: 'cargando' } | { tipo: 'lista'; revisiones: RevisionPendiente[] } | Fallida;

export type CargaAsignacion<P> =
  { tipo: 'ninguna' } | { tipo: 'cargando' } | { tipo: 'lista'; pregunta: P } | Fallida;

/** Lo propio de cada bandeja: sus llamadas a la API, su validación y el aviso al entregar. */
export interface ApiDeBandeja<P extends RevisionPendiente> {
  listar: (senal: AbortSignal) => Promise<RevisionPendiente[]>;
  obtener: (id: number, senal: AbortSignal) => Promise<P>;
  validar: (campos: CamposRevision, pregunta: P) => ErroresRevision;
  entregar: (campos: CamposRevision, pregunta: P) => Promise<unknown>;
  aviso: (pregunta: P) => string;
}

/**
 * La bandeja, que se pide al abrir la sección y otra vez en cada `vuelta` (sin volver a «cargando»:
 * se sigue viendo la anterior); `quitar` saca al tiro una asignación ya entregada.
 */
function useBandeja(listar: ApiDeBandeja<RevisionPendiente>['listar'], vuelta: number) {
  const [carga, setCarga] = useState<CargaBandeja>({ tipo: 'cargando' });
  useEffect(() => {
    const control = new AbortController();
    listar(control.signal).then(
      (revisiones) => setCarga({ tipo: 'lista', revisiones }),
      (error: unknown) => {
        if (!control.signal.aborted) setCarga({ tipo: 'fallida', ...mensajeDeError(error) });
      },
    );
    return () => control.abort();
  }, [listar, vuelta]);
  const quitar = (id: number) =>
    setCarga((actual) =>
      actual.tipo === 'lista'
        ? { tipo: 'lista', revisiones: actual.revisiones.filter((r) => r.id !== id) }
        : actual,
    );
  return { carga, quitar };
}

/** La pregunta de la asignación abierta; mientras llega la de otra, está cargando. */
function usePregunta<P>(
  obtener: (id: number, senal: AbortSignal) => Promise<P>,
  id: number | null,
): CargaAsignacion<P> {
  const [resultado, setResultado] = useState<{ id: number; carga: CargaAsignacion<P> } | null>(
    null,
  );
  useEffect(() => {
    if (id === null) return undefined;
    const control = new AbortController();
    obtener(id, control.signal).then(
      (pregunta) => setResultado({ id, carga: { tipo: 'lista', pregunta } }),
      (error: unknown) => {
        if (!control.signal.aborted) {
          setResultado({ id, carga: { tipo: 'fallida', ...mensajeDeError(error) } });
        }
      },
    );
    return () => control.abort();
  }, [obtener, id]);
  if (id === null) return { tipo: 'ninguna' };
  return resultado?.id === id ? resultado.carga : { tipo: 'cargando' };
}

/** Los campos, si ya intentó entregar y los errores de la API; todo se limpia al abrir otra. */
function useFormulario(id: number | null) {
  const [campos, setCampos] = useState<CamposRevision>(camposVacios);
  const [intentado, setIntentado] = useState(false);
  const [erroresApi, setErroresApi] = useState<ErroresRevision>({});
  const [deLaAsignacion, setDeLaAsignacion] = useState(id);
  if (id !== deLaAsignacion) {
    setDeLaAsignacion(id);
    setCampos(camposVacios());
    setIntentado(false);
    setErroresApi({});
  }
  const cambiarCriterio = (codigo: string, cambio: Partial<RespuestaCriterio>) =>
    setCampos((actual) => {
      const previa = actual.criterios[codigo] ?? { cumple: null, observacion: '' };
      return { ...actual, criterios: { ...actual.criterios, [codigo]: { ...previa, ...cambio } } };
    });
  const acciones = {
    responder: (codigo: string, cumple: boolean) => cambiarCriterio(codigo, { cumple }),
    observar: (codigo: string, observacion: string) => cambiarCriterio(codigo, { observacion }),
    elegirDificultad: (dificultad: string) => setCampos((actual) => ({ ...actual, dificultad })),
    elegirDecision: (decision: string) => setCampos((actual) => ({ ...actual, decision })),
    escribirMotivo: (comentario: string) => setCampos((actual) => ({ ...actual, comentario })),
  };
  return { campos, intentado, setIntentado, erroresApi, setErroresApi, acciones };
}

/** La bandeja y la asignación abierta: la que eligió el docente o, si no eligió, la primera. */
function useAbierta<P extends RevisionPendiente>(api: ApiDeBandeja<P>, inicial: number | null) {
  const [vuelta, setVuelta] = useState(0);
  const { carga: bandeja, quitar } = useBandeja(api.listar, vuelta);
  const [elegida, setElegida] = useState<number | null>(inicial);
  const primera = bandeja.tipo === 'lista' ? (bandeja.revisiones[0]?.id ?? null) : null;
  const abierta = elegida ?? primera;
  /** Después de entregar: la saca de la bandeja, abre la primera que quede y pide la bandeja otra vez. */
  const entregada = (id: number) => {
    quitar(id);
    setElegida((actual) => (actual === id ? null : actual));
    setVuelta((actual) => actual + 1);
  };
  const revision = usePregunta(api.obtener, abierta);
  return { bandeja, abierta, revision, elegir: setElegida, entregada };
}

/**
 * La bandeja del docente con la asignación abierta y su formulario. `api` debe ser una constante.
 * `inicial` abre esa asignación al entrar (D03 lleva a D01 con «Revisar con la pauta»).
 */
export function useBandejaDocente<P extends RevisionPendiente>(
  api: ApiDeBandeja<P>,
  inicial: number | null = null,
) {
  const { bandeja, abierta, revision, elegir, entregada } = useAbierta(api, inicial);
  const formulario = useFormulario(abierta);
  const { campos, setIntentado, setErroresApi } = formulario;
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const pregunta = revision.tipo === 'lista' ? revision.pregunta : null;
  const errores: ErroresRevision = {
    ...(formulario.intentado && pregunta ? api.validar(campos, pregunta) : {}),
    ...formulario.erroresApi,
  };

  const entregar = (evento: FormEvent) => {
    evento.preventDefault();
    setIntentado(true);
    setAviso(null);
    if (!pregunta || enviando) return;
    if (Object.keys(api.validar(campos, pregunta)).length > 0) return;
    setEnviando(true);
    api
      .entregar(campos, pregunta)
      .then(
        () => {
          setAviso(api.aviso(pregunta));
          entregada(pregunta.id);
        },
        (error: unknown) => setErroresApi(erroresDeApi(error)),
      )
      .finally(() => setEnviando(false));
  };

  return {
    bandeja,
    abierta,
    revision,
    campos,
    errores,
    enviando,
    aviso,
    /** Abre otra, salvo mientras se guarda la abierta (su respuesta es de esa asignación). */
    elegir: (id: number) => {
      if (!enviando) elegir(id);
    },
    entregar,
    ...formulario.acciones,
  };
}

/** El estado de la bandeja de un docente (D01 o D02), con la asignación abierta de tipo P. */
export type EstadoBandejaDocente<P extends RevisionPendiente> = ReturnType<
  typeof useBandejaDocente<P>
>;
