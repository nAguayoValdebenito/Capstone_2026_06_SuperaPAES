// Entrada y salida de la herramienta TEC-04. Los originales nunca se reescriben.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import {
  esquemaReparacionBanco,
  huellaBanco,
  leerBanco,
  repararBanco,
  type RegistroBanco,
} from '../modulos/preguntas/preguntas.preparacion.lectura.js';
import { esquemaDecisionBanco } from '../modulos/preguntas/preguntas.preparacion.revision.js';

export async function leerJsonBanco(ruta: string): Promise<unknown> {
  return JSON.parse((await readFile(ruta, 'utf8')).replace(/^\uFEFF/, '')) as unknown;
}

export async function archivosBanco(carpeta: string, prefijo = ''): Promise<string[]> {
  const archivos: string[] = [];
  for (const entrada of await readdir(path.join(carpeta, prefijo), { withFileTypes: true })) {
    const relativo = path.posix.join(prefijo, entrada.name);
    if (entrada.isDirectory()) archivos.push(...(await archivosBanco(carpeta, relativo)));
    else if (entrada.isFile() && /\.json$/i.test(entrada.name)) archivos.push(relativo);
    else
      throw new Error('El directorio de entrada solo debe contener JSON y carpetas, sin enlaces.');
  }
  return archivos.sort();
}

export async function escribirBanco(
  carpeta: string,
  archivo: string,
  texto: string,
): Promise<void> {
  const destino = path.join(carpeta, archivo);
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, texto, { encoding: 'utf8', flag: 'wx' });
}

export async function cargarBanco(entrada: string, salida: string, reparacionesRuta?: string) {
  const reparaciones = reparacionesRuta
    ? z.array(esquemaReparacionBanco).parse(await leerJsonBanco(reparacionesRuta))
    : [];
  const archivos = await archivosBanco(entrada);
  if (!archivos.length) throw new Error('No hay archivos JSON en la entrada.');
  if (reparaciones.some((r) => !archivos.includes(r.archivo)))
    throw new Error('Reparación sin archivo de origen.');
  const registros: RegistroBanco[] = [];
  const inventario: { archivo: string; sha256: string; registros: number; reparaciones: number }[] =
    [];
  for (const archivo of archivos) {
    const bytes = await readFile(path.join(entrada, archivo));
    const texto = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    const cambios = reparaciones.filter((r) => r.archivo === archivo);
    const reparado = repararBanco(texto, cambios);
    const filas = leerBanco(reparado, archivo);
    registros.push(...filas);
    inventario.push({
      archivo,
      sha256: huellaBanco(bytes),
      registros: filas.length,
      reparaciones: cambios.length,
    });
    await escribirBanco(salida, path.join('reparados', archivo), reparado);
  }
  return { registros, inventario, reparaciones };
}

export async function leerDecisionesBanco(ruta?: string) {
  return ruta ? z.array(esquemaDecisionBanco).parse(await leerJsonBanco(ruta)) : [];
}
