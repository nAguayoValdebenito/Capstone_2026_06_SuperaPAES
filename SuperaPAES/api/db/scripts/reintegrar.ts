// Reintegración de datos después de una recuperación (TEC-08, CP-59; DAS 4.5.5). Por defecto solo
// simula: informa cuántas filas copiaría, cuáles quedan fuera y qué lo impide. Con --aplicar copia todo
// en una sola transacción, verifica los resultados y vuelve a simular; si algo falla, no copia nada.
// Variables (solo en la terminal, nunca en api/.env ni en el chat):
//   URL_ORIGEN   la rama _old de Neon (estado previo a la recuperación), con un cómputo propio
//   URL_DESTINO  la base recuperada (el servicio de Render debe estar suspendido)
//   DESDE        el momento de recuperación, en ISO 8601 con zona: 2026-11-02T14:30:00-03:00
//   DATABASE_SSL true para Neon
// Uso: npm run reintegrar -w api                (simulación)
//      npm run reintegrar -w api -- --aplicar   (copia)
// Solo muestra ids y cantidades: nunca direcciones, claves ni datos personales.
import pg from 'pg';
import { leerConfiguracionBaseDeDatos } from '../../comun/configuracion.js';
import { type DatosConexion, opcionesConexion } from '../conexion.js';
import { ErrorOperacion } from '../procesos.js';
import {
  aplicarReintegracion,
  type InformeReintegracion,
  type OpcionesReintegracion,
  simularReintegracion,
} from '../reintegracion.js';
import { mismaBase } from '../restauracion.js';
import { ejecutarOperacion } from './comun.js';

const CON_ZONA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function leerDesde(texto: string | undefined): Date {
  if (!texto || !CON_ZONA.test(texto)) {
    throw new ErrorOperacion(
      'DESDE debe ser el momento de recuperación en ISO 8601 con zona, por ejemplo 2026-11-02T14:30:00-03:00.',
    );
  }
  const desde = new Date(texto);
  if (Number.isNaN(desde.getTime()) || desde.getTime() > Date.now()) {
    throw new ErrorOperacion('DESDE no es una fecha válida o está en el futuro.');
  }
  return desde;
}

function leerConexion(variable: 'URL_ORIGEN' | 'URL_DESTINO'): DatosConexion {
  if (!process.env[variable]) throw new ErrorOperacion(`Falta ${variable}.`);
  return leerConfiguracionBaseDeDatos({
    DATABASE_URL: process.env[variable],
    DATABASE_SSL: process.env['DATABASE_SSL'],
  });
}

async function conectar(conexion: DatosConexion): Promise<pg.Client> {
  const cliente = new pg.Client({ ...opcionesConexion(conexion), connectionTimeoutMillis: 15_000 });
  await cliente.connect();
  return cliente;
}

function mostrarInforme(informe: InformeReintegracion): void {
  console.log('Tabla: candidatas / ya en el destino / pendientes');
  for (const t of informe.tablas) {
    console.log(`  ${t.tabla}: ${t.candidatas} / ${t.presentes} / ${t.pendientes}`);
  }
  console.log(`Filas pendientes: ${informe.pendientes}.`);
  const ids = (valores: Record<string, string>) =>
    Object.entries(valores)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ');
  if (informe.excluidas.length > 0) {
    console.log('Quedan fuera (informar a los estudiantes afectados y revisar con las tiendas):');
    for (const e of informe.excluidas) console.log(`  - ${e.motivo}: ${ids(e.ids)}`);
  }
  if (informe.bloqueos.length > 0) {
    console.log('Impiden reintegrar (no se copiará nada hasta resolverlos):');
    for (const b of informe.bloqueos) console.log(`  - ${b.motivo}: ${ids(b.ids)}. ${b.accion}`);
  }
}

async function ejecutar(opciones: OpcionesReintegracion, aplicar: boolean): Promise<void> {
  if (!aplicar) {
    console.log('Simulación: no se escribe nada. Para copiar, agregue -- --aplicar.');
    mostrarInforme(await simularReintegracion(opciones));
    return;
  }
  const resultado = await aplicarReintegracion(opciones);
  mostrarInforme(resultado.informe);
  console.log(
    `Copiado en una sola transacción. Resultados verificados: ${resultado.evaluacionesVerificadas} ` +
      `evaluaciones. Pendientes después de copiar: ${resultado.pendientesDespues}.`,
  );
  if (resultado.cerradasAhora.length > 0) {
    console.log(
      `Cerradas a la hora de la reintegración (cerrada_en y tiempo usado distintos del origen): ` +
        `${resultado.cerradasAhora.join(', ')}.`,
    );
  }
}

ejecutarOperacion(async () => {
  const desde = leerDesde(process.env['DESDE']);
  const origen = leerConexion('URL_ORIGEN');
  const destino = leerConexion('URL_DESTINO');
  if (mismaBase(origen.url, destino.url)) {
    throw new ErrorOperacion('URL_ORIGEN y URL_DESTINO son la misma base.');
  }
  const clientes = { origen: await conectar(origen), destino: await conectar(destino) };
  try {
    await ejecutar({ ...clientes, desde }, process.argv.includes('--aplicar'));
  } finally {
    await clientes.origen.end();
    await clientes.destino.end();
  }
}, ['URL_ORIGEN', 'URL_DESTINO']);
