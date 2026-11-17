// Imágenes de las preguntas y de los textos de lectura (HU-12.6). El administrador sube una
// imagen; el servidor la revisa, la reduce, la convierte a WebP y la guarda una sola vez por su huella.
// La pregunta la nombra en su Markdown con la dirección que se devuelve, como ![texto](dirección). La
// subida de una imagen nueva queda en la auditoría (RNF-08); subir otra vez la misma no guarda nada.
import { prepararImagen } from '../../comun/imagenes.js';
import { ErrorNoEncontrado } from '../../comun/errores.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import {
  crearImagenesRepositorio,
  type ImagenesRepositorio,
} from './preguntas.imagenes.repositorio.js';

/** Dirección relativa a la API con que el texto de una pregunta nombra la imagen. */
export const direccionDeImagen = (huella: string): string =>
  `api/v1/recursos/imagenes/${huella}.webp`;

export interface ImagenSubida {
  id: string;
  huella: string;
  /** Lo que va entre paréntesis en ![texto alternativo](dirección). */
  direccion: string;
  ancho: number;
  alto: number;
  bytes: number;
  /** Falso si la misma imagen ya estaba guardada. */
  nueva: boolean;
}

export interface ImagenesDePreguntas {
  /** 400 VALIDACION si el archivo no es PNG, JPEG o WebP, está dañado o pesa más de 2 MB. */
  subirImagen(administradorId: string, archivo: Buffer): Promise<ImagenSubida>;
  /** Los bytes en WebP; 404 si no existe. */
  obtenerImagen(huella: string): Promise<Buffer>;
}

/** Lo que necesita el servicio de las dependencias del módulo preguntas. */
export interface DependenciasImagenes {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  /** La subida de una imagen nueva queda en la auditoría (RNF-08). */
  administracion: Pick<AdministracionServicio, 'registrarAuditoria'>;
  /** Solo para pruebas: reemplaza al de crearImagenesRepositorio(bd). */
  repositorioImagenes?: ImagenesRepositorio;
}

export function crearImagenesDePreguntas(dependencias: DependenciasImagenes): ImagenesDePreguntas {
  const { unidadDeTrabajo, administracion: auditoria } = dependencias;
  const repositorio = dependencias.repositorioImagenes ?? crearImagenesRepositorio(dependencias.bd);
  return {
    async subirImagen(administradorId, archivo) {
      const imagen = await prepararImagen(archivo);
      const guardada = await unidadDeTrabajo.enTransaccion(async (tx) => {
        const fila = await repositorio.guardar({ ...imagen, creadoPor: administradorId }, tx);
        if (fila.nueva) {
          await auditoria.registrarAuditoria(
            {
              usuarioId: administradorId,
              accion: 'subir_imagen',
              entidad: 'imagen',
              entidadId: fila.id,
              antes: null,
              despues: {
                huella: imagen.huella,
                ancho: fila.ancho,
                alto: fila.alto,
                bytes: fila.bytes,
              },
            },
            tx,
          );
        }
        return fila;
      });
      return { ...guardada, huella: imagen.huella, direccion: direccionDeImagen(imagen.huella) };
    },

    async obtenerImagen(huella) {
      const datos = await repositorio.datosPorHuella(huella);
      if (!datos) throw new ErrorNoEncontrado('La imagen no existe.');
      return datos;
    },
  };
}
