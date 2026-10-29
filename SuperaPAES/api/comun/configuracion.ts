// Lectura y validación de las variables de entorno. La API no arranca si falta algo obligatorio.
// Los parámetros de negocio (cupos, bonos, topes, plazos) no van aquí: viven en contenido.configuracion.
import { z } from 'zod';
import {
  leerConfiguracionCorreo,
  problemasDeSmtp,
  type ConfiguracionCorreo,
} from './configuracion-smtp.js';

export type { ConfiguracionCorreo } from './configuracion-smtp.js';

const textoOpcional = z
  .string()
  .trim()
  .optional()
  .transform((valor) => (valor === '' ? undefined : valor));

const secretoOpcional = z
  .string()
  .optional()
  .transform((valor) => (valor === '' ? undefined : valor));

/** Puerto TCP; un valor vacío cuenta como no definido. */
const puerto = z.preprocess(
  (valor) => (typeof valor === 'string' && valor.trim() === '' ? undefined : valor),
  z.coerce.number().int().min(1).max(65535).optional(),
);

const milisegundos = z.preprocess(
  (valor) => (typeof valor === 'string' && valor.trim() === '' ? undefined : valor),
  z.coerce.number().int().min(100).max(60_000).optional(),
);

const SECRETO_MINIMO = 32;

const esquemaBase = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: puerto,
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  DATABASE_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((valor) => valor === 'true'),
  CORS_ORIGENES: z.string().default(''),
  JWT_SECRETO_CONSOLA: z.string().min(SECRETO_MINIMO),
  JWT_SECRETO_APP: z.string().min(SECRETO_MINIMO),
  /** Dirección pública de la consola: los correos enlazan a sus páginas (por ejemplo /verificar-correo). */
  URL_CONSOLA: z.url({ protocol: /^https?$/ }).transform((valor) => valor.replace(/\/+$/, '')),
  /** Clave del HMAC-SHA-256 con que se guarda el código de 6 dígitos del correo de verificación (RN-32). */
  CLAVE_CODIGO_CORREO: z.string().min(SECRETO_MINIMO),
  PROVEEDOR_IA: z.enum(['simulado', 'deepseek', 'gemini']).default('simulado'),
  DEEPSEEK_API_KEY: textoOpcional,
  GEMINI_API_KEY: textoOpcional,
  GEMINI_MODELO: textoOpcional,
  PROVEEDOR_CORREO: z.enum(['consola', 'smtp']).default('consola'),
  SMTP_HOST: textoOpcional,
  SMTP_PORT: puerto,
  SMTP_TLS: z.preprocess(
    (valor) => (valor === '' ? undefined : valor),
    z.enum(['none', 'starttls', 'implicit']).optional(),
  ),
  SMTP_USUARIO: textoOpcional,
  SMTP_CLAVE: secretoOpcional,
  CORREO_REMITENTE: z.preprocess(
    (valor) => (valor === '' ? undefined : valor),
    z.email().optional(),
  ),
  SMTP_TIMEOUT_MS: milisegundos,
  PROVEEDOR_PAGOS: z.enum(['simulado', 'tiendas']).default('simulado'),
  GOOGLE_PLAY_PAQUETE: textoOpcional,
  GOOGLE_PLAY_CUENTA_SERVICIO: textoOpcional,
  GOOGLE_PLAY_PUBSUB_AUDIENCIA: textoOpcional,
  APP_STORE_BUNDLE_ID: textoOpcional,
  APP_STORE_ID_EMISOR: textoOpcional,
  APP_STORE_ID_CLAVE: textoOpcional,
  APP_STORE_CLAVE_PRIVADA: textoOpcional,
  APP_STORE_ENTORNO: z.preprocess(
    (valor) => (valor === '' ? undefined : valor),
    z.enum(['sandbox', 'produccion']).optional(),
  ),
});

type Variables = z.output<typeof esquemaBase>;

/** Variables que solo se exigen con el proveedor indicado. */
const EXIGIDAS_POR_PROVEEDOR: [(v: Variables) => boolean, string, (keyof Variables)[]][] = [
  [(v) => v.PROVEEDOR_IA === 'deepseek', 'PROVEEDOR_IA=deepseek', ['DEEPSEEK_API_KEY']],
  [(v) => v.PROVEEDOR_IA === 'gemini', 'PROVEEDOR_IA=gemini', ['GEMINI_API_KEY', 'GEMINI_MODELO']],
  [
    (v) => v.PROVEEDOR_IA === 'deepseek' && v.GEMINI_API_KEY !== undefined,
    'respaldo con Gemini',
    ['GEMINI_MODELO'],
  ],
  [
    (v) => v.PROVEEDOR_CORREO === 'smtp',
    'PROVEEDOR_CORREO=smtp',
    ['SMTP_HOST', 'SMTP_PORT', 'SMTP_TLS', 'CORREO_REMITENTE'],
  ],
  [
    (v) => v.PROVEEDOR_PAGOS === 'tiendas',
    'PROVEEDOR_PAGOS=tiendas',
    [
      'GOOGLE_PLAY_PAQUETE',
      'GOOGLE_PLAY_CUENTA_SERVICIO',
      'GOOGLE_PLAY_PUBSUB_AUDIENCIA',
      'APP_STORE_BUNDLE_ID',
      'APP_STORE_ID_EMISOR',
      'APP_STORE_ID_CLAVE',
      'APP_STORE_CLAVE_PRIVADA',
      'APP_STORE_ENTORNO',
    ],
  ],
];

