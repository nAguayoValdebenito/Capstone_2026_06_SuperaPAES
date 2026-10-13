// Las reglas de dependencia del monolito se verifican solas: ESLint falla si se rompen.
// Cada caso lintea un archivo virtual con una importación prohibida (o permitida).
import path from 'node:path';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { reglasArquitectura } from '../eslint.reglas-arquitectura.js';

const raizApi = path.resolve(import.meta.dirname, '..');

const eslint = new ESLint({
  cwd: raizApi,
  overrideConfigFile: true,
  overrideConfig: [
    { files: ['**/*.ts'], languageOptions: { parser: tseslint.parser } },
    ...reglasArquitectura,
  ],
});

async function errores(archivo: string, importacion: string): Promise<string[]> {
  const [resultado] = await eslint.lintText(`import { x } from '${importacion}';\nvoid x;\n`, {
    filePath: path.join(raizApi, archivo),
  });
  return (resultado?.messages ?? [])
    .filter((m) => m.ruleId === 'no-restricted-imports')
    .map((m) => m.message);
}

describe('reglas de dependencia', () => {
  it.each([
    [
      'un módulo importa el repositorio de otro',
      'modulos/practica/practica.servicio.ts',
      '../cupo-invitaciones/cupo-invitaciones.repositorio.js',
    ],
    [
      'un módulo importa el servicio de otro sin pasar por su index',
      'modulos/practica/practica.servicio.ts',
      '../cupo-invitaciones/cupo-invitaciones.servicio.js',
    ],
    [
      'un módulo llega a otro por una ruta larga',
      'modulos/practica/practica.servicio.ts',
      '../../modulos/cuentas/cuentas.repositorio.js',
    ],
    ['comun importa un módulo', 'comun/respuesta.ts', '../modulos/cuentas/index.js'],
    [
      'adaptadores importa un módulo',
      'adaptadores/fabrica.ts',
      '../modulos/suscripciones/index.js',
    ],
    ['db importa un módulo', 'db/transaccion.ts', '../modulos/practica/index.js'],
    [
      'un controlador importa su repositorio',
      'modulos/temario/temario.controlador.ts',
      './temario.repositorio.js',
    ],
    [
      'un repositorio importa su servicio',
      'modulos/temario/temario.repositorio.ts',
      './temario.servicio.js',
    ],
    [
      'un servicio importa su controlador',
      'modulos/temario/temario.servicio.ts',
      './temario.controlador.js',
    ],
    [
      'un servicio importa sus rutas',
      'modulos/temario/temario.servicio.ts',
      './temario.rutas.admin.js',
    ],
    [
      'las rutas importan el repositorio',
      'modulos/temario/temario.rutas.app.ts',
      './temario.repositorio.js',
    ],
    [
      'un módulo importa la raíz de composición',
      'modulos/temario/temario.servicio.ts',
      '../../app.js',
    ],
    [
      'un módulo importa trabajos',
      'modulos/generador/generador.servicio.ts',
      '../../trabajos/worker-generacion.js',
    ],
  ])('falla si %s', async (_caso, archivo, importacion) => {
    expect(await errores(archivo, importacion)).not.toEqual([]);
  });

  it.each([
    [
      'un módulo usa el servicio de otro por su index',
      'modulos/practica/practica.servicio.ts',
      '../cupo-invitaciones/index.js',
    ],
    [
      'el servicio usa su repositorio',
      'modulos/temario/temario.servicio.ts',
      './temario.repositorio.js',
    ],
    [
      'las rutas usan su controlador',
      'modulos/temario/temario.rutas.app.ts',
      './temario.controlador.js',
    ],
    [
      'un módulo usa comun',
      'modulos/temario/temario.rutas.admin.ts',
      '../../comun/middleware/autorizacion.js',
    ],
    ['un módulo usa db', 'modulos/temario/temario.repositorio.ts', '../../db/transaccion.js'],
    [
      'un módulo usa adaptadores',
      'modulos/generador/generador.servicio.ts',
      '../../adaptadores/fabrica.js',
    ],
    [
      'trabajos usa un módulo por su index',
      'trabajos/worker-generacion.ts',
      '../modulos/generador/index.js',
    ],
  ])('permite que %s', async (_caso, archivo, importacion) => {
    expect(await errores(archivo, importacion)).toEqual([]);
  });
});
