import { useState } from 'react';
import { obtenerPlantillasImportacion } from '../servicios/preguntas';
import type { ArchivoCsv } from '../tipos';
import { mensajeDeError } from './usuarios-internos';

/** Guarda el CSV UTF-8 que entrega el servidor sin cambiar sus columnas ni su contenido. */
export function guardarCsv(archivo: ArchivoCsv): void {
  const enlace = document.createElement('a');
  const url = URL.createObjectURL(
    new Blob([archivo.contenido], { type: 'text/csv;charset=utf-8' }),
  );
  try {
    enlace.href = url;
    enlace.download = archivo.nombre;
    document.body.append(enlace);
    enlace.click();
  } finally {
    enlace.remove();
    // La navegación de la descarga usa la URL al terminar el evento de clic.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export async function descargarPlantilla(cual: 'preguntas' | 'textos'): Promise<void> {
  const plantillas = await obtenerPlantillasImportacion();
  guardarCsv(plantillas[cual]);
}

export function usePlantillasImportacion() {
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const descargar = (cual: 'preguntas' | 'textos') => {
    if (descargando) return;
    setDescargando(true);
    setError(null);
    void descargarPlantilla(cual)
      .catch((falla: unknown) => setError(mensajeDeError(falla).mensaje))
      .finally(() => setDescargando(false));
  };
  return { descargando, error, descargar };
}
