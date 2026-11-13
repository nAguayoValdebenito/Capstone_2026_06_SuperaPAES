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
import { crearRutasTareas } from './trabajos/tareas-periodicas.js';
import type { CandadosDeSesion } from './db/candados.js';
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
  type OpcionesProcesador,
} from './modulos/generador/index.js';
import {
  crearEvaluacionesServicio,
  crearRutasAdminEvaluaciones,
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
  /** Candados de sesión de PostgreSQL (un solo worker por lote). */
  candados: CandadosDeSesion;
  comprobarBaseDeDatos: () => Promise<void>;
  proveedores: Proveedores;
  /** Hora actual (sesiones y vencimientos); en las pruebas se reemplaza para simular el paso del tiempo. */
  reloj: Reloj;
  jwt: SecretosJwt;
  /** Dirección de la consola y clave del código del correo de verificación (RN-32). */
  verificacionCorreo: ConfiguracionVerificacionCorreo;
  corsOrigenes: string[];
  registrarPeticiones: boolean;
  /** Paquete de la app en Google Play, para abrir su gestión de suscripciones (HU-45.2). */
  paqueteGooglePlay?: string;
  /** Clave de la ruta de tareas periódicas (DAS 4.3.3); sin ella, la ruta no se monta. */
  claveTareas?: string;
  limiteIntentos?: OpcionesLimiteIntentos;
  /** Solo para pruebas: azar, plazo y resultado objetivo del worker del generador. */
  opcionesGenerador?: OpcionesProcesador;
  /** Solo para pruebas: sorteo reproducible de preguntas sin puntaje del ensayo. */
  azarEvaluaciones?: () => number;
  /**
   * Solo para pruebas: reemplaza la comprobación de la cuenta interna en cada petición de la consola,
   * que por defecto consulta la base por el servicio de administracion.
   */
  verificarCuentaInterna?: VerificarCuentaInterna;
  /** Solo para pruebas: ejecuta los correos de cuentas de modo que la prueba pueda esperarlos. */
  segundoPlano?: (tarea: () => Promise<void>) => void;
  /**
   * Solo para pruebas: reemplaza la respuesta de suscripciones a «¿una suscripción cubre la prueba?»
   * (RN-04), que por defecto consulta la suscripción activa o en mora del estudiante.
   */
  cubrePrueba?: SuscripcionesServicio['cubrePrueba'];
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

/**
 * Suscripciones y cupo-invitaciones: el cupo pregunta a suscripciones si una suscripción cubre la
 * prueba (RN-04). Las pruebas pueden reemplazar esa respuesta con Dependencias.cubrePrueba.
 */
function crearSuscripcionesYCupo(
  dependencias: Dependencias,
  administracion: AdministracionServicio,
  /** Cuentas se crea después (usa cupo-invitaciones): solo se pide al llamar. */
  cuentas: () => Pick<CuentasServicio, 'estadoParaInicio' | 'codigoInvitacion' | 'exportarCuenta'>,
): Pick<Servicios, 'suscripciones' | 'cupoInvitaciones'> {
  const base = { bd: dependencias.bd, unidadDeTrabajo: dependencias.unidadDeTrabajo };
  const suscripciones = crearSuscripcionesServicio({
    ...base,
    administracion,
    reloj: dependencias.reloj,
    pagos: dependencias.proveedores.pagos,
    // CU-12 4.b: el correo de mora sale en segundo plano, como los de cuentas.
    correoMora: {
      cuentas,
      correo: dependencias.proveedores.correo,
      segundoPlano: dependencias.segundoPlano ?? ((tarea) => void tarea()),
    },
    ...(dependencias.paqueteGooglePlay && { paqueteGooglePlay: dependencias.paqueteGooglePlay }),
    // HU-45.3: el aviso de renovación anual, que la tarea horaria envía.
    avisoRenovacion: {
      administracion,
      cuentas,
      correo: dependencias.proveedores.correo,
      candados: dependencias.candados,
    },
  });
  const cubrePrueba: SuscripcionesServicio['cubrePrueba'] =
    dependencias.cubrePrueba ??
    ((estudianteId, pruebaId, tx) => suscripciones.cubrePrueba(estudianteId, pruebaId, tx));
  const cupoInvitaciones = crearCupoInvitacionesServicio({
    ...base,
    administracion,
    suscripciones: { cubrePrueba },
    cuentas: {
      estadoParaInicio: (id, ahora) => cuentas().estadoParaInicio(id, ahora),
      codigoInvitacion: (id, tx) => cuentas().codigoInvitacion(id, tx),
    },
    urlConsola: dependencias.verificacionCorreo.urlConsola,
    reloj: dependencias.reloj,
  });
  return { suscripciones, cupoInvitaciones };
}

/** El generador con IA: usa la IA y los candados de la API, y los servicios de los módulos que lee. */
function crearGenerador(
  d: Dependencias,
  servicios: Pick<Servicios, 'administracion' | 'preguntas' | 'temario'>,
): GeneradorServicio {
  return crearGeneradorServicio({
    ...{ bd: d.bd, unidadDeTrabajo: d.unidadDeTrabajo, reloj: d.reloj },
    ...{ ia: d.proveedores.ia, candados: d.candados, ...servicios },
    ...(d.opcionesGenerador && { opciones: d.opcionesGenerador }),
  });
}

/**
 * Privacidad: la descarga y el borrado usan cuentas, evaluaciones y suscripciones; las solicitudes de
 * datos leen su plazo de la configuración de administracion (HU-09.1).
 */
function privacidadDe(
  base: Pick<Dependencias, 'bd' | 'unidadDeTrabajo' | 'reloj'>,
  servicios: Pick<Servicios, 'administracion' | 'cuentas' | 'evaluaciones' | 'suscripciones'>,
): PrivacidadServicio {
  return crearPrivacidadServicio({ ...base, ...servicios });
}

/** Crea los servicios en orden de dependencia: cada módulo recibe los servicios que usa. */
export function crearServicios(dependencias: Dependencias): Servicios {
  const base = { bd: dependencias.bd, unidadDeTrabajo: dependencias.unidadDeTrabajo };
  const conReloj = { ...base, reloj: dependencias.reloj };
  const { correo } = dependencias.proveedores;

  // Al desactivar una cuenta interna, administracion cierra sus sesiones, que son de cuentas. Cuentas
  // se crea después porque usa administracion: la función solo se llama una vez creados los dos.
  const administracion = crearAdministracionServicio({
    ...base,
    revocarSesionesUsuarioInterno: (id, tx) => cuentas.revocarSesionesUsuarioInterno(id, tx),
  });
  // El inicio del cupo lee la racha de cuentas y las invitaciones, el código; cuentas se crea después
  // porque usa cupo-invitaciones: las funciones solo se llaman una vez creados los dos.
  const { suscripciones, cupoInvitaciones } = crearSuscripcionesYCupo(
    dependencias,
    administracion,
    () => cuentas,
  );
  const cuentas = crearCuentasServicio({
    ...conReloj,
    correo,
    administracion,
    cupoInvitaciones,
    jwt: dependencias.jwt,
    verificacionCorreo: dependencias.verificacionCorreo,
    ...(dependencias.segundoPlano && { segundoPlano: dependencias.segundoPlano }),
  });
  const temario = crearTemarioServicio(base);
  const preguntas = crearPreguntasServicio({ ...base, temario, administracion });
  const generador = crearGenerador(dependencias, { administracion, preguntas, temario });
  const revision = crearRevisionServicio({ ...conReloj, administracion, preguntas });
  const evaluaciones = crearEvaluacionesServicio({
    ...conReloj,
    cuentas,
    temario,
    cupoInvitaciones,
    preguntas,
    suscripciones,
    administracion,
    ...(dependencias.azarEvaluaciones ? { azar: dependencias.azarEvaluaciones } : {}),
  });

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
    privacidad: privacidadDe(conReloj, { administracion, cuentas, evaluaciones, suscripciones }),
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
  router.use('/evaluaciones', crearRutasAdminEvaluaciones(s.evaluaciones));
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
  if (dependencias.claveTareas) {
    app.use(
      `${PREFIJO_API}/tareas`,
      crearRutasTareas(dependencias.claveTareas, {
        cerrarVencidas: () => servicios.evaluaciones.cerrarVencidas(),
        cerrarCanceladasVencidas: () => servicios.suscripciones.cerrarCanceladasVencidas(),
        avisarRenovaciones: () => servicios.suscripciones.avisarRenovaciones(),
      }),
    );
  }
  app.use(`${PREFIJO_API}/app`, crearRouterApp(servicios, mw));
  app.use(`${PREFIJO_API}/admin`, crearRouterAdmin(servicios, mw));

  app.use(rutaNoEncontrada);
  app.use(manejarErrores);
  return app;
}
