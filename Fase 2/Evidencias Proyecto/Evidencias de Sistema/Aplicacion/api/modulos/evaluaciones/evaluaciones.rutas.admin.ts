// Rutas del módulo evaluaciones en la consola: /api/v1/admin/evaluaciones (C08, HU-63.1, CU-31), más las
// consultas por pregunta del administrador: impacto de anular (C13) y estadísticas (C02, HU-53.1).
// Cada endpoint: router.<metodo>(ruta, exigirRol(...), validar(...), controlador.<accion>).
import { Router } from 'express';
import type { Request, RequestHandler } from 'express';
import { ErrorNoAutenticado } from '../../comun/errores.js';
import { exigirRol } from '../../comun/middleware/autorizacion.js';
import { validar } from '../../comun/middleware/validacion.js';
import { responder } from '../../comun/respuesta.js';
import type { ConfiguracionEvaluaciones } from './evaluaciones.configuracion.servicio.js';
import type { EvaluacionesServicio } from './evaluaciones.servicio.js';
import {
  esquemaEstadisticasPreguntas,
  esquemaEstructura,
  esquemaIdEstructura,
  esquemaIdPreguntaImpacto,
  esquemaNuevaTabla,
  esquemaPruebaConfiguracion,
  type ConsultaEstadisticas,
  type ConsultaPrueba,
  type DatosEstructura,
  type DatosTablaConversion,
} from './evaluaciones.validadores.js';

type ConCuerpo<T> = RequestHandler<Record<string, string>, unknown, T>;

function autorDe(req: Request<Record<string, string>, unknown, unknown>): string {
  if (!req.usuarioInterno) throw new ErrorNoAutenticado();
  return req.usuarioInterno.id;
}

type ConsultasPorPregunta = Pick<EvaluacionesServicio, 'impactoDeAnular' | 'estadisticasDe'>;

/**
 * HU-50.2 (C13): cuántas evaluaciones se recalcularían al anular la pregunta. Solo cuenta.
 * HU-53.1 (C02): intentos, acierto y tiempo promedio de las preguntas de una página del banco.
 */
function agregarRutasPorPregunta(router: Router, servicio: ConsultasPorPregunta): void {
  router.get(
    '/estadisticas',
    exigirRol('admin'),
    validar({ consulta: esquemaEstadisticasPreguntas }),
    async (_req, res) => {
      const { preguntas } = res.locals.consulta as ConsultaEstadisticas;
      responder(res, await servicio.estadisticasDe(preguntas));
    },
  );
  router.get(
    '/preguntas/:id/impacto',
    exigirRol('admin'),
    validar({ parametros: esquemaIdPreguntaImpacto }),
    async (req, res) => {
      responder(res, await servicio.impactoDeAnular(String(req.params['id'])));
    },
  );
}

export function crearRutasAdminEvaluaciones(
  servicio: ConfiguracionEvaluaciones & ConsultasPorPregunta,
): Router {
  const router = Router();
  const listarEstructuras: RequestHandler = async (_req, res) => {
    const { pruebaId } = res.locals.consulta as ConsultaPrueba;
    responder(res, await servicio.listarEstructuras(pruebaId));
  };
  const editarEstructura: ConCuerpo<DatosEstructura> = async (req, res) => {
    const id = Number(req.params.id);
    responder(res, await servicio.editarEstructura(autorDe(req), id, req.body));
  };
  const listarTablas: RequestHandler = async (_req, res) => {
    const { pruebaId } = res.locals.consulta as ConsultaPrueba;
    responder(res, await servicio.listarTablas(pruebaId));
  };
  const cargarTabla: ConCuerpo<DatosTablaConversion> = async (req, res) => {
    responder(res, await servicio.cargarTabla(autorDe(req), req.body), { estado: 201 });
  };

  router.get(
    '/estructuras',
    exigirRol('admin'),
    validar({ consulta: esquemaPruebaConfiguracion }),
    listarEstructuras,
  );
  router.put(
    '/estructuras/:id',
    exigirRol('admin'),
    validar({ parametros: esquemaIdEstructura, cuerpo: esquemaEstructura }),
    editarEstructura,
  );
  router.get(
    '/tablas-conversion',
    exigirRol('admin'),
    validar({ consulta: esquemaPruebaConfiguracion }),
    listarTablas,
  );
  router.post(
    '/tablas-conversion',
    exigirRol('admin'),
    validar({ cuerpo: esquemaNuevaTabla }),
    cargarTabla,
  );
  agregarRutasPorPregunta(router, servicio);
  return router;
}
