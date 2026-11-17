// @ts-check
// Reglas de calidad compartidas por la API y la consola (umbrales del equipo).
// Cada configuración de ESLint las agrega antes de su bloque `disableTypeChecked`. Todas son errores:
// una regla nueva se agrega aquí recién cuando el código ya la cumple.
import sonarjs from 'eslint-plugin-sonarjs';

/** @type {import('eslint').Linter.Config[]} */
export const reglasCalidad = [
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { sonarjs },
    rules: {
      complexity: ['error', 10],
      'max-depth': ['error', 3],
      'max-params': ['error', 4],
      'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      'sonarjs/cognitive-complexity': ['error', 15],
      'sonarjs/no-identical-functions': 'error',
    },
  },
  {
    // En las pruebas, un describe agrupa muchos casos: el largo de la función no indica complejidad.
    files: ['**/*.test.{ts,tsx}', 'pruebas/**/*.ts'],
    rules: { 'max-lines-per-function': 'off' },
  },
];
