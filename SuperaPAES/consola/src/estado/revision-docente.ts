// Mis revisiones (D01, HU-22.2 y HU-22.3, CU-19): la bandeja del docente revisor, la pregunta que
// abre (la primera de la bandeja si no eligió otra) y el formulario de su revisión. Al entregarla, la
// bandeja se vuelve a cargar y se abre la siguiente. Cancela las cargas al cambiar o al desmontar.
import { type FormEvent, useEffect, useState } from 'react';
import { entregarRevision, listarMisRevisiones, obtenerMiRevision } from '../servicios/revision';
import type { PreguntaARevisar, RevisionPendiente } from '../tipos';
import {
  armarRevision,
  type CamposRevision,
  camposVacios,
  type ErroresRevision,
  erroresDeApi,
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

function useBandeja(vuelta: number): CargaBandeja {
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
  }, [vuelta]);
  return carga;
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

/** Los campos del formulario; vuelven a quedar vacíos al abrir otra revisión. */
function useCampos(id: number | null) {
  const [campos, setCampos] = useState<CamposRevision>(camposVacios);
  const [deLaRevision, setDeLaRevision] = useState(id);
  if (id !== deLaRevision) {
    setDeLaRevision(id);
    setCampos(camposVacios());
  }
  const cambiar = (cambio: (actual: CamposRevision) => CamposRevision) => setCampos(cambio);
  const acciones = {
    responder: (codigo: string, cumple: boolean) =>
      cambiar((actual) => ({
        ...actual,
        criterios: {
          ...actual.criterios,
          [codigo]: { cumple, observacion: actual.criterios[codigo]?.observacion ?? '' },
        },
      })),
    observar: (codigo: string, observacion: string) =>
      cambiar((actual) => ({
        ...actual,
        criterios: { ...actual.criterios, [codigo]: { cumple: false, observacion } },
      })),
    elegirDificultad: (dificultad: string) => cambiar((actual) => ({ ...actual, dificultad })),
    elegirDecision: (decision: string) => cambiar((actual) => ({ ...actual, decision })),
    escribirMotivo: (comentario: string) => cambiar((actual) => ({ ...actual, comentario })),
  };
  return { campos, acciones };
}

/** La bandeja y la revisión abierta: la que eligió el docente o, si no eligió, la primera. */
function useAbierta() {
  const [vuelta, setVuelta] = useState(0);
  const bandeja = useBandeja(vuelta);
  const [elegida, setElegida] = useState<number | null>(null);
  const primera = bandeja.tipo === 'lista' ? (bandeja.revisiones[0]?.id ?? null) : null;
  const abierta = elegida ?? primera;
  const revision = usePregunta(abierta);
  /** Después de entregar: vuelve a pedir la bandeja y abre la primera que quede. */
  const recargar = () => {
    setElegida(null);
    setVuelta((actual) => actual + 1);
  };
  return { bandeja, abierta, revision, setElegida, recargar };
}

export function useRevisionDocente() {
  const { bandeja, abierta, revision, setElegida, recargar } = useAbierta();
  const { campos, acciones } = useCampos(abierta);
  const [intentado, setIntentado] = useState(false);
  const [erroresApi, setErroresApi] = useState<ErroresRevision>({});
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const pregunta = revision.tipo === 'lista' ? revision.pregunta : null;
  const errores: ErroresRevision = {
    ...(intentado && pregunta ? validarRevision(campos, pregunta) : {}),
    ...erroresApi,
  };

  const elegir = (id: number) => {
    setElegida(id);
    setIntentado(false);
    setErroresApi({});
  };

  const entregar = (evento: FormEvent) => {
    evento.preventDefault();
    setIntentado(true);
    setAviso(null);
    if (!pregunta || abierta === null || enviando) return;
    if (Object.keys(validarRevision(campos, pregunta)).length > 0) return;
    setEnviando(true);
    entregarRevision(abierta, armarRevision(campos, pregunta.pauta))
      .then(
        () => {
          setAviso(`Revisión de la pregunta ${String(pregunta.preguntaId)} entregada.`);
          setIntentado(false);
          setErroresApi({});
          recargar();
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
    ...acciones,
  };
}

export type RevisionDocente = ReturnType<typeof useRevisionDocente>;
