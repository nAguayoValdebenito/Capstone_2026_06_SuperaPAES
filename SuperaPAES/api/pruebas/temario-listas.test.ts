import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { crearServicios } from '../app.js';
import {
  type AreaCarreraLista,
  crearTemarioListasRepositorio,
  type DificultadLista,
  type OpcionLista,
  type TipoEvaluacionLista,
} from '../modulos/temario/temario.listas.repositorio.js';
import { crearTemarioServicio } from '../modulos/temario/temario.servicio.js';
import {
  crearAppDePrueba,
  crearDependenciasDePrueba,
  errorConFormato,
  tokenAdmin,
  tokenApp,
} from './ayudantes.js';

const RUTA = '/api/v1/admin/temario/listas-opciones';

const dificultades: DificultadLista[] = [
  { codigo: 'facil', nombre: 'Fácil', minimo: 25, objetivo: 30, maximo: 35 },
  { codigo: 'media', nombre: 'Media', minimo: 40, objetivo: 45, maximo: 50 },
  { codigo: 'dificil', nombre: 'Difícil', minimo: 20, objetivo: 25, maximo: 30 },
];

const areasCarrera: AreaCarreraLista[] = [
  {
    codigo: 'salud',
    nombre: 'Salud',
    activa: true,
    pruebas: [
      { codigo: 'CL', nombre: 'Competencia Lectora' },
      { codigo: 'CIE', nombre: 'Ciencias' },
    ],
    electivo: 'Biología',
  },
  {
    codigo: 'ciencias_naturales',
    nombre: 'Ciencias naturales',
    activa: false,
    pruebas: [],
    electivo: null,
  },
];

const tiposEvaluacion: TipoEvaluacionLista[] = [
  {
    codigo: 'ensayo',
    nombre: 'Ensayo completo',
    modoArmado: 'Sorteo según la estructura de la prueba',
    correccionInmediata: false,
    permiteCambiarRespuesta: true,
    conTiempo: true,
    permiteElegirAlcance: false,
    permiteElegirDificultad: false,
    filtraPorNivel: false,
    entregaPuntaje: true,
    unicaPorAnioEscolar: false,
    consumeCupo: false,
    cuentaParaProgreso: true,
  },
];
const motivosAviso: OpcionLista[] = [{ codigo: 'otro', nombre: 'Otro', activa: true }];
const tiposPregunta: OpcionLista[] = [
  { codigo: 'suficiencia_datos', nombre: 'Suficiencia de datos', activa: false },
];
const tiposTexto: OpcionLista[] = [{ codigo: 'tabla', nombre: 'Tabla', activa: true }];
const todas = {
  dificultades,
  areasCarrera,
  tiposEvaluacion,
  motivosAviso,
  tiposPregunta,
  tiposTexto,
};

function bdFalsa() {
  return {
    query: vi.fn().mockImplementation((sql: string) =>
      Promise.resolve({
        rows: sql.includes('contenido.area_carrera') ? areasCarrera : dificultades,
      }),
    ),
  };
}

