import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['pruebas/**/*.test.ts'],
    environment: 'node',
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
