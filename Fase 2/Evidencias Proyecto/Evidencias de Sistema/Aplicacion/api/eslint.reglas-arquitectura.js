// @ts-check
// Reglas de dependencia del monolito modular, verificadas por ESLint (no-restricted-imports).
// Las usa eslint.config.js y las prueba pruebas/arquitectura.test.ts con importaciones que las violan.
//
// 1. Un módulo usa a otro solo a través de su index.ts (que exporta rutas y servicio), nunca su
//    repositorio ni sus otras capas.
// 2. Dentro de un módulo: rutas → controlador → servicio → repositorio; ninguna capa importa una superior.
// 3. comun/, adaptadores/ y db/ nunca importan módulos, trabajos ni la raíz de composición.

const OTRO_MODULO = {
  regex: String.raw`^\.\./(?!\.\.)[^/]+/(?!index\.js$)`,
  message:
    'Otro módulo solo se usa a través de su index.ts (su servicio), nunca de sus archivos internos.',
};
const OTRO_MODULO_RUTA_LARGA = {
  regex: String.raw`(^|/)modulos/[^/]+/(?!index\.js$)`,
  message:
    'Otro módulo solo se usa a través de su index.ts (su servicio), nunca de sus archivos internos.',
};
const RAIZ_Y_TRABAJOS = {
  regex: String.raw`(^(\.\./)+(app|servidor)\.js$)|((^|/)trabajos/)`,
  message:
    'La raíz de composición (app.ts, servidor.ts) y trabajos/ están por encima de los módulos.',
};
const CUALQUIER_MODULO = {
  regex: String.raw`(^|/)modulos(/|$)`,
  message: 'comun/, adaptadores/ y db/ no dependen de ningún módulo.',
};

/** @param {string} capas @param {string} mensaje */
const capaSuperior = (capas, mensaje) => ({
  regex: String.raw`\.(${capas})\.js$`,
  message: mensaje,
});

const BASE_MODULO = [OTRO_MODULO, OTRO_MODULO_RUTA_LARGA, RAIZ_Y_TRABAJOS];

/** @param {string[]} files @param {object[]} patterns */
const bloque = (files, patterns) => ({
  files,
  rules: { 'no-restricted-imports': ['error', { patterns }] },
});

// En la configuración plana, el último bloque que coincide reemplaza la regla completa:
// por eso cada bloque de capa repite las reglas base del módulo.
export const reglasArquitectura = [
  bloque(['modulos/**/*.ts'], BASE_MODULO),
  bloque(
    ['modulos/**/*.rutas.*.ts'],
    [
      ...BASE_MODULO,
      capaSuperior('repositorio', 'Las rutas llegan al servicio a través del controlador.'),
    ],
  ),
  bloque(
    ['modulos/**/*.controlador.ts'],
    [
      ...BASE_MODULO,
      capaSuperior('repositorio|rutas\\.\\w+', 'El controlador solo usa el servicio de su módulo.'),
    ],
  ),
  bloque(
    ['modulos/**/*.servicio.ts'],
    [
      ...BASE_MODULO,
      capaSuperior(
        'controlador|rutas\\.\\w+',
        'El servicio no conoce HTTP: no importa controladores ni rutas.',
      ),
    ],
  ),
  bloque(
    ['modulos/**/*.repositorio.ts'],
    [
      ...BASE_MODULO,
      capaSuperior(
        'servicio|controlador|rutas\\.\\w+',
        'El repositorio es la capa más baja: no importa servicios, controladores ni rutas.',
      ),
    ],
  ),
  bloque(
    ['modulos/**/*.validadores.ts'],
    [
      ...BASE_MODULO,
      capaSuperior(
        'servicio|controlador|repositorio|rutas\\.\\w+',
        'Los validadores solo describen la entrada: no importan otras capas.',
      ),
    ],
  ),
  bloque(
    ['comun/**/*.ts', 'adaptadores/**/*.ts', 'db/**/*.ts'],
    [CUALQUIER_MODULO, RAIZ_Y_TRABAJOS],
  ),
];
