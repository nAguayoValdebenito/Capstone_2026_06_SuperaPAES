// Lectura y validación de las variables de entorno. La API no arranca si falta algo obligatorio.
// Los parámetros de negocio (cupos, bonos, topes, plazos) no van aquí: viven en contenido.configuracion.
import { z } from 'zod';

const textoOpcional = z
  .string()
  .trim()
  .optional()
  .transform((valor) => (valor === '' ? undefined : valor));

/** Puerto TCP; un valor vacío cuenta como no definido. */
const puerto = z.preprocess(
  (valor) => (typeof valor === 'string' && valor.trim() === '' ? undefined : valor),
  z.coerce.number().int().min(1).max(65535).optional(),
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
  PROVEEDOR_IA: z.enum(['simulado', 'deepseek', 'gemini']).default('simulado'),
  DEEPSEEK_API_KEY: textoOpcional,
  GEMINI_API_KEY: textoOpcional,
  PROVEEDOR_CORREO: z.enum(['consola', 'smtp']).default('consola'),
  SMTP_HOST: textoOpcional,
  SMTP_PORT: puerto,
  CORREO_REMITENTE: textoOpcional,
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
  [(v) => v.PROVEEDOR_IA === 'gemini', 'PROVEEDOR_IA=gemini', ['GEMINI_API_KEY']],
  [
    (v) => v.PROVEEDOR_CORREO === 'smtp',
    'PROVEEDOR_CORREO=smtp',
    ['SMTP_HOST', 'SMTP_PORT', 'CORREO_REMITENTE'],
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

const esquema = esquemaBase.superRefine((v, ctx) => {
  if (v.JWT_SECRETO_CONSOLA === v.JWT_SECRETO_APP) {
    ctx.addIssue({
      code: 'custom',
      path: ['JWT_SECRETO_APP'],
      message: 'debe ser distinto de JWT_SECRETO_CONSOLA',
    });
  }
  if (v.NODE_ENV === 'production') {
    for (const [variable, valor, mensaje] of PROHIBIDOS_EN_PRODUCCION) {
      if (v[variable] === valor)
        ctx.addIssue({ code: 'custom', path: [variable], message: mensaje });
    }
  }
  for (const [aplica, motivo, variables] of EXIGIDAS_POR_PROVEEDOR) {
    if (!aplica(v)) continue;
    for (const variable of variables) {
      if (v[variable] === undefined) {
        ctx.addIssue({ code: 'custom', path: [variable], message: `obligatoria con ${motivo}` });
      }
    }
  }
});

export type ConfiguracionIA =
  { proveedor: 'simulado' } | { proveedor: 'deepseek' | 'gemini'; claveApi: string };

export type ConfiguracionCorreo =
  { proveedor: 'consola' } | { proveedor: 'smtp'; host: string; puerto: number; remitente: string };

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

export interface Configuracion {
  entorno: 'development' | 'test' | 'production';
  puerto: number;
  baseDeDatos: { url: string; ssl: boolean };
  corsOrigenes: string[];
  jwt: { secretoConsola: string; secretoApp: string };
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
    ia: leerConfiguracionIA(v),
    correo: leerConfiguracionCorreo(v),
    pagos: leerConfiguracionPagos(v),
  };
}

// Tras la validación, las variables del proveedor elegido existen: `?? ''` solo satisface al tipo.
function leerConfiguracionIA(v: Variables): ConfiguracionIA {
  if (v.PROVEEDOR_IA === 'simulado') return { proveedor: 'simulado' };
  const claveApi = v.PROVEEDOR_IA === 'gemini' ? v.GEMINI_API_KEY : v.DEEPSEEK_API_KEY;
  return { proveedor: v.PROVEEDOR_IA, claveApi: claveApi ?? '' };
}

function leerConfiguracionCorreo(v: Variables): ConfiguracionCorreo {
  if (v.PROVEEDOR_CORREO === 'consola') return { proveedor: 'consola' };
  return {
    proveedor: 'smtp',
    host: v.SMTP_HOST ?? '',
    puerto: v.SMTP_PORT ?? 0,
    remitente: v.CORREO_REMITENTE ?? '',
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
