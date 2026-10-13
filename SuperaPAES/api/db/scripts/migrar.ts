// Aplica las migraciones pendientes de db/migraciones. Ejecutarlo de nuevo no hace nada.
// Uso: npm run migrar -w api (desarrollo) o npm run migrar:produccion -w api (compilado, en Render).
import { migrar } from '../migrador.js';
import { encontrarCarpeta, ejecutarScript } from './comun.js';

ejecutarScript(async (cliente) => {
  const aplicadas = await migrar(cliente, encontrarCarpeta('migraciones'));
  console.log(
    aplicadas.length === 0
      ? 'No hay migraciones pendientes.'
      : `Migraciones aplicadas: ${aplicadas.join(', ')}`,
  );
});
