// Raíz de composición del monolito: crea los servicios de los módulos con sus dependencias y
// arma la app de Express con el middleware global y el montaje de rutas.
// Recibe las dependencias externas ya construidas para poder reemplazarlas en las pruebas.
import cors from 'cors';
import express, { Router, type Express } from 'express';
import helmet from 'helmet';
import type { Proveedores } from './adaptadores/fabrica.js';
import {
  crearAutenticacion,
  type SecretosJwt,
  type VerificarCuentaInterna,
} from './comun/middleware/autenticacion.js';
import type { MiddlewareRutas } from './comun/middleware/index.js';
import {
  crearFabricaLimiteIntentos,
  LIMITE_INTENTOS_POR_DEFECTO,
  type OpcionesLimiteIntentos,
} from './comun/middleware/limite-intentos.js';
import { manejarErrores, rutaNoEncontrada } from './comun/middleware/manejo-errores.js';
import { registrarPeticiones } from './comun/middleware/registro-peticiones.js';
import type { ConfiguracionVerificacionCorreo } from './comun/configuracion.js';
import type { Reloj } from './comun/reloj.js';
import { crearRutasSalud } from './comun/salud.js';
import type { Ejecutor, UnidadDeTrabajo } from './db/transaccion.js';
import {
  crearAdministracionServicio,
  crearRutasAdminAdministracion,
  type AdministracionServicio,
} from './modulos/administracion/index.js';
import {
  crearCuentasServicio,
  crearRutasAdminCuentas,
  crearRutasAppCuentas,
  type CuentasServicio,
} from './modulos/cuentas/index.js';
import {
  crearCupoInvitacionesServicio,
  crearRutasAppCupoInvitaciones,
  type CupoInvitacionesServicio,
} from './modulos/cupo-invitaciones/index.js';
import {
  crearGeneradorServicio,
  crearRutasAdminGenerador,
  type GeneradorServicio,
} from './modulos/generador/index.js';
import {
  crearEvaluacionesServicio,
  crearRutasAppEvaluaciones,
  type EvaluacionesServicio,
} from './modulos/evaluaciones/index.js';
import {
  crearPreguntasServicio,
  crearRutasAdminPreguntas,
  crearRutasAppPreguntas,
  type PreguntasServicio,
} from './modulos/preguntas/index.js';
import {
  crearPrivacidadServicio,
  crearRutasAdminPrivacidad,
  crearRutasAppPrivacidad,
  type PrivacidadServicio,
} from './modulos/privacidad/index.js';
import {
  crearRevisionServicio,
  crearRutasAdminRevision,
  type RevisionServicio,
} from './modulos/revision/index.js';
import {
  crearRutasAdminSuscripciones,
  crearRutasAppSuscripciones,
  crearRutasWebhooksSuscripciones,
  crearSuscripcionesServicio,
  type SuscripcionesServicio,
} from './modulos/suscripciones/index.js';
import {
  crearRutasAdminTemario,
  crearRutasAppTemario,
  crearTemarioServicio,
  type TemarioServicio,
} from './modulos/temario/index.js';

const PREFIJO_API = '/api/v1';

export interface Dependencias {
  /** Pool de PostgreSQL (o un reemplazo en las pruebas). */
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  comprobarBaseDeDatos: () => Promise<void>;
  proveedores: Proveedores;
  /** Hora actual (sesiones y vencimientos); en las pruebas se reemplaza para simular el paso del tiempo. */
  reloj: Reloj;
  jwt: SecretosJwt;
  /** Dirección de la consola y clave del código del correo de verificación (RN-32). */
  verificacionCorreo: ConfiguracionVerificacionCorreo;
  corsOrigenes: string[];
  registrarPeticiones: boolean;
  limiteIntentos?: OpcionesLimiteIntentos;
  /**
   * Solo para pruebas: reemplaza la comprobación de la cuenta interna en cada petición de la consola,
   * que por defecto consulta la base por el servicio de administracion.
   */
  verificarCuentaInterna?: VerificarCuentaInterna;
  /** Solo para pruebas: ejecuta el envío del correo de recuperación de modo que la prueba lo espere. */
  segundoPlano?: (tarea: () => Promise<void>) => void;
}

export interface Servicios {
  administracion: AdministracionServicio;
  cuentas: CuentasServicio;
  temario: TemarioServicio;
  preguntas: PreguntasServicio;
  generador: GeneradorServicio;
  revision: RevisionServicio;
  cupoInvitaciones: CupoInvitacionesServicio;
  suscripciones: SuscripcionesServicio;
  evaluaciones: EvaluacionesServicio;
  privacidad: PrivacidadServicio;
}

