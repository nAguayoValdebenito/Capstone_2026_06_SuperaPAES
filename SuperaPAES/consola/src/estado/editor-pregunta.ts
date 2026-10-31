// Editor de una pregunta (C03, HU-12.3): carga las opciones (temario, dificultades y tipos de texto) y,
// al editar, la pregunta; aplica las reglas de formulario-pregunta.ts y guarda. Una pregunta nueva
// guardada abre su edición con el aviso «Guardada como borrador». Cancela las cargas al desmontar.
import { type FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  crearPregunta,
  editarPregunta,
  listarTextos,
  listarTiposDeTexto,
  obtenerFiltrosBanco,
  obtenerPregunta,
} from '../servicios/preguntas';
import type {
  Letra,
  Opcion,
  OpcionesFiltrosBanco,
  PreguntaParaEditar,
  TextoDeLectura,
} from '../tipos';
import {
  armarDatos,
  type CamposAlternativa,
  type CamposPregunta,
  type CamposTexto,
  camposDePregunta,
  camposVacios,
  cambiarCantidad,
  conPrueba,
  type ErroresPregunta,
  erroresDeApi,
  pruebaDe,
  validarCampos,
} from './formulario-pregunta';
import { mensajeDeError } from './usuarios-internos';

export type CargaEditor =
  | { tipo: 'cargando' }
  | {
      tipo: 'lista';
      opciones: OpcionesFiltrosBanco;
      tiposTexto: Opcion[];
      pregunta: PreguntaParaEditar | null;
    }
  | { tipo: 'fallida'; codigo: string; mensaje: string };

/** Aviso que deja la página anterior al navegar (por ejemplo, «Guardada como borrador.»). */
export const AVISO_BORRADOR = 'Guardada como borrador.';

function useCargaEditor(id: number | null): CargaEditor {
  const [carga, setCarga] = useState<CargaEditor>({ tipo: 'cargando' });
  useEffect(() => {
    const control = new AbortController();
    const { signal } = control;
    Promise.all([
      obtenerFiltrosBanco(signal),
      listarTiposDeTexto(signal),
      id === null ? Promise.resolve(null) : obtenerPregunta(id, signal),
    ]).then(
      ([opciones, tiposTexto, pregunta]) =>
        setCarga({ tipo: 'lista', opciones, tiposTexto, pregunta }),
      (error: unknown) => {
        if (!signal.aborted) setCarga({ tipo: 'fallida', ...mensajeDeError(error) });
      },
    );
    return () => control.abort();
  }, [id]);
  return carga;
}

/** Textos de lectura guardados que coinciden con la búsqueda por título (solo si se usan). */
export function useTextosGuardados(buscar: string, activo: boolean) {
  const [textos, setTextos] = useState<TextoDeLectura[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!activo) return undefined;
    const control = new AbortController();
    listarTextos(buscar, control.signal).then(
      (lista) => {
        setTextos(lista);
        setError(null);
      },
      (falla: unknown) => {
        if (!control.signal.aborted) setError(mensajeDeError(falla).mensaje);
      },
    );
    return () => control.abort();
  }, [buscar, activo]);
  return { textos, error };
}

/** Acciones sobre los campos; ninguna toca la API. `alCambiar` se avisa en cada cambio. */
function useCampos(carga: CargaEditor, alCambiar: () => void) {
  const [campos, setCampos] = useState<CamposPregunta>(camposVacios);
  const pruebas = carga.tipo === 'lista' ? carga.opciones.pruebas : [];
  const pregunta = carga.tipo === 'lista' ? carga.pregunta : null;
  // Al llegar la pregunta (o al cambiar de una a otra), el formulario parte con sus datos.
  const [deLaPregunta, setDeLaPregunta] = useState<PreguntaParaEditar | null>(null);
  if (pregunta !== deLaPregunta) {
    setDeLaPregunta(pregunta);
    setCampos(pregunta ? camposDePregunta(pregunta) : camposVacios());
  }

  const actualizar = (cambio: (actual: CamposPregunta) => CamposPregunta) => {
    alCambiar();
    setCampos(cambio);
  };
  const cambiar = (cambios: Partial<CamposPregunta>) =>
    actualizar((actual) => ({ ...actual, ...cambios }));
  const acciones = {
    cambiar,
    elegirPrueba: (id: number | undefined) =>
      actualizar((actual) => conPrueba(actual, pruebaDe(pruebas, id))),
    elegirEje: (ejeId: number | undefined) => cambiar({ ejeId, contenidoId: undefined }),
    cambiarAlternativa: (letra: Letra, cambios: Partial<CamposAlternativa>) =>
      actualizar((actual) => ({
        ...actual,
        alternativas: actual.alternativas.map((a) =>
          a.letra === letra ? { ...a, ...cambios } : a,
        ),
      })),
    cambiarCantidad: (agregar: boolean) =>
      actualizar((actual) => {
        const prueba = pruebaDe(pruebas, actual.pruebaId);
        return prueba ? cambiarCantidad(actual, prueba, agregar) : actual;
      }),
    cambiarTexto: (cambios: Partial<CamposTexto>) =>
      actualizar((actual) => ({ ...actual, texto: { ...actual.texto, ...cambios } })),
    cambiarTextoNuevo: (cambios: Partial<CamposTexto['nuevo']>) =>
      actualizar((actual) => ({
        ...actual,
        texto: { ...actual.texto, nuevo: { ...actual.texto.nuevo, ...cambios } },
      })),
  };
  return { campos, acciones };
}

/** El aviso que dejó la página anterior al navegar, si hay. */
function useAvisoDeNavegacion(): string | null {
  const estado: unknown = useLocation().state;
  return typeof estado === 'object' && estado !== null && 'aviso' in estado
    ? String(estado.aviso)
    : null;
}

/**
 * Después del primer intento de guardar, los errores del formulario se recalculan mientras se escribe;
 * los de la API se borran al cambiar cualquier campo.
 */
export function useEditorPregunta(id: number | null) {
  const carga = useCargaEditor(id);
  const [intentado, setIntentado] = useState(false);
  const [erroresApi, setErroresApi] = useState<ErroresPregunta>({});
  const [enviando, setEnviando] = useState(false);
  const [guardada, setGuardada] = useState(false);
  const { campos, acciones } = useCampos(carga, () => {
    setErroresApi({});
    setGuardada(false);
  });
  const navegar = useNavigate();
  const avisoInicial = useAvisoDeNavegacion();
  const prueba =
    carga.tipo === 'lista' ? pruebaDe(carga.opciones.pruebas, campos.pruebaId) : undefined;
  const errores: ErroresPregunta = {
    ...(intentado ? validarCampos(campos, prueba) : {}),
    ...erroresApi,
  };

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    setIntentado(true);
    setGuardada(false);
    if (!prueba || Object.keys(validarCampos(campos, prueba)).length > 0) return;
    setEnviando(true);
    const datos = armarDatos(campos, prueba);
    const guardar = id === null ? crearPregunta(datos) : editarPregunta(id, datos);
    guardar.then(
      (pregunta) => {
        setEnviando(false);
        if (id === null) {
          void navegar(`/banco/${String(pregunta.id)}`, { state: { aviso: AVISO_BORRADOR } });
        } else setGuardada(true);
      },
      (error: unknown) => {
        setErroresApi(erroresDeApi(error));
        setEnviando(false);
      },
    );
  };

  const aviso = guardada ? 'Cambios guardados.' : avisoInicial;
  return { carga, campos, errores, enviando, aviso, enviar, ...acciones };
}
