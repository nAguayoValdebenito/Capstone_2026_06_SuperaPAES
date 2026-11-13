// Controlador del módulo preguntas: traduce HTTP a llamadas del servicio y responde con responder().
// Sin SQL ni adaptadores. La consulta, el cuerpo y los parámetros ya vienen validados por validar().
import type { Request, RequestHandler } from 'express';
import { ErrorNoAutenticado, ErrorValidacion } from '../../comun/errores.js';
import { responder } from '../../comun/respuesta.js';
import type { CambioDeEtapa } from './preguntas.publicacion.servicio.js';
import type { PreguntasServicio } from './preguntas.servicio.js';
import type {
  ArchivosImportacion,
  CierreAviso,
  ConsultaTextos,
  DatosImportacion,
  DatosPregunta,
  DatosTexto,
  FiltrosAvisos,
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
  plantillasImportacion: RequestHandler;
  revisarImportacion: Validado<ArchivosImportacion>;
  importarPreguntas: Validado<DatosImportacion>;
  publicarPregunta: Validado;
  retirarPregunta: Validado;
  volverABorrador: Validado;
  listarAvisos: RequestHandler;
  cerrarAviso: Validado<{ estado: CierreAviso }>;
  anularPregunta: Validado;
  subirImagen: Validado;
  obtenerImagen: Validado;
}

/**
 * Administrador que crea, edita, publica o retira: autor de la pregunta, del historial y de la
 * auditoría. Lo deja autenticarAdmin.
 */
function autorDe(req: Request<Record<string, string>, unknown, unknown>): string {
  if (!req.usuarioInterno) throw new ErrorNoAutenticado();
  return req.usuarioInterno.id;
}

/** HU-24 (CU-21): publica, retira o vuelve a borrador la pregunta a nombre del administrador. */
const cambiarEtapa =
  (servicio: PreguntasServicio, cambio: CambioDeEtapa): Validado =>
  async (req, res) => {
    responder(res, await servicio.cambiarEtapa(autorDe(req), String(req.params.id), cambio));
  };

/** CU-16: descargar, revisar y confirmar la importación desde C04. */
function controladorImportacion(
  servicio: PreguntasServicio,
): Pick<
  PreguntasControlador,
  'plantillasImportacion' | 'revisarImportacion' | 'importarPreguntas'
> {
  return {
    plantillasImportacion: (_req, res) => {
      responder(res, servicio.obtenerPlantillasImportacion());
    },
    revisarImportacion: async (req, res) => {
      responder(res, await servicio.revisarImportacion(req.body));
    },
    importarPreguntas: async (req, res) => {
      responder(res, await servicio.importarPreguntas(autorDe(req), req.body), { estado: 201 });
    },
  };
}

/** HU-50.1 y HU-50.2 (C13): la bandeja de avisos, el cierre de un aviso y la anulación. */
function controladorAvisos(
  servicio: PreguntasServicio,
): Pick<PreguntasControlador, 'listarAvisos' | 'cerrarAviso' | 'anularPregunta'> {
  return {
    listarAvisos: async (_req, res) => {
      const { grupos, paginacion } = await servicio.listarAvisos(
        res.locals.consulta as FiltrosAvisos,
      );
      responder(res, grupos, { meta: paginacion });
    },
    cerrarAviso: async (req, res) => {
      const id = String(req.params.id);
      responder(res, await servicio.cerrarAviso(autorDe(req), id, req.body.estado));
    },
    anularPregunta: async (req, res) => {
      responder(res, await servicio.anularPregunta(autorDe(req), String(req.params.id)));
    },
  };
}

/** Un año: la dirección de una imagen nunca cambia de contenido, porque es su huella. */
const CACHE_IMAGEN = 'public, max-age=31536000, immutable';

/**
 * Imágenes (HU-12.6). La subida llega como el archivo mismo (Content-Type image/png,
 * image/jpeg o image/webp), no en JSON. La entrega es pública y se puede guardar en caché para siempre;
 * Cross-Origin-Resource-Policy cross-origin deja que la consola, publicada en otro dominio, la muestre.
 */
function controladorImagenes(
  servicio: PreguntasServicio,
): Pick<PreguntasControlador, 'subirImagen' | 'obtenerImagen'> {
  return {
    subirImagen: async (req, res) => {
      const archivo: unknown = req.body;
      if (!Buffer.isBuffer(archivo)) {
        const mensaje = 'Envía el archivo de la imagen como PNG, JPEG o WebP.';
        throw new ErrorValidacion([{ lugar: 'cuerpo', ruta: 'imagen', mensaje }], mensaje);
      }
      responder(res, await servicio.subirImagen(autorDe(req), archivo), { estado: 201 });
    },
    obtenerImagen: async (req, res) => {
      const huella = String(req.params.archivo).replace(/\.webp$/, '');
      const etiqueta = `"${huella}"`;
      const encabezados = {
        'Cache-Control': CACHE_IMAGEN,
        ETag: etiqueta,
        'Cross-Origin-Resource-Policy': 'cross-origin',
      };
      if (req.headers['if-none-match'] === etiqueta) {
        res.set(encabezados).status(304).end();
        return;
      }
      // Si no existe, el 404 sale sin estos encabezados: un error no se guarda en caché.
      const datos = await servicio.obtenerImagen(huella);
      res.set(encabezados);
      res.type('image/webp').send(datos);
    },
  };
}

export function crearPreguntasControlador(servicio: PreguntasServicio): PreguntasControlador {
  return {
    ...controladorImportacion(servicio),
    ...controladorImagenes(servicio),
    ...controladorAvisos(servicio),
    publicarPregunta: cambiarEtapa(servicio, 'publicar'),
    retirarPregunta: cambiarEtapa(servicio, 'retirar'),
    volverABorrador: cambiarEtapa(servicio, 'borrador'),
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
