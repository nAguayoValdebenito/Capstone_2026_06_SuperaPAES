// Importar preguntas (C04, HU-13.2, CU-16): el administrador elige el CSV de preguntas y, si hay, el de
// textos de lectura; cada cambio pide el informe a la API sin guardar nada (pasos 3 a 5). Con la
// declaración del origen (paso 6, RN-29) confirma, y vuelve al banco con el aviso de cuántas preguntas
// quedaron como borrador. Las reglas de cada fila son de la API (HU-13.1).
import { type FormEvent, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { importarPreguntas, revisarImportacion } from '../servicios/preguntas';
import type { ArchivoCsv, ArchivosImportacion, InformeImportacion } from '../tipos';
import { mensajeDeError } from './usuarios-internos';

/**
 * Peso de los dos archivos juntos: la API recibe hasta 1 MB y el texto del archivo crece un poco al ir
 * dentro del JSON.
 */
export const PESO_MAXIMO = 900 * 1024;

export type CualArchivo = 'preguntas' | 'textos';

export type RevisionImportacion =
  | { tipo: 'sin_archivo' }
  | { tipo: 'revisando' }
  /** El informe y los archivos tal como se revisaron: son los que se importan al confirmar. */
  | { tipo: 'lista'; informe: InformeImportacion; archivos: ArchivosImportacion }
  /** El archivo no se puede revisar: no es CSV, pesa demasiado o no sigue la plantilla (CU-16 2.a). */
  | { tipo: 'rechazada'; codigo: string; mensaje: string };

type Elegidos = Record<CualArchivo, File | null>;

/** Por qué los archivos no se pueden enviar a revisar, o null. */
export function problemaDeLosArchivos(archivos: readonly { name: string; size: number }[]) {
  if (archivos.some((archivo) => !/\.csv$/i.test(archivo.name))) {
    return 'Elige archivos CSV. En Excel, guarda la planilla como «CSV UTF-8 (delimitado por comas)».';
  }
  const peso = archivos.reduce((total, archivo) => total + archivo.size, 0);
  if (peso > PESO_MAXIMO) {
    return 'Los archivos pesan más de 900 KB en total: divide las preguntas en varios archivos.';
  }
  return null;
}

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

/** El navegador lee el archivo como UTF-8, como lo espera la API. */
const leer = async (archivo: File): Promise<ArchivoCsv> => ({
  nombre: archivo.name,
  contenido: await archivo.text(),
});

async function leerArchivos(preguntas: File, textos: File | null): Promise<ArchivosImportacion> {
  return { preguntas: await leer(preguntas), textos: textos ? await leer(textos) : null };
}

/** Pide el informe de los archivos elegidos; solo vale la respuesta de la última revisión. */
function useRevision() {
  const [revision, setRevision] = useState<RevisionImportacion>({ tipo: 'sin_archivo' });
  const ultima = useRef(0);
  const revisar = ({ preguntas, textos }: Elegidos) => {
    ultima.current += 1;
    const esta = ultima.current;
    const vigente = () => esta === ultima.current;
    const problema = preguntas
      ? problemaDeLosArchivos(textos ? [preguntas, textos] : [preguntas])
      : null;
    if (!preguntas || problema) {
      setRevision(
        problema
          ? { tipo: 'rechazada', codigo: 'ARCHIVO', mensaje: problema }
          : { tipo: 'sin_archivo' },
      );
      return;
    }
    setRevision({ tipo: 'revisando' });
    leerArchivos(preguntas, textos)
      .then(async (archivos) => ({ archivos, informe: await revisarImportacion(archivos) }))
      .then(
        ({ archivos, informe }) => {
          if (vigente()) setRevision({ tipo: 'lista', informe, archivos });
        },
        (error: unknown) => {
          if (vigente()) setRevision({ tipo: 'rechazada', ...mensajeDeError(error) });
        },
      );
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

  /** Cambiar un archivo vuelve a revisar y pide declarar de nuevo el origen. */
  const cambiarArchivo = (cual: CualArchivo, archivo: File | null) => {
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
