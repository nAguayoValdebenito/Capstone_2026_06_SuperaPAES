// Carga preguntas de ejemplo publicadas, para probar y mostrar la app en un computador (TEC-07, paso 66).
// SOLO DESARROLLO: no la ejecuta migrar:produccion, Docker, Render ni la CI, y se niega si NODE_ENV=production.
// Usa DATABASE_URL de api/.env (la base de desarrollo, con las migraciones y las semillas ya cargadas).
// Uso: npm run semilla-demo -w api
import { sembrarPreguntasDeEjemplo } from '../semilla-demo.js';
import { ejecutarScript } from './comun.js';

ejecutarScript(async (cliente) => {
  const { creadas, existentes, preguntasNuevas } = await sembrarPreguntasDeEjemplo(
    cliente,
    process.env['NODE_ENV'],
  );
  console.log(
    creadas.length === 0
      ? 'Las preguntas de ejemplo ya estaban cargadas.'
      : `Preguntas de ejemplo creadas: ${String(preguntasNuevas)} (${creadas.join(', ')}).`,
  );
  if (existentes.length > 0 && creadas.length > 0) {
    console.log(`Ya estaban: ${existentes.join(', ')}.`);
  }
});
