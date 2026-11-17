// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { reglasCalidad } from '../eslint.reglas-calidad.js';
import { reglasArquitectura } from './eslint.reglas-arquitectura.js';

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['pruebas/**/*.ts'],
    rules: {
      // Supertest entrega el cuerpo como any; en pruebas se acepta.
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
  ...reglasCalidad,
  {
    // Excepciones de no-console: registro.ts es el propio registro de eventos, y los scripts de
    // db/scripts son de línea de comandos y escriben su resultado para quien los ejecuta.
    files: ['comun/registro.ts', 'db/scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  ...reglasArquitectura,
  {
    files: ['eslint.config.js', 'eslint.reglas-arquitectura.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
