// Mis revisiones (D01, HU-22.2 y HU-22.3, CU-19): la bandeja del docente revisor, la pregunta que
// abre (la primera de la bandeja si no eligió otra) y el formulario de su revisión. Al entregarla, sale
// de la bandeja y se abre la siguiente. Cancela las cargas al cambiar o al desmontar.
import { type FormEvent, useEffect, useState } from 'react';
import { entregarRevision, listarMisRevisiones, obtenerMiRevision } from '../servicios/revision';
import type { PreguntaARevisar, RevisionPendiente } from '../tipos';
import {
  armarRevision,
  type CamposRevision,
  camposVacios,
  type ErroresRevision,
  erroresDeApi,
  type RespuestaCriterio,
  validarRevision,
} from './formulario-revision';
import { mensajeDeError } from './usuarios-internos';

type Fallida = { tipo: 'fallida'; codigo: string; mensaje: string };

export type CargaBandeja =
  { tipo: 'cargando' } | { tipo: 'lista'; revisiones: RevisionPendiente[] } | Fallida;

export type CargaRevision =
  | { tipo: 'ninguna' }
  | { tipo: 'cargando' }
  | { tipo: 'lista'; pregunta: PreguntaARevisar }
  | Fallida;

/** La bandeja, que se pide al abrir la sección; `quitar` saca una revisión ya entregada. */
function useBandeja() {
  const [carga, setCarga] = useState<CargaBandeja>({ tipo: 'cargando' });
  useEffect(() => {
    const control = new AbortController();
    listarMisRevisiones(control.signal).then(
      (revisiones) => setCarga({ tipo: 'lista', revisiones }),
      (error: unknown) => {
        if (!control.signal.aborted) setCarga({ tipo: 'fallida', ...mensajeDeError(error) });
      },
    );
    return () => control.abort();
  }, []);
  const quitar = (id: number) =>
    setCarga((actual) =>
      actual.tipo === 'lista'
        ? { tipo: 'lista', revisiones: actual.revisiones.filter((r) => r.id !== id) }
        : actual,
    );
  return { carga, quitar };
}

/** La pregunta de la revisión abierta; mientras llega la de otra revisión, está cargando. */
function usePregunta(id: number | null): CargaRevision {
  const [resultado, setResultado] = useState<{ id: number; carga: CargaRevision } | null>(null);
  useEffect(() => {
    if (id === null) return undefined;
    const control = new AbortController();
    obtenerMiRevision(id, control.signal).then(
      (pregunta) => setResultado({ id, carga: { tipo: 'lista', pregunta } }),
      (error: unknown) => {
        if (!control.signal.aborted) {
          setResultado({ id, carga: { tipo: 'fallida', ...mensajeDeError(error) } });
        }
      },
    );
    return () => control.abort();
  }, [id]);
  if (id === null) return { tipo: 'ninguna' };
  return resultado?.id === id ? resultado.carga : { tipo: 'cargando' };
}

/** Los campos, si ya intentó entregar y los errores de la API; todo se limpia al abrir otra revisión. */
function useFormulario(id: number | null) {
  const [campos, setCampos] = useState<CamposRevision>(camposVacios);
  const [intentado, setIntentado] = useState(false);
  const [erroresApi, setErroresApi] = useState<ErroresRevision>({});
  const [deLaRevision, setDeLaRevision] = useState(id);
  if (id !== deLaRevision) {
    setDeLaRevision(id);
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

/** La bandeja y la revisión abierta: la que eligió el docente o, si no eligió, la primera. */
function useAbierta() {
  const { carga: bandeja, quitar } = useBandeja();
  const [elegida, setElegida] = useState<number | null>(null);
  const primera = bandeja.tipo === 'lista' ? (bandeja.revisiones[0]?.id ?? null) : null;
  const abierta = elegida ?? primera;
  /** Después de entregar: la saca de la bandeja y abre la primera que quede. */
  const entregada = (id: number) => {
    quitar(id);
    setElegida(null);
  };
  return { bandeja, abierta, revision: usePregunta(abierta), elegir: setElegida, entregada };
}

export function useRevisionDocente() {
  const { bandeja, abierta, revision, elegir, entregada } = useAbierta();
  const formulario = useFormulario(abierta);
  const { campos, setIntentado, setErroresApi } = formulario;
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const pregunta = revision.tipo === 'lista' ? revision.pregunta : null;
  const errores: ErroresRevision = {
    ...(formulario.intentado && pregunta ? validarRevision(campos, pregunta) : {}),
    ...formulario.erroresApi,
  };

  const entregar = (evento: FormEvent) => {
    evento.preventDefault();
    setIntentado(true);
    setAviso(null);
    if (!pregunta || enviando) return;
    if (Object.keys(validarRevision(campos, pregunta)).length > 0) return;
    setEnviando(true);
    entregarRevision(pregunta.id, armarRevision(campos, pregunta.pauta))
      .then(
        () => {
          setAviso(`Revisión de la pregunta ${String(pregunta.preguntaId)} entregada.`);
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
    elegir,
    entregar,
    ...formulario.acciones,
  };
}

export type RevisionDocente = ReturnType<typeof useRevisionDocente>;