/** Crea los servicios en orden de dependencia: cada módulo recibe los servicios que usa. */
export function crearServicios(dependencias: Dependencias): Servicios {
  const base = { bd: dependencias.bd, unidadDeTrabajo: dependencias.unidadDeTrabajo };
  const { ia, correo, pagos } = dependencias.proveedores;

  // Al desactivar una cuenta interna, administracion cierra sus sesiones, que son de cuentas. Cuentas
  // se crea después porque usa administracion: la función solo se llama una vez creados los dos.
  const administracion = crearAdministracionServicio({
    ...base,
    revocarSesionesUsuarioInterno: (id, tx) => cuentas.revocarSesionesUsuarioInterno(id, tx),
  });
  const cupoInvitaciones = crearCupoInvitacionesServicio({ ...base, administracion });
  const cuentas = crearCuentasServicio({
    ...base,
    correo,
    administracion,
    cupoInvitaciones,
    jwt: dependencias.jwt,
    reloj: dependencias.reloj,
    verificacionCorreo: dependencias.verificacionCorreo,
    ...(dependencias.segundoPlano && { segundoPlano: dependencias.segundoPlano }),
  });
  const temario = crearTemarioServicio(base);
  const preguntas = crearPreguntasServicio({ ...base, temario });
  const generador = crearGeneradorServicio({ ...base, ia, administracion, preguntas });
  const revision = crearRevisionServicio({ ...base, administracion, preguntas });
  const suscripciones = crearSuscripcionesServicio({ ...base, pagos });
  const evaluaciones = crearEvaluacionesServicio({
    ...base,
    cupoInvitaciones,
    preguntas,
    suscripciones,
  });
  const privacidad = crearPrivacidadServicio({ ...base, cuentas });

  return {
    administracion,
    cuentas,
    temario,
    preguntas,
    generador,
    revision,
    cupoInvitaciones,
    suscripciones,
    evaluaciones,
    privacidad,
  };
}

/** /api/v1/app: las rutas públicas de cuentas y, después, todo con el JWT de la app. */
function crearRouterApp(s: Servicios, mw: MiddlewareRutas): Router {
  const router = Router();
  router.use('/cuentas', crearRutasAppCuentas(s.cuentas, mw));
  router.use(mw.autenticarApp);
  router.use('/temario', crearRutasAppTemario(s.temario));
  router.use('/preguntas', crearRutasAppPreguntas(s.preguntas));
  router.use('/evaluaciones', crearRutasAppEvaluaciones(s.evaluaciones));
  router.use('/cupo-invitaciones', crearRutasAppCupoInvitaciones(s.cupoInvitaciones, mw));
  router.use('/suscripciones', crearRutasAppSuscripciones(s.suscripciones));
  router.use('/privacidad', crearRutasAppPrivacidad(s.privacidad));
  return router;
}

/**
 * /api/v1/admin: la sesión de la consola y, después, todo con el JWT de la consola. Cada ruta declara
 * su rol con exigirRol en su propia cadena (DAS 4.3.3); los routers de los módulos no aplican roles.
 */
function crearRouterAdmin(s: Servicios, mw: MiddlewareRutas): Router {
  const router = Router();
  router.use('/cuentas', crearRutasAdminCuentas(s.cuentas, mw));
  router.use(mw.autenticarAdmin);
  router.use('/temario', crearRutasAdminTemario(s.temario));
  router.use('/preguntas', crearRutasAdminPreguntas(s.preguntas));
  router.use('/generador', crearRutasAdminGenerador(s.generador));
  router.use('/revision', crearRutasAdminRevision(s.revision));
  router.use('/suscripciones', crearRutasAdminSuscripciones(s.suscripciones));
  router.use('/privacidad', crearRutasAdminPrivacidad(s.privacidad));
  router.use('/administracion', crearRutasAdminAdministracion(s.administracion));
  return router;
}

export function crearApp(
  dependencias: Dependencias,
  servicios: Servicios = crearServicios(dependencias),
): Express {
  const app = express();
  // Render entrega la petición a través de un proxy: la IP real (para el límite de intentos) viene
  // en X-Forwarded-For y solo se confía en el primer salto.
  app.set('trust proxy', 1);

  if (dependencias.registrarPeticiones) app.use(registrarPeticiones);
  app.use(helmet());
  // Solo la consola llama desde un navegador; la app móvil no necesita CORS.
  app.use(cors({ origin: dependencias.corsOrigenes }));
  app.use(
    express.json({
      limit: '1mb',
      // Solo en los webhooks se guardan los bytes originales: las tiendas firman el cuerpo exacto.
      verify: (req, _res, cuerpo) => {
        // Express no distingue mayúsculas en las rutas: la comparación tampoco.
        if (req.url?.toLowerCase().startsWith(`${PREFIJO_API}/webhooks/`)) {
          (req as express.Request).cuerpoCrudo = cuerpo;
        }
      },
    }),
  );

  // La cuenta de cada token de la consola se vuelve a comprobar con su dueño, el módulo administracion.
  const verificarCuentaInterna: VerificarCuentaInterna =
    dependencias.verificarCuentaInterna ??
    (({ sub, rol }) => servicios.administracion.cuentaInternaVigente(sub, rol));
  const mw: MiddlewareRutas = {
    ...crearAutenticacion(dependencias.jwt, {
      reloj: dependencias.reloj,
      sesionVigente: servicios.cuentas.sesionVigente,
      verificarCuentaInterna,
    }),
    crearLimiteIntentos: crearFabricaLimiteIntentos(
      dependencias.limiteIntentos ?? LIMITE_INTENTOS_POR_DEFECTO,
    ),
  };

  app.use(`${PREFIJO_API}/salud`, crearRutasSalud(dependencias.comprobarBaseDeDatos));
  app.use(`${PREFIJO_API}/webhooks`, crearRutasWebhooksSuscripciones(servicios.suscripciones));
  app.use(`${PREFIJO_API}/app`, crearRouterApp(servicios, mw));
  app.use(`${PREFIJO_API}/admin`, crearRouterAdmin(servicios, mw));

  app.use(rutaNoEncontrada);
  app.use(manejarErrores);
  return app;
}
