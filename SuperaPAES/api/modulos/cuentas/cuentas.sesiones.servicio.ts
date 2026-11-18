// Renovación de las sesiones de la app y de la consola (RNF-01), en el módulo cuentas: rota el token de
// renovación dentro de su familia y detecta su reuso. cuentas.servicio.ts la expone en su servicio y le
// entrega cómo abrir la sesión nueva (la misma función del ingreso y el registro).
//
// Reuso: cada ingreso o registro abre una familia; renovar consume la sesión, abre la siguiente en la
// misma familia y deja la consumida marcada como reemplazada. Si alguien presenta otra vez un token ya
// reemplazado, el token se copió: se cierran las sesiones abiertas de esa familia (no las de otros
// ingresos de la misma cuenta) en una transacción propia, confirmada antes de responder el mismo 401.
import { createHash } from 'node:crypto';
import { ErrorNoAutenticado } from '../../comun/errores.js';
import type { Audiencia } from '../../comun/jwt.js';
import { registro } from '../../comun/registro.js';
import type { Reloj } from '../../comun/reloj.js';
import type { RolCuentaInterna } from '../../comun/roles.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { CuentasRepositorio, DuenoSesion, SesionConsumida } from './cuentas.repositorio.js';

/** app.token_sesion.dispositivo es VARCHAR(100). */
export const LARGO_DISPOSITIVO = 100;

export interface SesionIniciada {
  tokenAcceso: string;
  tokenRenovacion: string;
}

/**
 * Lo que lleva la sesión además de la cuenta: su tipo (con el rol, en la consola), el dispositivo y, al
 * renovar, la sesión consumida (la nueva hereda su familia).
 */
export type DatosToken = {
  dispositivo: string | null;
  rota?: Pick<SesionConsumida, 'id' | 'familia'>;
} & ({ tipo: 'app' } | { tipo: 'admin'; rol: RolCuentaInterna });

export const hashDe = (token: string) => createHash('sha256').update(token).digest('hex');

const SESION_TERMINADA = 'La sesión venció o se cerró. Vuelve a iniciar sesión.';

export const errorSesion = () => new ErrorNoAutenticado(SESION_TERMINADA);

export interface DependenciasRenovacion {
  repositorio: Pick<CuentasRepositorio, 'consumirSesion' | 'revocarFamiliaReusada'>;
  unidadDeTrabajo: UnidadDeTrabajo;
  administracion: Pick<AdministracionServicio, 'obtenerUsuarioInterno'>;
  reloj: Reloj;
  abrirSesion(cuentaId: string, datos: DatosToken, tx: Ejecutor): Promise<SesionIniciada>;
}

/** En la consola el rol se lee de nuevo: un cambio de rol rige desde la renovación. */
async function datosDelToken(
  { administracion }: DependenciasRenovacion,
  dueno: DuenoSesion,
  tx: Ejecutor,
): Promise<DatosToken> {
  const { tipo, cuentaId, dispositivo } = dueno;
  if (tipo === 'app') return { tipo, dispositivo };
  const usuario = await administracion.obtenerUsuarioInterno(cuentaId, tx);
  if (!usuario?.activo) throw errorSesion();
  return { tipo, rol: usuario.rol, dispositivo };
}

/** Su propia transacción: queda confirmada aunque después se responda 401. Nunca registra el token. */
async function revocarSiFueReusado(
  { repositorio, unidadDeTrabajo, reloj }: DependenciasRenovacion,
  tipo: Audiencia,
  hash: string,
): Promise<void> {
  const reuso = await unidadDeTrabajo.enTransaccion((tx) =>
    repositorio.revocarFamiliaReusada(tipo, hash, reloj(), tx),
  );
  if (!reuso) return;
  registro.info(
    'Se reusó un token de renovación ya rotado: se cerraron las sesiones de su familia',
    {
      evento: 'reuso_token_renovacion',
      tipo,
      cuentaId: reuso.cuentaId,
    },
  );
}

/**
 * Rota el token: revoca la sesión usada y abre otra en su familia. Revocado, vencido, de otro tipo o
 * desconocido: 401. Con `dispositivo`, la sesión nueva lo guarda; sin él, conserva el de la usada.
 */
export async function renovarSesion(
  dependencias: DependenciasRenovacion,
  tipo: Audiencia,
  tokenRenovacion: string,
  dispositivo: string | undefined,
): Promise<SesionIniciada> {
  const { repositorio, unidadDeTrabajo, reloj } = dependencias;
  const hash = hashDe(tokenRenovacion);
  const sesion = await unidadDeTrabajo.enTransaccion(async (tx) => {
    const dueno = await repositorio.consumirSesion(tipo, hash, reloj(), tx);
    if (!dueno) return null;
    const datos = await datosDelToken(dependencias, dueno, tx);
    const nuevo = dispositivo?.slice(0, LARGO_DISPOSITIVO) || datos.dispositivo;
    return dependencias.abrirSesion(
      dueno.cuentaId,
      { ...datos, dispositivo: nuevo, rota: dueno },
      tx,
    );
  });
  if (sesion) return sesion;
  await revocarSiFueReusado(dependencias, tipo, hash);
  throw errorSesion();
}
