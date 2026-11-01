// Importar preguntas (C04, HU-13.2, CU-16): el administrador elige el CSV de preguntas y, si hay, el de
// textos de lectura; cada cambio pide el informe a la API sin guardar nada (pasos 3 a 5). Con la
// declaración del origen (paso 6, RN-29) confirma, y vuelve al banco con el aviso de cuántas preguntas
// quedaron como borrador. Las reglas de cada fila son de la API (HU-13.1).
import { type FormEvent, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { importarPreguntas, revisarImportacion } from '../servicios/preguntas';
import type { ArchivoCsv, ArchivosImportacion, InformeImportacion } from '../tipos';
import { mensajeDeError } from './usuarios-internos';

/** Lo que recibe la API en una petición (express.json con límite de 1 MB): los archivos van en el JSON. */
export const PESO_MAXIMO = 1024 * 1024;

export type CualArchivo = 'preguntas' | 'textos';

export type RevisionImportacion =
  | { tipo: 'sin_archivo' }
  | { tipo: 'revisando' }
  /** El informe y los archivos tal como se revisaron: son los que se importan al confirmar. */
  | { tipo: 'lista'; informe: InformeImportacion; archivos: ArchivosImportacion }
  /** El archivo no se puede revisar: no es CSV, pesa demasiado o no sigue la plantilla (CU-16 2.a). */
  | { tipo: 'rechazada'; mensaje: string };

type Elegidos = Record<CualArchivo, File | null>;

const GUARDAR_COMO_CSV = 'En Excel, guarda la planilla como «CSV UTF-8 (delimitado por comas)».';

export const esCsv = (nombre: string) => /\.csv$/i.test(nombre);

/** La petición, con la declaración que agrega la confirmación, pasa del límite de la API. */
export const pesaDemasiado = (archivos: ArchivosImportacion) =>
  new Blob([JSON.stringify({ ...archivos, declaraOrigen: true })]).size > PESO_MAXIMO;

/** Un archivo que la consola rechaza antes de enviarlo, con el motivo para el administrador. */
class ArchivoRechazado extends Error {}

/** Se confirma con la declaración marcada y al menos una pregunta por crear. */
export function puedeConfirmar(
  revision: RevisionImportacion,
  declara: boolean,
  enviando: boolean,
): boolean {
  return revision.tipo === 'lista' && revision.informe.porCrear > 0 && declara && !enviando;
}

/** El aviso que muestra el banco al volver. */
export function avisoDeImportacion(creadas: number): string {
  return creadas === 1
    ? 'Se importó 1 pregunta como borrador.'
    : `Se importaron ${String(creadas)} preguntas como borrador.`;
}

/**
 * Lee el archivo como UTF-8 estricto, como lo espera la API (RF-G05): un CSV guardado en otra
 * codificación se rechaza aquí, antes de enviarlo, en vez de llegar con las tildes cambiadas.
 */
async function leer(archivo: File): Promise<ArchivoCsv> {
  const bytes = await archivo.arrayBuffer();
  try {
    return {
      nombre: archivo.name,
      contenido: new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    };
  } catch {
    throw new ArchivoRechazado(
      `El archivo «${archivo.name}» no está en UTF-8. ${GUARDAR_COMO_CSV}`,
    );
  }
}

/** Lee y revisa los archivos. Nunca falla: cualquier problema queda como una revisión rechazada. */
async function revisarArchivos(
  [preguntas, textos]: [File, File | null],
  senal: AbortSignal,
): Promise<RevisionImportacion> {
  try {
    if (![preguntas, textos].every((archivo) => !archivo || esCsv(archivo.name))) {
      throw new ArchivoRechazado(`Elige archivos CSV. ${GUARDAR_COMO_CSV}`);
    }
    const archivos = {
      preguntas: await leer(preguntas),
      textos: textos ? await leer(textos) : null,
    };
    if (pesaDemasiado(archivos)) {
      throw new ArchivoRechazado(
        'Los archivos pesan más de 1 MB en total: divide las preguntas en varios archivos.',
      );
    }
    return { tipo: 'lista', archivos, informe: await revisarImportacion(archivos, senal) };
  } catch (error) {
    const mensaje =
      error instanceof ArchivoRechazado ? error.message : mensajeDeError(error).mensaje;
    return { tipo: 'rechazada', mensaje };
  }
}

/** Pide el informe de los archivos elegidos; elegir otro cancela la revisión anterior. */
function useRevision() {
  const [revision, setRevision] = useState<RevisionImportacion>({ tipo: 'sin_archivo' });
  const anterior = useRef<AbortController | null>(null);
  const revisar = ({ preguntas, textos }: Elegidos) => {
    anterior.current?.abort();
    if (!preguntas) {
      setRevision({ tipo: 'sin_archivo' });
      return;
    }
    const control = new AbortController();
    anterior.current = control;
    setRevision({ tipo: 'revisando' });
    void revisarArchivos([preguntas, textos], control.signal).then((resultado) => {
      if (!control.signal.aborted) setRevision(resultado);
    });
  };
  return { revision, revisar };
}

export function useImportacion() {
  const [elegidos, setElegidos] = useState<Elegidos>({ preguntas: null, textos: null });
  const [declara, setDeclara] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { revision, revisar } = useRevision();
  const navegar = useNavigate();

  /**
   * Cambiar un archivo vuelve a revisar y pide declarar de nuevo el origen. Mientras se importa no se
   * cambia: lo que se importa es lo que se revisó.
   */
  const cambiarArchivo = (cual: CualArchivo, archivo: File | null) => {
    if (enviando) return;
    const nuevos = { ...elegidos, [cual]: archivo };
    setElegidos(nuevos);
    setDeclara(false);
    setError(null);
    revisar(nuevos);
  };

  const confirmar = (evento: FormEvent) => {
    evento.preventDefault();
    if (revision.tipo !== 'lista' || !puedeConfirmar(revision, declara, enviando)) return;
    setEnviando(true);
    setError(null);
    importarPreguntas(revision.archivos).then(
      (hecha) => void navegar('/banco', { state: { aviso: avisoDeImportacion(hecha.porCrear) } }),
      (falla: unknown) => {
        setEnviando(false);
        setError(mensajeDeError(falla).mensaje);
      },
    );
  };

  return {
    nombres: { preguntas: elegidos.preguntas?.name ?? null, textos: elegidos.textos?.name ?? null },
    revision,
    declara,
    enviando,
    error,
    cambiarArchivo,
    cambiarDeclaracion: setDeclara,
    confirmar,
  };
}

export type Importacion = ReturnType<typeof useImportacion>;
