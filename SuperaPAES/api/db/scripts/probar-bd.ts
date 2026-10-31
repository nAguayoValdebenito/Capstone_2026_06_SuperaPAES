// Pruebas del modelo de datos: crea una base temporal, aplica la migración y las semillas, ejecuta
// db/pruebas/modelo_bd.sql con psql y falla si algún caso no da lo esperado. La base temporal se
// borra al terminar, pase lo que pase. El archivo de casos corre dentro de una transacción que se deshace.
// Uso: npm run probar:bd -w api (DATABASE_URL con permiso para crear bases; psql 18 en el PATH,
// en la variable PSQL o, en Windows, en la instalación de PostgreSQL 18).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { leerConfiguracionBaseDeDatos } from '../../comun/configuracion.js';
import { type DatosConexion, opcionesConexion } from '../conexion.js';
import { migrar } from '../migrador.js';
import {
  adaptarScript,
  type CasoModelo,
  casoCorrecto,
  encontrarPsql,
  entornoPsql,
  leerResultados,
  resumirPorGrupo,
  SEPARADOR,
} from '../prueba-modelo.js';
import { ejecutarSemillas } from '../semillas.js';
import { encontrarCarpeta, ejecutarScript } from './comun.js';

const ARCHIVO_CASOS = 'modelo_bd.sql';

ejecutarScript(async (admin) => {
  const archivoCasos = path.join(encontrarCarpeta('pruebas'), ARCHIVO_CASOS);
  if (!existsSync(archivoCasos)) {
    throw new Error(
      `Falta db/pruebas/${ARCHIVO_CASOS}: cópialo desde docs/base-de-datos/Supera_PAES_Pruebas_Modelo_BD.sql.`,
    );
  }
  const configuracion = leerConfiguracionBaseDeDatos();
  // Nombre generado por el script (solo letras, números y _): se puede escribir en el SQL.
  const nombre = `supera_paes_prueba_${Date.now()}_test`;
  const url = new URL(configuracion.url);
  url.pathname = `/${nombre}`;
  const prueba: DatosConexion = { url: url.toString(), ssl: configuracion.ssl };

  const carpeta = mkdtempSync(path.join(tmpdir(), 'probar-bd-'));
  try {
    await admin.query(`CREATE DATABASE ${nombre}`);
    await prepararBase(prueba);
    informar(ejecutarCasos(archivoCasos, prueba, carpeta));
  } finally {
    rmSync(carpeta, { recursive: true, force: true });
    await admin.query(`DROP DATABASE IF EXISTS ${nombre} WITH (FORCE)`);
  }
});

async function prepararBase(conexion: DatosConexion): Promise<void> {
  const cliente = new pg.Client(opcionesConexion(conexion));
  await cliente.connect();
  try {
    const migraciones = await migrar(cliente, encontrarCarpeta('migraciones'));
    const semillas = await ejecutarSemillas(cliente, encontrarCarpeta('semillas'));
    console.log(`Base temporal: ${migraciones.join(', ')}; semillas ${semillas.join(', ')}.`);
  } finally {
    await cliente.end();
  }
}

function ejecutarCasos(
  archivoCasos: string,
  conexion: DatosConexion,
  carpeta: string,
): CasoModelo[] {
  const resultados = path.join(carpeta, 'resultados.txt');
  const script = path.join(carpeta, ARCHIVO_CASOS);
  writeFileSync(
    script,
    adaptarScript(readFileSync(archivoCasos, 'utf8'), process.platform, resultados),
  );

  const psql = encontrarPsql(process.env, process.platform, existsSync);
  const argumentos = [
    '-X',
    '-q',
    '-A',
    '-t',
    '-F',
    SEPARADOR,
    '-v',
    'ON_ERROR_STOP=1',
    '-f',
    script,
  ];
  const salida = spawnSync(psql, argumentos, {
    env: { ...process.env, ...entornoPsql(conexion.url, conexion.ssl) },
    encoding: 'utf8',
  });
  if (salida.error) {
    throw new Error(`No se pudo ejecutar ${psql}: indica su ruta en la variable PSQL.`, {
      cause: salida.error,
    });
  }
  if (salida.status !== 0) throw new Error(`psql terminó con error:\n${salida.stderr}`);
  return leerResultados(readFileSync(resultados, 'utf8'));
}

function informar(casos: CasoModelo[]): void {
  for (const { grupo, correctos, total } of resumirPorGrupo(casos)) {
    console.log(`${correctos === total ? '✓' : '✗'} ${grupo}: ${correctos} de ${total}`);
  }
  const fallidos = casos.filter((caso) => !casoCorrecto(caso));
  for (const c of fallidos) {
    const motivo = c.motivo ? ` (${c.motivo})` : '';
    console.error(
      `  Caso ${c.numero}, ${c.caso}: se esperaba ${c.esperado} y dio ${c.obtenido}${motivo}`,
    );
  }
  console.log(`Casos correctos: ${casos.length - fallidos.length} de ${casos.length}.`);
  if (casos.length === 0 || fallidos.length > 0) process.exitCode = 1;
}
