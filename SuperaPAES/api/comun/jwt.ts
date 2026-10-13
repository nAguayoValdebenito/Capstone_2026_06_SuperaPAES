// Tokens de acceso (JWT HS256). La app y la consola usan secretos y audiencias distintos:
// un token de la app nunca sirve en la consola ni al revés.
import { errors, jwtVerify, SignJWT } from 'jose';
import type { JWTPayload } from 'jose';
import { esRolCuentaInterna, type RolCuentaInterna } from './roles.js';

const EMISOR = 'supera-paes';
const ALGORITMO = 'HS256';

export type Audiencia = 'app' | 'admin';

export interface ClaimsApp {
  sub: string;
}

export interface ClaimsAdmin {
  sub: string;
  rol: RolCuentaInterna;
}

export interface ClaimsPorAudiencia {
  app: ClaimsApp;
  admin: ClaimsAdmin;
}

const codificador = new TextEncoder();

type LectorClaims<A extends Audiencia> = (payload: JWTPayload) => ClaimsPorAudiencia[A] | null;

/** Cada audiencia sabe leer sus propios datos del token ya verificado. */
const LECTORES: { [A in Audiencia]: LectorClaims<A> } = {
  app: ({ sub }) => (typeof sub === 'string' && sub !== '' ? { sub } : null),
  admin: ({ sub, rol }) =>
    typeof sub === 'string' && sub !== '' && esRolCuentaInterna(rol) ? { sub, rol } : null,
};

export async function firmarToken<A extends Audiencia>(
  audiencia: A,
  claims: ClaimsPorAudiencia[A],
  secreto: string,
  duracion: string | number = '15m',
): Promise<string> {
  const { sub, ...resto } = claims;
  return new SignJWT(resto)
    .setProtectedHeader({ alg: ALGORITMO })
    .setSubject(sub)
    .setIssuer(EMISOR)
    .setAudience(audiencia)
    .setIssuedAt()
    .setExpirationTime(duracion)
    .sign(codificador.encode(secreto));
}

/** Devuelve los datos del token o `null` si es inválido, vencido o de otra audiencia. */
export async function verificarToken<A extends Audiencia>(
  audiencia: A,
  token: string,
  secreto: string,
): Promise<ClaimsPorAudiencia[A] | null> {
  try {
    const { payload } = await jwtVerify(token, codificador.encode(secreto), {
      algorithms: [ALGORITMO],
      issuer: EMISOR,
      audience: audiencia,
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
