// Crear y editar preguntas sin PostgreSQL (HU-12): un temario con M1, M2 y Competencia Lectora, y un
// repositorio de edición en memoria que imita lo que hace la base (borrador, alternativas por letra).
import { vi } from 'vitest';
import type {
  FilaPregunta,
  PreguntasEdicionRepositorio,
} from '../modulos/preguntas/preguntas.edicion.repositorio.js';
import { crearPreguntasServicio } from '../modulos/preguntas/index.js';
import type { PreguntasRepositorio } from '../modulos/preguntas/preguntas.repositorio.js';
import type { DatosPregunta } from '../modulos/preguntas/preguntas.validadores.js';
import type { PruebaTemario } from '../modulos/temario/index.js';
import { crearAppDePrueba, temarioEnMemoria } from './ayudantes.js';

export const RUTA_PREGUNTAS = '/api/v1/admin/preguntas';

const SELECCION = { codigo: 'seleccion_multiple', nombre: 'Selección múltiple' };
const SUFICIENCIA = { codigo: 'suficiencia_datos', nombre: 'Suficiencia de datos' };

/** Ids del temario: M1 (contenido 110), M2 (contenido 310) y CL (contenido 200, con textos). */
export const M1 = { pruebaId: 2, contenidoId: 110, habilidadId: 30 };
export const M2 = { pruebaId: 3, contenidoId: 310, habilidadId: 50 };
export const CL = { pruebaId: 1, contenidoId: 200, habilidadId: 40 };
/** Texto de lectura guardado. */
export const TEXTO_GUARDADO = 12;

const TEMARIO: PruebaTemario[] = [
  {
    id: 1,
    codigo: 'CL',
    nombre: 'Competencia Lectora',
    opcionesMin: 4,
    opcionesMax: 4,
    requiereTexto: true,
    ejes: [{ id: 20, nombre: 'Localizar', contenidos: [{ id: 200, nombre: 'Información' }] }],
    habilidades: [{ id: 40, nombre: 'Interpretar' }],
    tiposPregunta: [SELECCION],
  },
  {
    id: 2,
    codigo: 'M1',
    nombre: 'Competencia Matemática 1',
    opcionesMin: 4,
    opcionesMax: 4,
    requiereTexto: false,
    ejes: [{ id: 11, nombre: 'Álgebra', contenidos: [{ id: 110, nombre: 'Ecuaciones' }] }],
    habilidades: [{ id: 30, nombre: 'Resolver problemas' }],
    tiposPregunta: [SELECCION],
  },
  {
    id: 3,
    codigo: 'M2',
    nombre: 'Competencia Matemática 2',
    opcionesMin: 4,
    opcionesMax: 5,
    requiereTexto: false,
    ejes: [{ id: 31, nombre: 'Probabilidad', contenidos: [{ id: 310, nombre: 'Binomial' }] }],
    habilidades: [{ id: 50, nombre: 'Modelar' }],
    tiposPregunta: [SELECCION, SUFICIENCIA],
  },
];

/** Alternativas A, B, C... con la correcta en la letra indicada (o en ninguna, o en varias). */
export function alternativas(cantidad: number, correctas: string[] = ['A']) {
  return ['A', 'B', 'C', 'D', 'E'].slice(0, cantidad).map((letra) => ({
    letra,
    texto: `Opción ${letra}`,
    esCorrecta: correctas.includes(letra),
  }));
}

/** Cuerpo de una pregunta de M1 válida, con cambios. */
export function cuerpo(cambios: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...M1,
    tipoPregunta: 'seleccion_multiple',
    dificultadSugerida: 'media',
    enunciado: 'Si $2x + 3 = 11$, ¿cuánto vale $x$?',
    explicacion: 'Se despeja: $x = 4$.',
    alternativas: alternativas(4),
    ...cambios,
  };
}

const BORRADOR = { codigo: 'borrador', nombre: 'Borrador' };