/** Proveedores de desarrollo que nunca deben llegar a producción, aunque falte la variable. */
const PROHIBIDOS_EN_PRODUCCION: [keyof Variables, string, string][] = [
  // La pasarela simulada aprueba compras y acepta avisos sin firma.
  [
    'PROVEEDOR_PAGOS',
    'simulado',
    'en producción debe ser tiendas (la pasarela simulada no verifica pagos)',
  ],
  // El correo de consola no envía nada: nadie podría verificar su correo ni recuperar su cuenta.
  ['PROVEEDOR_CORREO', 'consola', 'en producción debe ser smtp (consola no envía los correos)'],
  // La IA simulada devuelve siempre la misma pregunta.
  [
    'PROVEEDOR_IA',
    'simulado',
    'en producción debe ser deepseek o gemini (simulado devuelve una pregunta fija)',
  ],
];

type Problema = [keyof Variables, string];

/** Secretos que no pueden repetirse: si se filtra uno, los demás siguen protegiendo lo suyo. */
function problemasDeSecretos(v: Variables): Problema[] {
  const problemas: Problema[] = [];
  if (v.JWT_SECRETO_CONSOLA === v.JWT_SECRETO_APP) {
    problemas.push(['JWT_SECRETO_APP', 'debe ser distinto de JWT_SECRETO_CONSOLA']);
  }
  if ([v.JWT_SECRETO_CONSOLA, v.JWT_SECRETO_APP].includes(v.CLAVE_CODIGO_CORREO)) {
    problemas.push(['CLAVE_CODIGO_CORREO', 'debe ser distinta de los secretos JWT']);
  }
  return problemas;
}

/** La consola llama a la API desde el navegador: su dirección debe estar en CORS_ORIGENES. */
function problemasDeConsola(v: Variables): Problema[] {
  const problemas: Problema[] = [];
  const origen = new URL(v.URL_CONSOLA).origin;
  const origenes = v.CORS_ORIGENES.split(',').map((o) => o.trim().replace(/\/+$/, ''));
  if (!origenes.includes(origen)) {
    problemas.push(['CORS_ORIGENES', `debe incluir el origen de URL_CONSOLA (${origen})`]);
  }
  if (v.NODE_ENV === 'production' && !v.URL_CONSOLA.startsWith('https://')) {
    problemas.push(['URL_CONSOLA', 'en producción debe usar https']);
  }
  return problemas;
}

function problemasDeProduccion(v: Variables): Problema[] {
  if (v.NODE_ENV !== 'production') return [];
  return PROHIBIDOS_EN_PRODUCCION.filter(([variable, valor]) => v[variable] === valor).map(
    ([variable, , mensaje]): Problema => [variable, mensaje],
  );
}

function problemasDeProveedores(v: Variables): Problema[] {
  return EXIGIDAS_POR_PROVEEDOR.filter(([aplica]) => aplica(v)).flatMap(([, motivo, variables]) =>
    variables
      .filter((variable) => v[variable] === undefined)
      .map((variable): Problema => [variable, `obligatoria con ${motivo}`]),
  );
}

const esquema = esquemaBase.superRefine((v, ctx) => {
  const problemas = [
    ...problemasDeSecretos(v),
    ...problemasDeConsola(v),
    ...problemasDeProduccion(v),
    ...problemasDeProveedores(v),
    ...problemasDeSmtp(v),
  ];
  for (const [variable, mensaje] of problemas) {
    ctx.addIssue({ code: 'custom', path: [variable], message: mensaje });
  }
});

export type ConfiguracionIA =
  | { proveedor: 'simulado' }
  | { proveedor: 'gemini'; claveApi: string; modelo: string }
  | { proveedor: 'deepseek'; claveApi: string; respaldo?: { claveApi: string; modelo: string } };

export interface ConfiguracionGooglePlay {
  paquete: string;
  /** Ruta o contenido del JSON de la cuenta de servicio de la Google Play Developer API. */
  cuentaServicio: string;
  /** Audiencia esperada en el token de los envíos de Cloud Pub/Sub. */
  audienciaPubSub: string;
}

export interface ConfiguracionAppStore {
  bundleId: string;
  idEmisor: string;
  idClave: string;
  clavePrivada: string;
  entorno: 'sandbox' | 'produccion';
}

export type ConfiguracionPagos =
  | { proveedor: 'simulado' }
  | { proveedor: 'tiendas'; googlePlay: ConfiguracionGooglePlay; appStore: ConfiguracionAppStore };

