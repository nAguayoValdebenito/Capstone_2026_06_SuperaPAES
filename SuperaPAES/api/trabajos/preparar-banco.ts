// TEC-04: CLI local. Lee el temario por su servicio; jamás importa preguntas a PostgreSQL.
import { parseArgs } from 'node:util';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { ejecutarOperacion } from '../db/scripts/comun.js';
import { prepararBanco } from '../modulos/preguntas/index.js';
import { cargarTemarioBanco } from './preparacion-banco.temario.js';
import { cargarBanco, escribirBanco, leerDecisionesBanco } from './preparacion-banco.archivos.js';

async function principal() {
  const { values } = parseArgs({
    options: {
      entrada: { type: 'string' },
      salida: { type: 'string' },
      reparaciones: { type: 'string' },
      decisiones: { type: 'string' },
      temario: { type: 'string' },
    },
  });
  if (!values.entrada || !values.salida)
    throw new Error(
      'Uso: preparar:banco -- --entrada <carpeta JSON> --salida <carpeta nueva> [--reparaciones <JSON>] [--decisiones <JSON>]',
    );
  const entrada = path.resolve(values.entrada);
  const salida = path.resolve(values.salida);
  // No se permite escribir dentro del origen ni reutilizar una ejecución previa.
  const relativa = path.relative(entrada, salida);
  if (!relativa || (!relativa.startsWith('..' + path.sep) && !path.isAbsolute(relativa))) {
    throw new Error('La salida debe estar fuera de la carpeta de originales.');
  }
  const temario = await cargarTemarioBanco(values.temario);
  const decisiones = await leerDecisionesBanco(values.decisiones);
  await mkdir(salida, { recursive: false });
  const banco = await cargarBanco(entrada, salida, values.reparaciones);
  const resultado = prepararBanco(banco.registros, temario, decisiones);
  await escribirBanco(salida, 'revision.json', JSON.stringify(resultado.revision, null, 2));
  await escribirBanco(salida, 'revision.csv', resultado.planilla);
  await escribirBanco(salida, 'preguntas.csv', resultado.importacion);
  await escribirBanco(salida, 'temario.json', JSON.stringify(temario, null, 2));
  await escribirBanco(
    salida,
    'evidencia.json',
    JSON.stringify(
      {
        ...banco,
        registros: undefined,
        decisiones,
        resumen: resultado.resumen,
      },
      null,
      2,
    ),
  );
  process.stdout.write(JSON.stringify(resultado.resumen, null, 2) + '\n');
}

ejecutarOperacion(principal, ['DATABASE_URL']);
