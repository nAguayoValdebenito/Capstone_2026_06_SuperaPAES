// Datos del escenario de ids para las rutas de preguntas de la consola (HU-11, HU-12.1 y HU-12.2): un
// servicio de preguntas falso y los cuerpos de las rutas que reciben datos.
import { vi } from 'vitest';
import type { PreguntasServicio } from '../modulos/preguntas/index.js';

const fecha = new Date('2026-01-01T00:00:00.000Z');

/** Banco de preguntas (HU-11): el repositorio entrega el id BIGINT como texto. */
const paginaBanco = {
  preguntas: [
    {
      id: '84',
      resumen: 'Pregunta',
      prueba: { id: 2, codigo: 'M1', nombre: 'Matemática 1' },
      eje: { id: 3, nombre: 'Álgebra' },
      contenido: { id: 30, nombre: 'Ecuaciones' },
      estado: { codigo: 'borrador', nombre: 'Borrador' },
      origen: 'manual' as const,
      dificultadSugerida: null,
      dificultadAsignada: null,
      posibleAmbigua: false,
      actualizadoEn: fecha.toISOString(),
    },
  ],
  paginacion: { pagina: 1, porPagina: 20, total: 1 },
};
const filtrosBanco = {
  pruebas: [
    {
      id: 2,
      codigo: 'M1',
      nombre: 'Matemática 1',
      opcionesMin: 4,
      opcionesMax: 4,
      requiereTexto: false,
      ejes: [{ id: 3, nombre: 'Álgebra', contenidos: [{ id: 30, nombre: 'Ecuaciones' }] }],
      habilidades: [{ id: 6, nombre: 'Resolver problemas' }],
      tiposPregunta: [{ codigo: 'seleccion_multiple', nombre: 'Selección múltiple' }],
    },
  ],
  estados: [{ codigo: 'borrador', nombre: 'Borrador' }],
  origenes: [{ codigo: 'manual', nombre: 'Manual' }],
  dificultades: [{ codigo: 'facil', nombre: 'Fácil' }],
};

/** Pregunta del formulario de la consola (HU-12.1): ids BIGINT como texto, como los entrega la base. */
const preguntaParaEditar = {
  id: '84',
  pruebaId: 2,
  ejeId: 3,
  contenidoId: 30,
  habilidadId: 6,
  tipoPregunta: 'seleccion_multiple',
  dificultadSugerida: null,
  enunciado: 'Pregunta',
  explicacion: 'Explicación',
  textoEstimuloId: '12',
  ordenEnTexto: 1,
  estado: { codigo: 'borrador', nombre: 'Borrador' },
  editable: true,
  version: 1,
  origen: 'manual' as const,
  alternativas: [
    { id: '101', letra: 'A', texto: 'Primera', esCorrecta: true, explicacion: null },
    { id: '102', letra: 'B', texto: 'Segunda', esCorrecta: false, explicacion: null },
  ],
  actualizadoEn: fecha.toISOString(),
};

/** Pregunta que la consola crea o edita (HU-12.1); el servicio es falso, así que basta con el formato. */
const cuerpoPregunta = {
  pruebaId: 2,
  contenidoId: 30,
  habilidadId: 6,
  tipoPregunta: 'seleccion_multiple',
  enunciado: 'Pregunta',
  explicacion: 'Explicación',
  alternativas: [{ letra: 'A', texto: 'Primera', esCorrecta: true }],
};

/** Texto de lectura (HU-12.2): ids BIGINT como texto, como los entrega la base. */
const textoParaEditar = {
  id: '12',
  tipoTexto: 'literario',
  titulo: 'El faro',
  contenido: 'Había una vez un faro.',
  imagenUrl: null,
  preguntas: 1,
  editable: true,
  creadoEn: fecha.toISOString(),
};

const cuerpoTexto = {
  tipoTexto: 'literario',
  titulo: 'El faro',
  contenido: 'Había una vez un faro.',
};

/** Servicio de preguntas con las rutas de la consola respondiendo datos fijos. */
export function preguntasDePrueba(base: PreguntasServicio): PreguntasServicio {
  return {
    ...base,
    listarBanco: vi.fn(() => Promise.resolve(paginaBanco)),
    filtrosDelBanco: vi.fn(() => Promise.resolve(filtrosBanco)),
    crearPregunta: vi.fn(() => Promise.resolve(preguntaParaEditar)),
    obtenerPregunta: vi.fn(() => Promise.resolve(preguntaParaEditar)),
    editarPregunta: vi.fn(() => Promise.resolve(preguntaParaEditar)),
    listarTextos: vi.fn(() =>
      Promise.resolve({
        textos: [
          {
            id: '12',
            tipoTexto: { codigo: 'literario', nombre: 'Literario' },
            titulo: textoParaEditar.titulo,
            resumen: textoParaEditar.contenido,
            imagenUrl: null,
            preguntas: 1,
            creadoEn: textoParaEditar.creadoEn,
          },
        ],
        paginacion: { pagina: 1, porPagina: 20, total: 1 },
      }),
    ),
    obtenerTexto: vi.fn(() => Promise.resolve(textoParaEditar)),
    crearTexto: vi.fn(() => Promise.resolve(textoParaEditar)),
    editarTexto: vi.fn(() => Promise.resolve(textoParaEditar)),
  };
}

/** Cuerpo de las rutas de preguntas y textos que reciben datos, o undefined si la ruta es otra. */
export function cuerpoDePreguntas(ruta: string): Record<string, unknown> | undefined {
  if (/^(POST|PUT) .*\/preguntas\/textos(\/:id)?$/.test(ruta)) return cuerpoTexto;
  if (/^(POST|PUT) .*\/preguntas\/(:id)?$/.test(ruta)) return cuerpoPregunta;
  return undefined;
}