/** Lo que necesita el correo de verificación (RN-32): la página de la consola y la clave del código. */
export interface ConfiguracionVerificacionCorreo {
  urlConsola: string;
  claveCodigo: string;
}

export interface Configuracion {
  entorno: 'development' | 'test' | 'production';
  puerto: number;
  baseDeDatos: { url: string; ssl: boolean };
  corsOrigenes: string[];
  jwt: { secretoConsola: string; secretoApp: string };
  verificacionCorreo: ConfiguracionVerificacionCorreo;
  ia: ConfiguracionIA;
  correo: ConfiguracionCorreo;
  pagos: ConfiguracionPagos;
}

export class ErrorConfiguracion extends Error {
  constructor(problemas: string[]) {
    super(`Configuración inválida:\n${problemas.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ErrorConfiguracion';
  }
}

export function leerConfiguracion(
  entorno: Record<string, string | undefined> = process.env,
): Configuracion {
  const v = parsear(esquema, entorno);
  return {
    entorno: v.NODE_ENV,
    puerto: v.PORT ?? 3000,
    baseDeDatos: { url: v.DATABASE_URL, ssl: v.DATABASE_SSL },
    corsOrigenes: v.CORS_ORIGENES.split(',')
      .map((origen) => origen.trim())
      .filter(Boolean),
    jwt: { secretoConsola: v.JWT_SECRETO_CONSOLA, secretoApp: v.JWT_SECRETO_APP },
    verificacionCorreo: { urlConsola: v.URL_CONSOLA, claveCodigo: v.CLAVE_CODIGO_CORREO },
    ia: leerConfiguracionIA(v),
    correo: leerConfiguracionCorreo(v),
    pagos: leerConfiguracionPagos(v),
  };
}

// Tras la validación, las variables del proveedor elegido existen: `?? ''` solo satisface al tipo.
function leerConfiguracionIA(v: Variables): ConfiguracionIA {
  if (v.PROVEEDOR_IA === 'simulado') return { proveedor: 'simulado' };
  if (v.PROVEEDOR_IA === 'gemini') {
    return { proveedor: 'gemini', claveApi: v.GEMINI_API_KEY ?? '', modelo: v.GEMINI_MODELO ?? '' };
  }
  return {
    proveedor: 'deepseek',
    claveApi: v.DEEPSEEK_API_KEY ?? '',
    ...(v.GEMINI_API_KEY !== undefined && {
      respaldo: { claveApi: v.GEMINI_API_KEY, modelo: v.GEMINI_MODELO ?? '' },
    }),
  };
}

function leerConfiguracionPagos(v: Variables): ConfiguracionPagos {
  if (v.PROVEEDOR_PAGOS === 'simulado') return { proveedor: 'simulado' };
  return {
    proveedor: 'tiendas',
    googlePlay: {
      paquete: v.GOOGLE_PLAY_PAQUETE ?? '',
      cuentaServicio: v.GOOGLE_PLAY_CUENTA_SERVICIO ?? '',
      audienciaPubSub: v.GOOGLE_PLAY_PUBSUB_AUDIENCIA ?? '',
    },
    appStore: {
      bundleId: v.APP_STORE_BUNDLE_ID ?? '',
      idEmisor: v.APP_STORE_ID_EMISOR ?? '',
      idClave: v.APP_STORE_ID_CLAVE ?? '',
      clavePrivada: v.APP_STORE_CLAVE_PRIVADA ?? '',
      entorno: v.APP_STORE_ENTORNO ?? 'sandbox',
    },
  };
}

/** Solo los datos de conexión: los scripts de base de datos no necesitan los secretos de la API. */
export function leerConfiguracionBaseDeDatos(
  entorno: Record<string, string | undefined> = process.env,
): Configuracion['baseDeDatos'] {
  const v = parsear(esquemaBase.pick({ DATABASE_URL: true, DATABASE_SSL: true }), entorno);
  return { url: v.DATABASE_URL, ssl: v.DATABASE_SSL };
}

function parsear<T>(esquema: z.ZodType<T>, entorno: Record<string, string | undefined>): T {
  const resultado = esquema.safeParse(entorno);
  if (!resultado.success) {
    // Solo se informa el nombre de la variable y el problema, nunca su valor.
    throw new ErrorConfiguracion(
      resultado.error.issues.map((i) => `${i.path.join('.')}: ${traducirProblema(i)}`),
    );
  }
  return resultado.data;
}

function traducirProblema(problema: z.core.$ZodIssue): string {
  if (problema.code === 'custom') return problema.message;
  if (problema.code === 'invalid_type') return 'obligatoria o con tipo inválido';
  if (problema.code === 'too_small') {
    return problema.origin === 'string'
      ? `demasiado corta (mínimo ${String(problema.minimum)} caracteres)`
      : `menor que el mínimo (${String(problema.minimum)})`;
  }
  if (problema.code === 'too_big') return `mayor que el máximo (${String(problema.maximum)})`;
  if (problema.code === 'invalid_value') return 'valor no permitido';
  if (problema.code === 'invalid_format') return 'formato inválido';
  return 'valor inválido';
}
