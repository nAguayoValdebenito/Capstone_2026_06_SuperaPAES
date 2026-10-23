// Despliegue (DAS 1.11 4.5.3): si una migración no se puede aplicar, el proceso termina con un código
// distinto de cero y el inicio de la API no se ejecuta, porque Render corre
// `npm run migrar:produccion -w api && npm start -w api`. El mensaje no muestra la contraseña.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const raizApi = path.join(import.meta.dirname, '..');

describe('migrar en el despliegue', () => {
  it('termina con error, sin mostrar la contraseña, si no puede conectarse a la base', () => {
    const salida = spawnSync(process.execPath, ['--import', 'tsx', 'db/scripts/migrar.ts'], {
      cwd: raizApi,
      env: {
        ...process.env,
        // Puerto cerrado: la conexión falla al instante. Dirección inventada, no es un secreto.
        // secretlint-disable-next-line
        DATABASE_URL: 'postgres://supera:clave-que-no-se-muestra@127.0.0.1:1/x',
      },
      encoding: 'utf8',
      timeout: 30_000,
    });

    expect(salida.status).not.toBe(0);
    expect(`${salida.stdout}${salida.stderr}`).not.toContain('clave-que-no-se-muestra');
  });

  it('migrar:produccion encadena las semillas con && y no las carga si fallan las migraciones', () => {
    const paquete: unknown = JSON.parse(readFileSync(path.join(raizApi, 'package.json'), 'utf8'));
    const scripts =
      typeof paquete === 'object' && paquete !== null && 'scripts' in paquete
        ? paquete.scripts
        : {};

    expect(scripts).toMatchObject({
      'migrar:produccion': 'node dist/db/scripts/migrar.js && node dist/db/scripts/semillas.js',
    });
  });
});
