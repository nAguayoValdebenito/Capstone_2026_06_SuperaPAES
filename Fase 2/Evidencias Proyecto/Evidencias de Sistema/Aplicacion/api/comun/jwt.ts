// Tokens de acceso (JWT HS256). La app y la consola usan secretos, audiencias y emisores distintos:
// un token de la app nunca sirve en la consola ni al revés. Cada token lleva el id de su sesión
// (`sid`, fila de app.token_sesion) para que cerrar la sesión lo deje sin efecto (RNF-01).
import { errors, jwtVerify, SignJWT } from 'jose';
import type { JWTPayload } from 'jose';
import { esRolCuentaInterna, type RolCuentaInterna } from './roles.js';

const ALGORITMO = 'HS256';

export type Audiencia = 'app' | 'admin';

const EMISORES: { [A in Audiencia]: string } = {
  app: 'supera-paes-app',
  admin: 'supera-paes-consola',
};

export interface ClaimsApp {
  sub: string;
  sid: string;
}

export interface ClaimsAdmin {
  sub: string;
  sid: string;
  rol: RolCuentaInterna;
}

export interface ClaimsPorAudiencia {
  app: ClaimsApp;
  admin: ClaimsAdmin;
}

/** Desde cuándo y por cuántos segundos vale un token (la hora viene del reloj inyectado). */
export interface Vigencia {
  desde: Date;
  segundos: number;
}

const codificador = new TextEncoder();

type LectorClaims<A extends Audiencia> = (payload: JWTPayload) => ClaimsPorAudiencia[A] | null;

const esTexto = (valor: unknown): valor is string => typeof valor === 'string' && valor !== '';

/** Cada audiencia sabe leer sus propios datos del token ya verificado. */
const LECTORES: { [A in Audiencia]: LectorClaims<A> } = {
  app: ({ sub, sid }) => (esTexto(sub) && esTexto(sid) ? { sub, sid } : null),
  admin: ({ sub, sid, rol }) =>
    esTexto(sub) && esTexto(sid) && esRolCuentaInterna(rol) ? { sub, sid, rol } : null,
};

const enSegundos = (fecha: Date) => Math.floor(fecha.getTime() / 1000);

export async function firmarToken<A extends Audiencia>(
  audiencia: A,
  claims: ClaimsPorAudiencia[A],
  secreto: string,
  { desde, segundos }: Vigencia,
): Promise<string> {
  const { sub, ...resto } = claims;
  return new SignJWT(resto)
    .setProtectedHeader({ alg: ALGORITMO })
    .setSubject(sub)
    .setIssuer(EMISORES[audiencia])
    .setAudience(audiencia)
    .setIssuedAt(enSegundos(desde))
    .setExpirationTime(enSegundos(desde) + segundos)
    .sign(codificador.encode(secreto));
}

/** Devuelve los datos del token o `null` si es inválido, vencido a la hora `ahora` o de otra audiencia. */
export async function verificarToken<A extends Audiencia>(
  audiencia: A,
  token: string,
  secreto: string,
  ahora: Date,
): Promise<ClaimsPorAudiencia[A] | null> {
  try {
    const { payload } = await jwtVerify(token, codificador.encode(secreto), {
      algorithms: [ALGORITMO],
      issuer: EMISORES[audiencia],
      audience: audiencia,
      currentDate: ahora,
    });
    return leerClaims(audiencia, payload);
  } catch (error) {
    if (error instanceof errors.JOSEError) return null;
    throw error;
  }
}

function leerClaims<A extends Audiencia>(
  audiencia: A,
  payload: JWTPayload,
): ClaimsPorAudiencia[A] | null {
  const lector: LectorClaims<A> = LECTORES[audiencia];
  return lector(payload);
}
