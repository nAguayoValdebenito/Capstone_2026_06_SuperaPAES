// Ejecuta las semillas de db/semillas (por ejemplo, el temario PAES 2027). Se puede repetir sin efectos.
// Uso: npm run semillas -w api (desarrollo); npm run migrar:produccion -w api también las ejecuta.
// SEMILLAS_OMITIDAS (nombres separados por comas) deja fuera las semillas que aún no se publican.
import { ejecutarSemillas, leerSemillasOmitidas } from '../semillas.js';
import { encontrarCarpeta, ejecutarScript } from './comun.js';

ejecutarScript(async (cliente) => {
  const omitidas = leerSemillasOmitidas(process.env);
  const ejecutadas = await ejecutarSemillas(cliente, encontrarCarpeta('semillas'), omitidas);
  console.log(
    ejecutadas.length === 0 ? 'No hay semillas.' : `Semillas ejecutadas: ${ejecutadas.join(', ')}`,
  );
  if (omitidas.length > 0)
    console.log(`Semillas omitidas (SEMILLAS_OMITIDAS): ${omitidas.join(', ')}`);
});
