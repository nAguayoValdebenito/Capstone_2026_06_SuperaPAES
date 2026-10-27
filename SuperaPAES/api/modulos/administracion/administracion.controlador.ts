// Controlador del módulo administracion: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores. El cuerpo y los parámetros ya vienen validados por validar() en las rutas.
import type { Request, RequestHandler } from 'express';
import { ErrorNoAutenticado } from '../../comun/errores.js';
import { responder } from '../../comun/respuesta.js';
import type { AdministracionServicio } from './administracion.servicio.js';
import type {
  DatosCrearUsuarioInterno,
  DatosEditarUsuarioInterno,
} from './administracion.validadores.js';

/** Manejador cuyo cuerpo y parámetros ya fueron validados y tipados por validar() en la ruta. */
type Validado<P, C = unknown> = RequestHandler<P, unknown, C>;

export interface AdministracionControlador {
  listarUsuariosInternos: RequestHandler;
  crearUsuarioInterno: Validado<Record<string, string>, DatosCrearUsuarioInterno>;
  editarUsuarioInterno: Validado<Record<string, string>, DatosEditarUsuarioInterno>;
  activarUsuarioInterno: RequestHandler;
  desactivarUsuarioInterno: RequestHandler;
}

/** Administrador que hace el cambio, para la auditoría. Lo deja autenticarAdmin. */
function autorDe(req: Request<unknown, unknown, unknown>): string {
  if (!req.usuarioInterno) throw new ErrorNoAutenticado();
  return req.usuarioInterno.id;
}

export function crearAdministracionControlador(
  servicio: AdministracionServicio,
): AdministracionControlador {
  return {
    listarUsuariosInternos: async (_req, res) => {
      responder(res, await servicio.listarUsuariosInternos());
    },
    crearUsuarioInterno: async (req, res) => {
      responder(res, await servicio.crearUsuarioInterno(autorDe(req), req.body), { estado: 201 });
    },
    editarUsuarioInterno: async (req, res) => {
      responder(
        res,
        await servicio.editarUsuarioInterno(autorDe(req), String(req.params.id), req.body),
      );
    },
    activarUsuarioInterno: async (req, res) => {
      responder(
        res,
        await servicio.cambiarEstadoUsuarioInterno(autorDe(req), String(req.params.id), true),
      );
    },
    desactivarUsuarioInterno: async (req, res) => {
      responder(
        res,
        await servicio.cambiarEstadoUsuarioInterno(autorDe(req), String(req.params.id), false),
      );
    },
  };
}
