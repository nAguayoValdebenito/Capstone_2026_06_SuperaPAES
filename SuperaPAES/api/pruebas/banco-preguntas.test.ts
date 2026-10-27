// Banco de preguntas (HU-11, RF-G01, C02, CP-08) por HTTP, sin PostgreSQL: un temario y un repositorio
// en memoria. Las consultas reales se prueban en banco-preguntas-bd.test.ts.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type {
  ConsultaBanco,
  FilaBanco,
  PreguntasRepositorio,
} from '../modulos/preguntas/preguntas.repositorio.js';
import { crearPreguntasServicio } from '../modulos/preguntas/index.js';
import type { PruebaTemario, TemarioServicio } from '../modulos/temario/index.js';
import { crearAppDePrueba, errorConFormato, tokenAdmin } from './ayudantes.js';

const RUTA = '/api/v1/admin/preguntas';

/** Reglas de RN-08 de una prueba de 4 alternativas y sin textos, solo con selección múltiple. */
const SELECCION_MULTIPLE = {
  opcionesMin: 4,
  opcionesMax: 4,
  requiereTexto: false,
  tiposPregunta: [{ codigo: 'seleccion_multiple', nombre: 'Selección múltiple' }],
};

/** M1 con dos ejes; el eje 10 tiene dos contenidos. CL con un eje y un contenido. */
const TEMARIO: PruebaTemario[] = [
  {
    id: 2,
    codigo: 'M1',
    nombre: 'Matemática 1',
    ...SELECCION_MULTIPLE,
    ejes: [
      {
        id: 10,
        nombre: 'Números',
        contenidos: [
          { id: 100, nombre: 'Enteros' },
          { id: 101, nombre: 'Potencias' },
        ],
      },
      { id: 11, nombre: 'Álgebra', contenidos: [{ id: 110, nombre: 'Ecuaciones' }] },
    ],
    habilidades: [
      { id: 30, nombre: 'Resolver problemas' },
      { id: 31, nombre: 'Modelar' },
    ],
  },
  {
    id: 1,
    codigo: 'CL',
    nombre: 'Competencia Lectora',
    ...SELECCION_MULTIPLE,
    requiereTexto: true,
    ejes: [{ id: 20, nombre: 'Localizar', contenidos: [{ id: 200, nombre: 'Información' }] }],
    habilidades: [{ id: 40, nombre: 'Interpretar' }],
  },
];

const ESTADOS = [
  { codigo: 'borrador', nombre: 'Borrador' },
  { codigo: 'en_revision', nombre: 'En revisión' },
  { codigo: 'publicada', nombre: 'Publicada' },
];
const DIFICULTADES = [
  { codigo: 'facil', nombre: 'Fácil' },
  { codigo: 'media', nombre: 'Media' },
];

const fila = (cambios: Partial<FilaBanco> = {}): FilaBanco => ({
  id: '7',
  resumen: 'Si 2x + 3 = 11, ¿cuánto vale x?',
  pruebaId: 2,
  contenidoId: 110,
  estado: { codigo: 'en_revision', nombre: 'En revisión' },
  origen: 'ia',
  dificultadSugerida: { codigo: 'facil', nombre: 'Fácil' },
  dificultadAsignada: null,
  posibleAmbigua: false,
  actualizadoEn: new Date('2026-10-20T12:00:00Z'),
  ...cambios,
});

/** App con el banco en memoria; guarda cada consulta que llega al repositorio. */
function escenario(filas: FilaBanco[] = [fila()], total = filas.length) {
  const consultas: ConsultaBanco[] = [];
  const repositorio: PreguntasRepositorio = {
    listarBanco: (consulta) => {
      consultas.push(consulta);
      return Promise.resolve({ filas, total });
    },
    listarEstados: () => Promise.resolve(ESTADOS),
    listarDificultades: () => Promise.resolve(DIFICULTADES),
  };
  const temario: TemarioServicio = {
    listarAreas: () => Promise.resolve([]),
    alcancePracticaValido: () => Promise.resolve(true),
    listarTemario: () => Promise.resolve(TEMARIO),
    opcionesPerfil: () => Promise.resolve({ cursos: [], pruebas: [], areasCarrera: [] }),
  };
  const preguntas = crearPreguntasServicio({
    bd: { query: () => Promise.reject(new Error('sin base')) },
    unidadDeTrabajo: { enTransaccion: () => Promise.reject(new Error('sin base')) },
    temario,
    administracion: { registrarAuditoria: () => Promise.resolve() },
    repositorio,
  });
  return { app: crearAppDePrueba({}, { preguntas, temario }), consultas };
}

