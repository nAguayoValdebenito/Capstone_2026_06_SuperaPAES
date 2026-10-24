// Entorno de las pruebas de sesión con PostgreSQL real (ver base-temporal.ts): una base temporal
// migrada, la app sobre el pool y la unidad de trabajo de producción, y un reloj que se adelanta para
// simular el paso del tiempo (la base compara con la hora que entrega el reloj, no con now()).
// Cada prueba empieza con las sesiones, los estudiantes y las cuentas internas vacíos.
import type { Express } from 'express';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { crearApp } from '../app.js';
import type { OpcionesLimiteIntentos } from '../comun/middleware/limite-intentos.js';
import { crearPool } from '../db/conexion.js';
import { crearPrimerAdministrador } from '../db/primer-administrador.js';
import { crearUnidadDeTrabajo } from '../db/transaccion.js';
import { crearDependenciasDePrueba } from './ayudantes.js';
import { crearBaseTemporal, MINUTO, vaciarCuentasInternas } from './base-temporal.js';

export interface EntornoSesiones {
  /** Conexión a la base temporal, para preparar datos y revisar app.token_sesion. */
  bd: pg.Client;
  /** App sobre la base real, con el límite de intentos por defecto. */
  app: Express;
  /** App nueva (contadores en cero) con un límite de intentos propio. */
  crearAppConLimite(limite: OpcionesLimiteIntentos): Express;
  /** Hora del reloj de la app. */
  ahora(): Date;
  avanzarSegundos(segundos: number): void;
  /** Crea el primer administrador (como el comando crear-admin) y devuelve sus credenciales. */
  crearAdmin(): Promise<{ correo: string; contrasena: string }>;
}

const ADMIN = { nombre: 'Ana Admin', correo: 'ana@ejemplo.cl', contrasena: 'clave-de-ana-1' };

/** Registra los ganchos de la base temporal en el describe que lo llama. */
export function usarBaseDeSesiones(prefijo: string): EntornoSesiones {
  let ahora = new Date();
  let base: Awaited<ReturnType<typeof crearBaseTemporal>>;
  let pool: pg.Pool;
  const entorno = {} as EntornoSesiones;

  const crearAppSobreElPool = (limiteIntentos?: OpcionesLimiteIntentos) =>
    crearApp(
      crearDependenciasDePrueba({
        bd: pool,
        unidadDeTrabajo: crearUnidadDeTrabajo(pool),
        reloj: () => new Date(ahora),
        ...(limiteIntentos && { limiteIntentos }),
      }),
    );

  beforeAll(async () => {
    base = await crearBaseTemporal(prefijo);
    pool = crearPool({ url: base.url, ssl: false });
    Object.assign(entorno, {
      bd: base.bd,
      app: crearAppSobreElPool(),
      crearAppConLimite: crearAppSobreElPool,
      ahora: () => new Date(ahora),
      avanzarSegundos: (segundos: number) => {
        ahora = new Date(ahora.getTime() + segundos * 1000);
      },
      crearAdmin: async () => {
        await crearPrimerAdministrador(base.bd, ADMIN);
        return { correo: ADMIN.correo, contrasena: ADMIN.contrasena };
      },
    });
  }, MINUTO);

  afterAll(async () => {
    await pool.end();
    await base.cerrar();
  }, MINUTO);

  beforeEach(async () => {
    ahora = new Date(Math.floor(Date.now() / 1000) * 1000);
    await base.bd.query('TRUNCATE app.token_sesion, app.estudiante CASCADE');
    await vaciarCuentasInternas(base.bd);
  });

  return entorno;
}
