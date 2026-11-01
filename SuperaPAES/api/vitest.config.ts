import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { configDefaults, defineConfig } from 'vitest/config';

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
const suitesPostgres = [
  'pruebas/**/*-bd.test.ts',
  'pruebas/primer-administrador.test.ts',
  'pruebas/transaccion.test.ts',
];

export default defineConfig({
  test: {
    environment: 'node',
    env: urlPruebas ? { DATABASE_URL_PRUEBAS: urlPruebas } : {},
    // Varios archivos crean y migran bases temporales a la vez; limitar los workers evita
    // que esa carga haga exceder los 5 s de las pruebas de selección con PostgreSQL.
    maxWorkers: 4,
    projects: [
      {
        extends: true,
        test: {
          name: 'sin-postgres',
          include: ['pruebas/**/*.test.ts'],
          exclude: [...configDefaults.exclude, ...suitesPostgres],
        },
      },
      {
        extends: true,
        test: {
          name: 'postgresql',
          include: suitesPostgres,
          // Las operaciones reales pueden esperar I/O y checkpoints al crear o borrar bases.
          testTimeout: 20_000,
          // Conserva el MINUTO que ya usan los hooks explícitos de preparación y cierre.
          hookTimeout: 60_000,
        },
      },
    ],
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
