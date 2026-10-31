// Textos de lectura (HU-12.2, RF-G02, C03): listar con búsqueda por título, obtener, crear y editar.
// Un texto solo se edita si todas las preguntas que lo usan están en una etapa editable: la versión
// guardada de una pregunta apunta al texto, no lo copia, así que cambiarlo cambiaría una pregunta en
// revisión o publicada sin dejar versión (misma regla que RF-G09). Cada cambio queda en la auditoría.
import { ErrorConflicto, ErrorNoEncontrado, ErrorValidacion } from '../../comun/errores.js';
import type { ProblemaDeCampo } from '../../comun/middleware/validacion.js';
import type { Paginacion } from '../../comun/respuesta.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { Opcion } from './preguntas.repositorio.js';
import type {
  FilaListaTexto,
  FilaTexto,
  PreguntasTextosRepositorio,
} from './preguntas.textos.repositorio.js';
import type { ConsultaTextos, DatosTexto } from './preguntas.validadores.js';

export interface TextoDeLaLista extends Omit<FilaListaTexto, 'creadoEn'> {
  creadoEn: string;
}

/** El texto para el formulario: si se puede editar y cuántas preguntas lo usan. */
export interface TextoParaEditar extends Omit<FilaTexto, 'creadoEn'> {
  editable: boolean;
  creadoEn: string;
}

export interface TextosDeLectura {
  listarTextos(
    consulta: ConsultaTextos,
  ): Promise<{ textos: TextoDeLaLista[]; paginacion: Paginacion }>;
  obtenerTexto(id: string): Promise<TextoParaEditar>;
  crearTexto(autorId: string, datos: DatosTexto): Promise<TextoParaEditar>;
  /** 409 si alguna pregunta que lo usa no está en una etapa editable. */
  editarTexto(autorId: string, id: string, datos: DatosTexto): Promise<TextoParaEditar>;
  tiposDeTexto(): Promise<Opcion[]>;
  /** Problemas del texto contra la lista de tipos; `ruta` antecede el nombre del campo. */
  problemasDeTexto(datos: DatosTexto, ruta?: string): Promise<ProblemaDeCampo[]>;
  /** Crea el texto dentro de la transacción de otra operación (crear una pregunta con su texto). */
  crearEnTransaccion(autorId: string, datos: DatosTexto, tx: Ejecutor): Promise<string>;
}

export interface DependenciasTextos {
  unidadDeTrabajo: UnidadDeTrabajo;
  auditoria: Pick<AdministracionServicio, 'registrarAuditoria'>;
  repositorio: PreguntasTextosRepositorio;
}

const ENTIDAD_TEXTO = 'texto_estimulo';

const conFecha = <T extends { creadoEn: Date }>({ creadoEn, ...resto }: T) => ({
  ...resto,
  creadoEn: creadoEn.toISOString(),
});

async function leer(
  repositorio: PreguntasTextosRepositorio,
  id: string,
  tx?: Ejecutor,
): Promise<TextoParaEditar> {
  const fila = await repositorio.obtener(id, tx);
  if (!fila) throw new ErrorNoEncontrado('El texto de lectura no existe.');
  const etapas = await repositorio.etapasQueLoUsan(id, tx);
  return { ...conFecha(fila), editable: etapas.every((etapa) => etapa.editable) };
}

async function auditar(
  { auditoria }: DependenciasTextos,
  autorId: string,
  [antes, despues]: [TextoParaEditar | null, TextoParaEditar],
  tx: Ejecutor,
): Promise<void> {
  await auditoria.registrarAuditoria(
    {
      usuarioId: autorId,
      accion: antes ? 'editar_texto' : 'crear_texto',
      entidad: ENTIDAD_TEXTO,
      entidadId: despues.id,
      antes: antes && { ...antes },
      despues: { ...despues },
    },
    tx,
  );
}

async function comprobar(
  repositorio: PreguntasTextosRepositorio,
  datos: DatosTexto,
  ruta = '',
): Promise<ProblemaDeCampo[]> {
  const tipos = await repositorio.listarTipos();
  if (tipos.some((tipo) => tipo.codigo === datos.tipoTexto)) return [];
  return [{ lugar: 'cuerpo', ruta: `${ruta}tipoTexto`, mensaje: 'El tipo de texto no existe.' }];
}

async function exigirValido(repositorio: PreguntasTextosRepositorio, datos: DatosTexto) {
  const problemas = await comprobar(repositorio, datos);
  if (problemas.length > 0) throw new ErrorValidacion(problemas, problemas[0]?.mensaje);
}

async function crearEnTransaccion(
  dependencias: DependenciasTextos,
  autorId: string,
  [datos, tx]: [DatosTexto, Ejecutor],
): Promise<string> {
  const id = await dependencias.repositorio.insertar(datos, autorId, tx);
  await auditar(dependencias, autorId, [null, await leer(dependencias.repositorio, id, tx)], tx);
  return id;
}

async function editarTexto(
  dependencias: DependenciasTextos,
  autorId: string,
  [id, datos]: [string, DatosTexto],
): Promise<TextoParaEditar> {
  const { unidadDeTrabajo, repositorio } = dependencias;
  await exigirValido(repositorio, datos);
  return unidadDeTrabajo.enTransaccion(async (tx) => {
    const antes = await leer(repositorio, id, tx);
    const bloqueante = (await repositorio.etapasQueLoUsan(id, tx)).find((etapa) => !etapa.editable);
    if (bloqueante) {
      throw new ErrorConflicto(
        `El texto lo usa una pregunta «${bloqueante.nombre}» y no se puede editar: solo se editan los textos cuyas preguntas están en borrador u observadas (RF-G09).`,
      );
    }
    await repositorio.actualizar(id, datos, tx);
    const editado = await leer(repositorio, id, tx);
    await auditar(dependencias, autorId, [antes, editado], tx);
    return editado;
  });
}

export function crearTextosDeLectura(dependencias: DependenciasTextos): TextosDeLectura {
  const { unidadDeTrabajo, repositorio } = dependencias;
  return {
    async listarTextos({ buscar, pagina, porPagina }) {
      const { filas, total } = await repositorio.listar({
        buscar: buscar || null,
        limite: porPagina,
        desde: (pagina - 1) * porPagina,
      });
      return { textos: filas.map(conFecha), paginacion: { pagina, porPagina, total } };
    },
    obtenerTexto: (id) => leer(repositorio, id),
    async crearTexto(autorId, datos) {
      await exigirValido(repositorio, datos);
      return unidadDeTrabajo.enTransaccion(async (tx) => {
        const id = await crearEnTransaccion(dependencias, autorId, [datos, tx]);
        return leer(repositorio, id, tx);
      });
    },
    editarTexto: (autorId, id, datos) => editarTexto(dependencias, autorId, [id, datos]),
    tiposDeTexto: () => repositorio.listarTipos(),
    problemasDeTexto: (datos, ruta) => comprobar(repositorio, datos, ruta),
    crearEnTransaccion: (autorId, datos, tx) =>
      crearEnTransaccion(dependencias, autorId, [datos, tx]),
  };
}
