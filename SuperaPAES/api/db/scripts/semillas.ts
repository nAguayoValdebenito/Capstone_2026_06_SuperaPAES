// Ejecuta las semillas de db/semillas (por ejemplo, el temario PAES 2027). Se puede repetir sin efectos.
// Uso: npm run semillas -w api (desarrollo); npm run migrar:produccion -w api también las ejecuta.
import { ejecutarSemillas } from '../semillas.js';
import { encontrarCarpeta, ejecutarScript } from './comun.js';

ejecutarScript(async (cliente) => {
  const ejecutadas = await ejecutarSemillas(cliente, encontrarCarpeta('semillas'));
  console.log(
    ejecutadas.length === 0 ? 'No hay semillas.' : `Semillas ejecutadas: ${ejecutadas.join(', ')}`,
  );
});