const comoAdmin = async () => ({ Authorization: `Bearer ${await tokenAdmin('admin')}` });

describe('banco de preguntas: lista (HU-11, CP-08)', () => {
  it('sin filtros entrega la primera página de 20, con el estado y los nombres del temario (esc. 2)', async () => {
    const { app, consultas } = escenario([fila()], 134);

    const respuesta = await request(app)
      .get(RUTA)
      .set(await comoAdmin());

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.meta).toEqual({ pagina: 1, porPagina: 20, total: 134 });
    expect(respuesta.body.data).toEqual([
      {
        id: 7,
        resumen: 'Si 2x + 3 = 11, ¿cuánto vale x?',
        prueba: { id: 2, codigo: 'M1', nombre: 'Matemática 1' },
        eje: { id: 11, nombre: 'Álgebra' },
        contenido: { id: 110, nombre: 'Ecuaciones' },
        estado: { codigo: 'en_revision', nombre: 'En revisión' },
        origen: 'ia',
        dificultadSugerida: { codigo: 'facil', nombre: 'Fácil' },
        dificultadAsignada: null,
        posibleAmbigua: false,
        actualizadoEn: '2026-10-20T12:00:00.000Z',
      },
    ]);
    expect(consultas).toEqual([
      {
        pruebaId: undefined,
        contenidoIds: undefined,
        habilidadId: undefined,
        estado: undefined,
        origen: undefined,
        dificultad: undefined,
        limite: 20,
        desde: 0,
      },
    ]);
  });

  it('filtra por prueba, eje y contenido (esc. 1, CP-08 paso 2)', async () => {
    const { app, consultas } = escenario();

    await request(app)
      .get(`${RUTA}?prueba=2`)
      .set(await comoAdmin());
    await request(app)
      .get(`${RUTA}?prueba=2&eje=10`)
      .set(await comoAdmin());
    await request(app)
      .get(`${RUTA}?eje=10&contenido=101`)
      .set(await comoAdmin());

    expect(consultas.map(({ pruebaId, contenidoIds }) => ({ pruebaId, contenidoIds }))).toEqual([
      { pruebaId: 2, contenidoIds: undefined },
      // La pregunta no guarda el eje: elegir un eje es elegir todos sus contenidos.
      { pruebaId: 2, contenidoIds: [100, 101] },
      { pruebaId: undefined, contenidoIds: [101] },
    ]);
  });

  it('filtra por habilidad, sola o dentro de su prueba (filtro de C02)', async () => {
    const { app, consultas } = escenario();

    await request(app)
      .get(`${RUTA}?habilidad=31`)
      .set(await comoAdmin());
    await request(app)
      .get(`${RUTA}?prueba=1&habilidad=40`)
      .set(await comoAdmin());

    expect(consultas.map(({ pruebaId, habilidadId }) => ({ pruebaId, habilidadId }))).toEqual([
      { pruebaId: undefined, habilidadId: 31 },
      { pruebaId: 1, habilidadId: 40 },
    ]);
  });

  it('marca las preguntas posiblemente confusas (C02)', async () => {
    const { app } = escenario([fila({ posibleAmbigua: true })]);

    const respuesta = await request(app)
      .get(RUTA)
      .set(await comoAdmin());

    expect(respuesta.body.data[0].posibleAmbigua).toBe(true);
  });

  it('filtra por estado, origen y dificultad asignada (esc. 1, CP-08 paso 3; RF-G01)', async () => {
    const { app, consultas } = escenario();

    const respuesta = await request(app)
      .get(`${RUTA}?estado=publicada&origen=importacion&dificultad=media`)
      .set(await comoAdmin());

    expect(respuesta.status).toBe(200);
    expect(consultas[0]).toMatchObject({
      estado: 'publicada',
      origen: 'importacion',
      dificultad: 'media',
    });
  });

  it.each(['manual', 'importacion', 'ia'])('acepta el origen %s', async (origen) => {
    const { app, consultas } = escenario();

    expect(
      (
        await request(app)
          .get(`${RUTA}?origen=${origen}`)
          .set(await comoAdmin())
      ).status,
    ).toBe(200);
    expect(consultas[0]?.origen).toBe(origen);
  });

  it('pagina de a porPagina: la página 3 de 10 empieza en la fila 20 (esc. 3, CP-08 paso 4)', async () => {
    const { app, consultas } = escenario([fila()], 45);

    const respuesta = await request(app)
      .get(`${RUTA}?pagina=3&porPagina=10`)
      .set(await comoAdmin());

    expect(respuesta.body.meta).toEqual({ pagina: 3, porPagina: 10, total: 45 });
    expect(consultas[0]).toMatchObject({ limite: 10, desde: 20 });
  });

  it('una página después de la última responde vacía, con el total', async () => {
    const { app } = escenario([], 45);

    const respuesta = await request(app)
      .get(`${RUTA}?pagina=9`)
      .set(await comoAdmin());

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      data: [],
      error: null,
      meta: { pagina: 9, porPagina: 20, total: 45 },
    });
  });

  it.each([
    ['porPagina mayor que 100', 'porPagina=101', 'porPagina'],
    ['página 0', 'pagina=0', 'pagina'],
    ['un id que no es un número', 'prueba=dos', 'prueba'],
    ['un origen desconocido', 'origen=otro', 'origen'],
    ['un estado que no existe', 'estado=archivada', 'estado'],
    ['una dificultad que no existe', 'dificultad=imposible', 'dificultad'],
    ['una prueba que no existe', 'prueba=99', 'prueba'],
    ['un eje de otra prueba', 'prueba=1&eje=10', 'eje'],
    ['un contenido de otro eje', 'eje=11&contenido=100', 'contenido'],
    ['un contenido que no existe', 'contenido=999', 'contenido'],
    ['una habilidad que no existe', 'habilidad=99', 'habilidad'],
    ['una habilidad de otra prueba', 'prueba=1&habilidad=30', 'habilidad'],
  ])('rechaza %s con 400 VALIDACION, sin consultar el banco', async (_caso, consulta, campo) => {
    const { app, consultas } = escenario();

    const respuesta = await request(app)
      .get(`${RUTA}?${consulta}`)
      .set(await comoAdmin());

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION');
    expect(respuesta.body.error.detalles).toEqual([
      expect.objectContaining({ lugar: 'consulta', ruta: campo }),
    ]);
    expect(consultas).toHaveLength(0);
  });

  it('rechaza un parámetro que no es un filtro del banco', async () => {
    const { app } = escenario();

    expect(
      (
        await request(app)
          .get(`${RUTA}?orden=id`)
          .set(await comoAdmin())
      ).status,
    ).toBe(400);
  });
});