describe('listas de opciones de C09 / HU-64.1 / RF-C12', () => {
  it('el repositorio lee la mezcla global y las áreas solo con SELECT, por orden', async () => {
    const bd = bdFalsa();
    const repositorio = crearTemarioListasRepositorio(bd);
    expect(await repositorio.dificultades()).toEqual(dificultades);
    expect(await repositorio.areasCarrera()).toEqual(areasCarrera);
    const [sqlDificultad, sqlAreas] = bd.query.mock.calls.map(([sql]) => sql as string);
    expect(sqlDificultad).toMatch(
      /mezcla_min AS minimo, mezcla_objetivo AS objetivo, mezcla_max AS maximo/,
    );
    expect(sqlDificultad).toMatch(/ORDER BY orden/);
    expect(sqlAreas).toMatch(/area_carrera_prueba/);
    // C09 muestra también las áreas desactivadas: la consulta no las filtra.
    expect(sqlAreas).not.toMatch(/WHERE ac\.activo/);
    for (const sql of [sqlDificultad, sqlAreas]) expect(sql?.trimStart()).toMatch(/^SELECT\b/);
  });

  it('las otras listas leen su propia tabla, con las inactivas y sin datos del usuario', async () => {
    const bd = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    const repositorio = crearTemarioListasRepositorio(bd);
    await repositorio.tiposEvaluacion();
    await repositorio.opciones('motivosAviso');
    await repositorio.opciones('tiposPregunta');
    await repositorio.opciones('tiposTexto');
    const sqls = bd.query.mock.calls.map(([sql]) => sql as string);
    expect(sqls[0]).toMatch(/FROM contenido\.tipo_evaluacion te\s+JOIN contenido\.modo_armado/);
    expect(sqls[1]).toMatch(/FROM contenido\.motivo_reporte/);
    expect(sqls[2]).toMatch(/FROM contenido\.tipo_pregunta/);
    expect(sqls[3]).toMatch(/FROM contenido\.tipo_texto/);
    for (const [sql, parametros] of bd.query.mock.calls) {
      expect((sql as string).trimStart()).toMatch(/^SELECT\b/);
      expect(sql as string).not.toMatch(/WHERE/);
      expect(parametros).toBeUndefined();
    }
  });

  it('el servicio junta las seis listas tal como vienen, sin cambiarlas', async () => {
    const servicio = crearTemarioServicio({
      bd: bdFalsa(),
      unidadDeTrabajo: crearDependenciasDePrueba().unidadDeTrabajo,
      repositorioListas: {
        dificultades: vi.fn().mockResolvedValue(dificultades),
        areasCarrera: vi.fn().mockResolvedValue(areasCarrera),
        tiposEvaluacion: vi.fn().mockResolvedValue(tiposEvaluacion),
        opciones: vi
          .fn()
          .mockImplementation((lista: string) =>
            Promise.resolve({ motivosAviso, tiposPregunta, tiposTexto }[lista]),
          ),
      },
    });
    const listas = await servicio.consultarListasOpciones();
    expect(listas).toEqual(todas);
    expect(listas.areasCarrera[1]).toMatchObject({ electivo: null, pruebas: [] });
  });

  it('una base sin listas devuelve listas vacías', async () => {
    const servicio = crearTemarioServicio({
      bd: { query: vi.fn().mockResolvedValue({ rows: [] }) },
      unidadDeTrabajo: crearDependenciasDePrueba().unidadDeTrabajo,
    });
    expect(await servicio.consultarListasOpciones()).toEqual({
      dificultades: [],
      areasCarrera: [],
      tiposEvaluacion: [],
      motivosAviso: [],
      tiposPregunta: [],
      tiposTexto: [],
    });
  });
});

describe('GET /admin/temario/listas-opciones', () => {
  function app() {
    const servicios = crearServicios(crearDependenciasDePrueba());
    const consulta = vi.fn().mockResolvedValue(todas);
    return {
      app: crearAppDePrueba(
        {},
        { temario: { ...servicios.temario, consultarListasOpciones: consulta } },
      ),
      consulta,
    };
  }

  it('el administrador recibe { data, error, meta } con las dos listas', async () => {
    const e = app();
    const respuesta = await request(e.app)
      .get(RUTA)
      .auth(await tokenAdmin(), { type: 'bearer' });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      data: todas,
      error: null,
      meta: null,
    });
  });

  it('sin sesión responde 401 y no consulta', async () => {
    const e = app();
    expect((await request(e.app).get(RUTA)).status).toBe(401);
    expect(e.consulta).not.toHaveBeenCalled();
  });

  it('un docente recibe 403 SIN_PERMISO', async () => {
    const e = app();
    const respuesta = await request(e.app)
      .get(RUTA)
      .auth(await tokenAdmin('docente'), { type: 'bearer' });
    expect(respuesta.status).toBe(403);
    expect(respuesta.body).toEqual(errorConFormato('SIN_PERMISO'));
    expect(e.consulta).not.toHaveBeenCalled();
  });

  it('un token de estudiante no abre la consulta', async () => {
    const e = app();
    const respuesta = await request(e.app)
      .get(RUTA)
      .auth(await tokenApp(), { type: 'bearer' });
    expect(respuesta.status).toBe(401);
    expect(e.consulta).not.toHaveBeenCalled();
  });

  it('no existe una ruta para editar las listas (la edición de HU-64 sigue pendiente)', async () => {
    const e = app();
    const respuesta = await request(e.app)
      .put(RUTA)
      .auth(await tokenAdmin(), { type: 'bearer' })
      .send({});
    expect(respuesta.status).toBe(404);
  });
});
