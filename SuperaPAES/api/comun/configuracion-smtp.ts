// Reglas y mapeo de la configuración SMTP, separados de la configuración general de la API.

export interface VariablesSmtp {
  PROVEEDOR_CORREO: 'consola' | 'smtp';
  SMTP_HOST?: string | undefined;
  SMTP_PORT?: number | undefined;
  SMTP_TLS?: 'none' | 'starttls' | 'implicit' | undefined;
  SMTP_USUARIO?: string | undefined;
  SMTP_CLAVE?: string | undefined;
  CORREO_REMITENTE?: string | undefined;
  SMTP_TIMEOUT_MS?: number | undefined;
}

export type ConfiguracionCorreo =
  | { proveedor: 'consola' }
  | {
      proveedor: 'smtp';
      host: string;
      puerto: number;
      tls: 'none' | 'starttls' | 'implicit';
      usuario: string | undefined;
      clave: string | undefined;
      remitente: string;
      timeoutMs: number;
    };

type ProblemaSmtp = [keyof VariablesSmtp, string];

const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function esLocal(host: string | undefined): boolean {
  return host !== undefined && HOSTS_LOCALES.has(host.toLowerCase());
}

function problemasDeCifrado(v: VariablesSmtp, local: boolean): ProblemaSmtp[] {
  if (v.SMTP_TLS === 'none' && !local) {
    return [['SMTP_TLS', 'solo puede ser none para localhost']];
  }
  if (v.SMTP_TLS === 'implicit' && v.SMTP_PORT !== undefined && v.SMTP_PORT !== 465) {
    return [['SMTP_PORT', 'debe ser 465 con SMTP_TLS=implicit']];
  }
  if (v.SMTP_TLS === 'starttls' && ![587, 2525].includes(v.SMTP_PORT ?? 0)) {
    return [['SMTP_PORT', 'debe ser 587 o 2525 con SMTP_TLS=starttls']];
  }
  return [];
}

function problemasDeCredenciales(v: VariablesSmtp, local: boolean): ProblemaSmtp[] {
  if (local && v.SMTP_USUARIO === undefined && v.SMTP_CLAVE === undefined) return [];
  const problemas: ProblemaSmtp[] = [];
  if (v.SMTP_USUARIO === undefined) {
    problemas.push(['SMTP_USUARIO', 'obligatoria para un servidor SMTP remoto o autenticado']);
  }
  if (v.SMTP_CLAVE === undefined) {
    problemas.push(['SMTP_CLAVE', 'obligatoria para un servidor SMTP remoto o autenticado']);
  }
  return problemas;
}

export function problemasDeSmtp(v: VariablesSmtp): ProblemaSmtp[] {
  if (v.PROVEEDOR_CORREO !== 'smtp') return [];
  const local = esLocal(v.SMTP_HOST);
  return [...problemasDeCifrado(v, local), ...problemasDeCredenciales(v, local)];
}

export function leerConfiguracionCorreo(v: VariablesSmtp): ConfiguracionCorreo {
  if (v.PROVEEDOR_CORREO === 'consola') return { proveedor: 'consola' };
  return {
    proveedor: 'smtp',
    host: v.SMTP_HOST ?? '',
    puerto: v.SMTP_PORT ?? 0,
    tls: v.SMTP_TLS ?? 'none',
    usuario: v.SMTP_USUARIO,
    clave: v.SMTP_CLAVE,
    remitente: v.CORREO_REMITENTE ?? '',
    timeoutMs: v.SMTP_TIMEOUT_MS ?? 10_000,
  };
}