describe('banco de preguntas: opciones de los filtros', () => {
  it('entrega el temario, los estados, los tres orígenes y las dificultades', async () => {
    const { app } = escenario();

    const respuesta = await request(app)
      .get(`${RUTA}/filtros`)
      .set(await comoAdmin());

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({
      pruebas: TEMARIO,
      estados: ESTADOS,
      origenes: [
        { codigo: 'manual', nombre: 'Manual' },
        { codigo: 'importacion', nombre: 'Importada' },
        { codigo: 'ia', nombre: 'IA' },
      ],
      dificultades: DIFICULTADES,
    });
  });
});

describe('banco de preguntas: permisos', () => {
  it.each([RUTA, `${RUTA}/filtros`])('un docente recibe 403 en %s', async (ruta) => {
    const { app } = escenario();

    const respuesta = await request(app)
      .get(ruta)
      .set({ Authorization: `Bearer ${await tokenAdmin('docente')}` });

    expect(respuesta.status).toBe(403);
    expect(respuesta.body).toEqual(errorConFormato('SIN_PERMISO'));
  });

  it.each([RUTA, `${RUTA}/filtros`])('sin sesión, %s responde 401', async (ruta) => {
    const { app } = escenario();

    expect((await request(app).get(ruta)).status).toBe(401);
  });
});
