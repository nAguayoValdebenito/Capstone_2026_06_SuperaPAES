// Entorno de las pruebas de sesión con PostgreSQL real (ver base-temporal.ts): una base temporal
// migrada, la app sobre el pool y la unidad de trabajo de producción, y un reloj que se adelanta para
// simular el paso del tiempo (la base compara con la hora que entrega el reloj, no con now()).
// Cada prueba empieza con las sesiones, los estudiantes y las cuentas internas vacíos, y con el buzón
// de correos vacío: el proveedor de correo de estas apps guarda los mensajes en vez de enviarlos.
import type { Express } from 'express';
import type { MensajeCorreo, ProveedorCorreo } from '../adaptadores/fabrica.js';
import type pg from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { crearApp, type Dependencias } from '../app.js';
import type { OpcionesLimiteIntentos } from '../comun/middleware/limite-intentos.js';
import { crearPool } from '../db/conexion.js';
import { crearPrimerAdministrador } from '../db/primer-administrador.js';
import { crearUnidadDeTrabajo, type UnidadDeTrabajo } from '../db/transaccion.js';
import { crearDependenciasDePrueba } from './ayudantes.js';
import { crearBaseTemporal, MINUTO, vaciarCuentasInternas, vaciarTablas } from './base-temporal.js';

export interface EntornoSesiones {
  /** Conexión a la base temporal, para preparar datos y revisar app.token_sesion. */
  bd: pg.Client;
  /** La unidad de trabajo del pool de la app, por ejemplo para envolverla con una barrera. */
  unidadDeTrabajo: UnidadDeTrabajo;
  /** App sobre la base real, con el límite de intentos por defecto. */
  app: Express;
  /** App nueva (contadores en cero) con un límite de intentos propio. */
  crearAppConLimite(limite: OpcionesLimiteIntentos): Express;
  /** App nueva sobre la misma base con dependencias cambiadas (por ejemplo, cubrePrueba). */
  crearAppCon(cambios: Partial<Dependencias>): Express;
  /** App nueva sobre la misma base que usa un proveedor de correo real de integración. */
  crearAppConCorreo(correo: ProveedorCorreo): Express;
  /** Hora del reloj de la app. */
  ahora(): Date;
  avanzarSegundos(segundos: number): void;
  /** Pone el reloj de la app en una hora exacta (por ejemplo, justo antes de las 00:00 de Chile). */
  fijarHora(hora: Date): void;
  /** Crea el primer administrador (como el comando crear-admin) y devuelve sus credenciales. */
  crearAdmin(): Promise<{ correo: string; contrasena: string }>;
  /** Correos que la app intentó enviar, en orden (también los que fallaron). */
  correos: MensajeCorreo[];
  /** Hace que el proveedor de correo falle desde ahora (true) o vuelva a funcionar (false). */
  fallarCorreo(fallar: boolean): void;
  /** Espera las tareas de correo que la API lanzó sin retrasar sus respuestas. */
  esperarSegundoPlano(): Promise<void>;
}

/** Proveedor de correo de prueba: guarda cada mensaje y, si se pide, falla después de guardarlo. */
function crearBuzon() {
  const correos: MensajeCorreo[] = [];
  let falla = false;
  const proveedor: ProveedorCorreo = {
    nombre: 'consola',
    enviar: (mensaje) => {
      correos.push(mensaje);
      return falla ? Promise.reject(new Error(`SMTP rechazó ${mensaje.para}`)) : Promise.resolve();
    },
  };
  return {
    proveedor,
    correos,
    fallar: (valor: boolean) => {
      falla = valor;
    },
  };
}

const ADMIN = { nombre: 'Ana Admin', correo: 'ana@ejemplo.cl', contrasena: 'clave-de-ana-1' };

/** Registra los ganchos de la base temporal en el describe que lo llama. */
export function usarBaseDeSesiones(prefijo: string): EntornoSesiones {
  let ahora = new Date();
  let base: Awaited<ReturnType<typeof crearBaseTemporal>>;
  let pool: pg.Pool;
  const entorno = {} as EntornoSesiones;
  const buzon = crearBuzon();
  /** Tareas en segundo plano de la API: la prueba las espera para ver su efecto de forma determinista. */
  const pendientes = new Set<Promise<void>>();
  const segundoPlano = (tarea: () => Promise<void>) => {
    const ejecucion = tarea().finally(() => pendientes.delete(ejecucion));
    pendientes.add(ejecucion);
  };

  const crearAppSobreElPool = (
    cambios: Partial<Dependencias> = {},
    correo: ProveedorCorreo = buzon.proveedor,
  ) => {
    const dependencias = crearDependenciasDePrueba({
      bd: pool,
      unidadDeTrabajo: crearUnidadDeTrabajo(pool),
      reloj: () => new Date(ahora),
      ...cambios,
    });
    // Comprobación real de la cuenta de cada token de la consola, contra PostgreSQL.
    delete dependencias.verificarCuentaInterna;
    return crearApp({
      ...dependencias,
      proveedores: { ...dependencias.proveedores, correo },
      segundoPlano,
    });
  };

  beforeAll(async () => {
    base = await crearBaseTemporal(prefijo);
    pool = crearPool({ url: base.url, ssl: false });
    Object.assign(entorno, {
      bd: base.bd,
      unidadDeTrabajo: crearUnidadDeTrabajo(pool),
      app: crearAppSobreElPool(),
      crearAppConLimite: (limiteIntentos: OpcionesLimiteIntentos) =>
        crearAppSobreElPool({ limiteIntentos }),
      crearAppCon: crearAppSobreElPool,
      crearAppConCorreo: (correo: ProveedorCorreo) => crearAppSobreElPool({}, correo),
      correos: buzon.correos,
      fallarCorreo: buzon.fallar,
      esperarSegundoPlano: async () => {
        await Promise.all([...pendientes]);
      },
      ahora: () => new Date(ahora),
      avanzarSegundos: (segundos: number) => {
        ahora = new Date(ahora.getTime() + segundos * 1000);
      },
      fijarHora: (hora: Date) => {
        ahora = new Date(hora);
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

  afterEach(async () => {
    await Promise.all([...pendientes]);
  });

  beforeEach(async () => {
    ahora = new Date(Math.floor(Date.now() / 1000) * 1000);
    await vaciarTablas(base.bd, ['app.token_sesion', 'app.estudiante']);
    await vaciarCuentasInternas(base.bd);
    buzon.correos.length = 0;
    buzon.fallar(false);
  });

  return entorno;
}
