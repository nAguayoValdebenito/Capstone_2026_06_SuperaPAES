// Controlador del módulo preguntas: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores. La consulta, el cuerpo y los parámetros ya vienen validados por validar().
import type { Request, RequestHandler } from 'express';
import { ErrorNoAutenticado } from '../../comun/errores.js';
import { responder } from '../../comun/respuesta.js';
import type { PreguntasServicio } from './preguntas.servicio.js';
import type {
  ConsultaTextos,
  DatosPregunta,
  DatosTexto,
  FiltrosBanco,
} from './preguntas.validadores.js';

/** Manejador cuyo cuerpo y parámetros ya fueron validados y tipados por validar() en la ruta. */
type Validado<C = unknown> = RequestHandler<Record<string, string>, unknown, C>;

export interface PreguntasControlador {
  listarBanco: RequestHandler;
  filtrosDelBanco: RequestHandler;
  crearPregunta: Validado<DatosPregunta>;
  obtenerPregunta: Validado;
  editarPregunta: Validado<DatosPregunta>;
  listarTextos: RequestHandler;
  obtenerTexto: Validado;
  crearTexto: Validado<DatosTexto>;
  editarTexto: Validado<DatosTexto>;
  tiposDeTexto: RequestHandler;
}

/** Administrador que crea o edita: autor de la pregunta y de la auditoría. Lo deja autenticarAdmin. */
function autorDe(req: Request<Record<string, string>, unknown, unknown>): string {
  if (!req.usuarioInterno) throw new ErrorNoAutenticado();
  return req.usuarioInterno.id;
}

export function crearPreguntasControlador(servicio: PreguntasServicio): PreguntasControlador {
  return {
    listarBanco: async (_req, res) => {
      // En Express 5 req.query es de solo lectura: validar() deja la consulta validada en res.locals.
      const filtros = res.locals.consulta as FiltrosBanco;
      const { preguntas, paginacion } = await servicio.listarBanco(filtros);
      responder(res, preguntas, { meta: paginacion });
    },
    filtrosDelBanco: async (_req, res) => {
      responder(res, await servicio.filtrosDelBanco());
    },
    crearPregunta: async (req, res) => {
      responder(res, await servicio.crearPregunta(autorDe(req), req.body), { estado: 201 });
    },
    obtenerPregunta: async (req, res) => {
      responder(res, await servicio.obtenerPregunta(String(req.params.id)));
    },
    editarPregunta: async (req, res) => {
      responder(res, await servicio.editarPregunta(autorDe(req), String(req.params.id), req.body));
    },
    listarTextos: async (_req, res) => {
      const { textos, paginacion } = await servicio.listarTextos(
        res.locals.consulta as ConsultaTextos,
      );
      responder(res, textos, { meta: paginacion });
    },
    obtenerTexto: async (req, res) => {
      responder(res, await servicio.obtenerTexto(String(req.params.id)));
    },
    crearTexto: async (req, res) => {
      responder(res, await servicio.crearTexto(autorDe(req), req.body), { estado: 201 });
    },
    editarTexto: async (req, res) => {
      responder(res, await servicio.editarTexto(autorDe(req), String(req.params.id), req.body));
    },
    tiposDeTexto: async (_req, res) => {
      responder(res, await servicio.tiposDeTexto());
    },
  };
}
