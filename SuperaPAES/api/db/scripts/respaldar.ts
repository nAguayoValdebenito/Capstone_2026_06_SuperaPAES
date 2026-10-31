// Respaldo diario cifrado de la base publicada (TEC-08.1, DAS 4.5.5). Lo ejecuta el flujo
// .github/workflows/respaldo.yml; también sirve a mano. Variables: DATABASE_URL y DATABASE_SSL (la base),
// CLAVE_RESPALDO (al menos 32 caracteres aleatorios) y CARPETA_RESPALDO (dónde dejar las copias cifradas).
// Uso: npm run respaldar -w api
// Solo muestra los nombres y el tamaño de las copias: nunca la dirección, la clave ni datos de la base.
import { leerConfiguracionBaseDeDatos } from '../../comun/configuracion.js';
import { respaldar } from '../copia-de-respaldo.js';
import { ejecutarOperacion } from './comun.js';

ejecutarOperacion(async () => {
  const carpeta = process.env['CARPETA_RESPALDO'];
  if (!carpeta)
    throw new Error('Falta CARPETA_RESPALDO: la carpeta donde quedan las copias cifradas.');
  const copia = await respaldar({
    conexion: leerConfiguracionBaseDeDatos(),
    clave: process.env['CLAVE_RESPALDO'],
    carpeta,
    fecha: new Date(),
  });
  console.log(`Respaldo cifrado: ${copia.respaldo} (${copia.bytes} bytes).`);
  console.log(`Cantidades cifradas: ${copia.cantidades}.`);
}, ['DATABASE_URL', 'CLAVE_RESPALDO']);