/** Repositorio de edición en memoria: cada pregunta nueva parte en borrador. */
function repositorioEnMemoria() {
  const preguntas = new Map<string, FilaPregunta>();
  let siguienteId = 7;
  let siguienteAlternativa = 100;
  const desdeDatos = (id: string, datos: DatosPregunta): Omit<FilaPregunta, 'alternativas'> => ({
    id,
    pruebaId: datos.pruebaId,
    contenidoId: datos.contenidoId,
    habilidadId: datos.habilidadId,
    tipoPregunta: datos.tipoPregunta,
    dificultadSugerida: datos.dificultadSugerida,
    enunciado: datos.enunciado,
    explicacion: datos.explicacion,
    textoEstimuloId: datos.textoEstimuloId === null ? null : String(datos.textoEstimuloId),
    ordenEnTexto: datos.ordenEnTexto,
    estado: BORRADOR,
    editable: true,
    version: 1,
    origen: 'manual',
    actualizadoEn: new Date('2026-10-27T12:00:00Z'),
  });
  const repositorio = {
    fijarAutor: vi.fn(() => Promise.resolve()),
    insertar: vi.fn((datos: DatosPregunta) => {
      const id = String(siguienteId++);
      preguntas.set(id, { ...desdeDatos(id, datos), alternativas: [] });
      return Promise.resolve(id);
    }),
    actualizar: vi.fn((id: string, datos: DatosPregunta) => {
      const actual = preguntas.get(id);
      if (actual) preguntas.set(id, { ...actual, ...desdeDatos(id, datos), estado: actual.estado });
      return Promise.resolve();
    }),
    guardarAlternativas: vi.fn((id: string, nuevas: DatosPregunta['alternativas']) => {
      const pregunta = preguntas.get(id);
      if (!pregunta) return Promise.resolve();
      pregunta.alternativas = nuevas.map((nueva) => ({
        id:
          pregunta.alternativas.find((a) => a.letra === nueva.letra)?.id ??
          String(siguienteAlternativa++),
        ...nueva,
      }));
      return Promise.resolve();
    }),
    quitarAlternativas: vi.fn(() => Promise.resolve()),
    obtener: vi.fn((id: string) => Promise.resolve(preguntas.get(id) ?? null)),
    existeTexto: vi.fn((id: number) => Promise.resolve(id === TEXTO_GUARDADO)),
  } satisfies PreguntasEdicionRepositorio;
  /** Cambia la etapa de una pregunta guardada, como lo haría la revisión. */
  const ponerEtapa = (id: string, estado: FilaPregunta['estado'], editable: boolean) => {
    const pregunta = preguntas.get(id);
    if (pregunta) preguntas.set(id, { ...pregunta, estado, editable });
  };
  return { repositorio, ponerEtapa };
}

const LISTAS: PreguntasRepositorio = {
  listarBanco: () => Promise.resolve({ filas: [], total: 0 }),
  listarEstados: () => Promise.resolve([BORRADOR]),
  listarDificultades: () =>
    Promise.resolve([
      { codigo: 'facil', nombre: 'Fácil' },
      { codigo: 'media', nombre: 'Media' },
      { codigo: 'dificil', nombre: 'Difícil' },
    ]),
};

/** App con el servicio de preguntas real sobre el temario y el repositorio en memoria. */
export function escenarioEdicion() {
  const { repositorio, ponerEtapa } = repositorioEnMemoria();
  const auditoria = { registrarAuditoria: vi.fn(() => Promise.resolve()) };
  const temario = temarioEnMemoria(TEMARIO);
  const preguntas = crearPreguntasServicio({
    bd: { query: () => Promise.reject(new Error('sin base')) },
    unidadDeTrabajo: {
      enTransaccion: (trabajo) => trabajo({ query: () => Promise.reject(new Error('sin base')) }),
    },
    temario,
    administracion: auditoria,
    repositorio: LISTAS,
    repositorioEdicion: repositorio,
  });
  const app = crearAppDePrueba({}, { preguntas, temario });
  return { app, repositorio, auditoria, ponerEtapa };
}
