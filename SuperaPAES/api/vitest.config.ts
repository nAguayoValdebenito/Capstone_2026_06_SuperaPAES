import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { defineConfig } from 'vitest/config';

/**
 * Base de las pruebas con PostgreSQL: DATABASE_URL_PRUEBAS del entorno o, si no está, solo esa variable
 * de api/.env (nunca DATABASE_URL, que es la base de desarrollo). Su nombre debe terminar en _test.
 */
function urlDePruebas(): string | undefined {
  const delEntorno = process.env['DATABASE_URL_PRUEBAS'];
  if (delEntorno) return delEntorno;
  const archivo = path.join(import.meta.dirname, '.env');
  return existsSync(archivo)
    ? parseEnv(readFileSync(archivo, 'utf8'))['DATABASE_URL_PRUEBAS']
    : undefined;
}

const urlPruebas = urlDePruebas();

export default defineConfig({
  test: {
    include: ['pruebas/**/*.test.ts'],
    environment: 'node',
    env: urlPruebas ? { DATABASE_URL_PRUEBAS: urlPruebas } : {},
    // Cada prueba deja los espías (vi.spyOn) como estaban, aunque falle antes de restaurarlos.
    restoreMocks: true,
    // npm run cobertura -w api. Solo el código de producción (sin pruebas ni scripts de línea de comandos).
    coverage: {
      provider: 'v8',
      include: ['app.ts', 'modulos/**', 'comun/**', 'adaptadores/**', 'db/*.ts', 'trabajos/**'],
      reporter: ['text-summary', 'json-summary'],
    },
  },
});
