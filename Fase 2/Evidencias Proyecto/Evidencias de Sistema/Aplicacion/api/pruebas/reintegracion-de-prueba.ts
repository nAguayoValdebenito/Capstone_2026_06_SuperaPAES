// Escenario de las pruebas de reintegración (TEC-08, CP-59, DAS 4.5.5): el «origen» hace de rama _old
// de Neon (el estado previo a la recuperación) y el «destino», de la base recuperada al momento DESDE.
// El destino se obtiene restaurando un respaldo del origen tomado en ese momento, así tiene los mismos
// ids y las mismas secuencias que tendría la recuperación instantánea de Neon.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { respaldar } from '../db/copia-de-respaldo.js';
import { restaurarRespaldo } from '../db/restauracion.js';
import { type BaseTemporal, crearBaseTemporal } from './base-temporal.js';
import { CLAVE_DE_PRUEBA, prepararContenido } from './datos-contingencia.js';

export interface Escenario {
  origen: BaseTemporal;
  destino: BaseTemporal;
  preguntas: string[];
  /** Momento de recuperación: todo lo creado en el origen después de él se reintegra. */
  desde: Date;
  cerrar(): Promise<void>;
}

/** Origen con contenido y lo que prepare `antes`; destino = copia del origen en el momento DESDE. */
export async function prepararEscenario(
  prefijo: string,
  antes: (origen: BaseTemporal, preguntas: string[]) => Promise<void>,
): Promise<Escenario> {
  const origen = await crearBaseTemporal(`${prefijo}_origen`);
  const preguntas = await prepararContenido(origen.bd);
  await antes(origen, preguntas);
  const destino = await crearBaseTemporal(`${prefijo}_destino`, { migrar: false });
  const carpeta = await mkdtemp(path.join(tmpdir(), 'reintegracion-'));
  try {
    const copia = await respaldar({
      conexion: { url: origen.url, ssl: false },
      clave: CLAVE_DE_PRUEBA,
      carpeta,
      fecha: new Date(),
    });
    await restaurarRespaldo({
      archivo: copia.respaldo,
      clave: CLAVE_DE_PRUEBA,
      destino: { url: destino.url, ssl: false },
      referencias: { URL_PRODUCCION: origen.url },
    });
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
  const { rows } = await origen.bd.query<{ ahora: Date }>('SELECT clock_timestamp() AS ahora');
  const desde = rows[0]?.ahora ?? new Date();
  return {
    origen,
    destino,
    preguntas,
    desde,
    async cerrar() {
      await destino.cerrar();
      await origen.cerrar();
    },
  };
}

/** Cantidad de filas de una tabla de app, para comprobar que nada se copió o que no hay duplicados. */
export async function filas(base: BaseTemporal, tabla: string): Promise<number> {
  const { rows } = await base.bd.query<{ n: string }>(`SELECT count(*) AS n FROM app.${tabla}`);
  return Number(rows[0]?.n ?? 0);
}
