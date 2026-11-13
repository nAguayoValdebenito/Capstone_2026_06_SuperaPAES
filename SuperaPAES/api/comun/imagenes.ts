// Preparación de las imágenes de las preguntas (HU-12.6). Toda imagen se vuelve a generar
// antes de guardarla: así no pasa contenido escondido ni metadatos (EXIF, GPS) y pesa poco en el teléfono.
// Solo se aceptan PNG, JPEG y WebP, comprobados por su contenido y no por la extensión; SVG no, porque
// puede traer código que se ejecuta en la consola.
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { ErrorValidacion } from './errores.js';

/** Lado mayor de una imagen subida, en píxeles. */
export const LADO_MAXIMO_IMAGEN = 1600;
/** Tamaño máximo del archivo que se sube y de la imagen que se guarda (contenido.imagen.bytes). */
export const BYTES_MAXIMOS_IMAGEN = 2 * 1024 * 1024;
/** Tipos que acepta la ruta de subida (encabezado Content-Type). */
export const TIPOS_IMAGEN = ['image/png', 'image/jpeg', 'image/webp'] as const;

const FORMATOS_ACEPTADOS = new Set(['png', 'jpeg', 'webp']);
/** Evita que una imagen pequeña en bytes pero enorme en píxeles agote la memoria del servidor. */
const PIXELES_MAXIMOS_ENTRADA = 16_000_000;
const CALIDAD_WEBP = 82;

export interface ImagenPreparada {
  /** SHA-256 en hexadecimal del WebP: identifica la imagen y forma su dirección. */
  huella: string;
  datos: Buffer;
  ancho: number;
  alto: number;
}

const rechazar = (mensaje: string): never => {
  throw new ErrorValidacion([{ lugar: 'cuerpo', ruta: 'imagen', mensaje }], mensaje);
};

async function formatoDe(archivo: Buffer): Promise<string | undefined> {
  try {
    const { format } = await sharp(archivo, {
      limitInputPixels: PIXELES_MAXIMOS_ENTRADA,
    }).metadata();
    return format;
  } catch {
    return undefined;
  }
}

/**
 * Revisa la imagen, la endereza según su orientación, la reduce a un lado mayor de 1.600 píxeles (sin
 * agrandarla) y la convierte a WebP sin metadatos. Lanza 400 VALIDACION si no es PNG, JPEG o WebP, si
 * está dañada o si pesa más de 2 MB.
 */
export async function prepararImagen(archivo: Buffer): Promise<ImagenPreparada> {
  if (archivo.length === 0) rechazar('Envía una imagen.');
  if (archivo.length > BYTES_MAXIMOS_IMAGEN) rechazar('La imagen puede pesar hasta 2 MB.');
  const formato = await formatoDe(archivo);
  if (!formato || !FORMATOS_ACEPTADOS.has(formato)) {
    rechazar('La imagen debe ser PNG, JPEG o WebP.');
  }
  try {
    const { data, info } = await sharp(archivo, {
      limitInputPixels: PIXELES_MAXIMOS_ENTRADA,
      failOn: 'error',
    })
      .rotate()
      .resize({
        width: LADO_MAXIMO_IMAGEN,
        height: LADO_MAXIMO_IMAGEN,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: CALIDAD_WEBP })
      .toBuffer({ resolveWithObject: true });
    if (data.length > BYTES_MAXIMOS_IMAGEN) rechazar('La imagen puede pesar hasta 2 MB.');
    return {
      huella: createHash('sha256').update(data).digest('hex'),
      datos: data,
      ancho: info.width,
      alto: info.height,
    };
  } catch (error) {
    if (error instanceof ErrorValidacion) throw error;
    return rechazar('No se pudo leer la imagen: puede estar dañada.');
  }
}
