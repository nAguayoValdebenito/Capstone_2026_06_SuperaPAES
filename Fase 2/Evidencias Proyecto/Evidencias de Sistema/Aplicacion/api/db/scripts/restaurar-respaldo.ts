// Restaura una copia cifrada del respaldo diario en una base PostgreSQL 18 aparte y vacía, y compara las
// cantidades con las del respaldo (TEC-08.2, CP-53; DAS 4.5.5). Nunca contra la base publicada.
// Variables (solo en la terminal, nunca en api/.env ni en el chat):
//   ARCHIVO_RESPALDO    copia cifrada (supera-paes-AAAA-MM-DD.dump.gpg)
//   ARCHIVO_CANTIDADES  opcional; por defecto, el .cantidades.json.gpg del mismo día junto a la copia
//   CLAVE_RESPALDO      la clave del secreto de GitHub
//   URL_DESTINO         la base vacía donde se restaura; DATABASE_SSL=true si es de Neon
//   URL_PRODUCCION      la base publicada, para negarse si el destino es ella (también se compara con
//                       DATABASE_URL); sin ninguna de las dos el comando se niega
// Uso: npm run restaurar-respaldo -w api
import { existsSync } from 'node:fs';
import { leerConfiguracionBaseDeDatos } from '../../comun/configuracion.js';
import type { Cantidades, CantidadesDelRespaldo } from '../copia-de-respaldo.js';
import { restaurarRespaldo } from '../restauracion.js';
import { ejecutarOperacion } from './comun.js';

const ETIQUETAS: Record<keyof Cantidades, string> = {
  estudiantes: 'Cuentas de estudiantes',
  usuariosInternos: 'Cuentas internas',
  preguntasPublicadas: 'Preguntas publicadas',
  evaluaciones: 'Evaluaciones',
  respuestas: 'Respuestas',
  suscripciones: 'Suscripciones',
};

function archivoDeCantidades(archivo: string): string | undefined {
  const indicado = process.env['ARCHIVO_CANTIDADES'];
  if (indicado) return indicado;
  const mismoDia = archivo.replace(/\.dump\.gpg$/, '.cantidades.json.gpg');
  return mismoDia !== archivo && existsSync(mismoDia) ? mismoDia : undefined;
}

ejecutarOperacion(async () => {
  const archivo = process.env['ARCHIVO_RESPALDO'];
  if (!archivo) throw new Error('Falta ARCHIVO_RESPALDO: la copia cifrada que se restaura.');
  const destino = leerConfiguracionBaseDeDatos({
    DATABASE_URL: process.env['URL_DESTINO'],
    DATABASE_SSL: process.env['DATABASE_SSL'],
  });
  const { restauradas, respaldo } = await restaurarRespaldo({
    archivo,
    archivoCantidades: archivoDeCantidades(archivo),
    clave: process.env['CLAVE_RESPALDO'],
    destino,
    referencias: {
      URL_PRODUCCION: process.env['URL_PRODUCCION'],
      DATABASE_URL: process.env['DATABASE_URL'],
    },
  });
  console.log('Restauración completa en una sola transacción.');
  informar(restauradas, respaldo);
}, ['URL_DESTINO', 'URL_PRODUCCION', 'DATABASE_URL', 'CLAVE_RESPALDO']);

/** Cada cantidad restaurada junto a la del respaldo, para el registro de CP-53. */
function informar(restauradas: Cantidades, respaldo: CantidadesDelRespaldo | null): void {
  if (!respaldo) {
    console.log('Cantidades restauradas (sin archivo de cantidades para comparar):');
    for (const [clave, etiqueta] of filas()) console.log(`  ${etiqueta}: ${restauradas[clave]}`);
    return;
  }
  console.log(`Cantidades restauradas / del respaldo (tomadas el ${respaldo.tomadasEn}):`);
  for (const [clave, etiqueta] of filas()) {
    const esperada = respaldo.cantidades[clave];
    const marca = esperada === restauradas[clave] ? 'coincide' : 'DISTINTA';
    console.log(`  ${etiqueta}: ${restauradas[clave]} / ${esperada}  ${marca}`);
  }
}

function filas(): [keyof Cantidades, string][] {
  return Object.entries(ETIQUETAS) as [keyof Cantidades, string][];
}
