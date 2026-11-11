import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { crearServicios } from '../app.js';
import {
  consultarTemario,
  type ConsultaTemario,
} from '../modulos/temario/temario.consulta.servicio.js';
import type { PruebaTemario } from '../modulos/temario/index.js';
import {
  crearAppDePrueba,
  crearDependenciasDePrueba,
  errorConFormato,
  tokenAdmin,
  tokenApp,
} from './ayudantes.js';

const RUTA = '/api/v1/admin/temario';
const prueba: PruebaTemario = {
  id: 2,
  codigo: 'M1',
  nombre: 'Competencia Matemática 1',
  opcionesMin: 4,
  opcionesMax: 4,
  requiereTexto: false,
  tiposPregunta: [{ codigo: 'seleccion_multiple', nombre: 'Selección múltiple' }],
  habilidades: [{ id: 30, nombre: 'Modelar' }],
  ejes: [{ id: 10, nombre: 'Números', contenidos: [{ id: 100, nombre: 'Enteros' }] }],
};

const area = { id: 2, nombre: 'Matemática' };
const contenido = {
  id: 100,
  descriptores: 'Operaciones con enteros.',
  activo: false,
  curso: '1° medio',
  areaId: 2,
  areaNombre: 'Matemática',
};
const habilidad = {
  id: 30,
  pruebaId: 2,
  codigo: 'MOD',
  nombre: 'Modelar',
  criterios: 'Usa modelos matemáticos.',
};

function escenario() {
  const bd = {
    query: vi.fn().mockImplementation((sql: string) =>
      Promise.resolve({
        rows: sql.includes('contenido.contenido_tematico') ? [contenido] : [habilidad],
      }),
    ),
  };
  const servicio = {
    listarAreas: vi.fn().mockResolvedValue([area]),
    listarTemario: vi.fn().mockResolvedValue([prueba]),
  };
  return { bd, servicio };
}

describe('consulta del temario cargado / HU-10 esc. 3 / apoyo de CP-07', () => {
  it('conserva la jerarquía y devuelve el área, curso, descriptores, estado y criterios', async () => {
    const { bd, servicio } = escenario();
    const datos = await consultarTemario(servicio, bd);
    expect(datos.areas).toEqual([area]);
    expect(datos.pruebas[0]?.ejes[0]?.contenidos).toEqual([
      {
        id: 100,
        nombre: 'Enteros',
        area,
        curso: '1° medio',
        activo: false,
        descriptores: 'Operaciones con enteros.',
      },
    ]);
    expect(datos.pruebas[0]?.habilidades).toEqual([
      {
        id: 30,
        codigo: 'MOD',
        nombre: 'Modelar',
        criterios: 'Usa modelos matemáticos.',
      },
    ]);
    expect(bd.query).toHaveBeenCalledTimes(2);
    for (const [sql] of bd.query.mock.calls)
      expect((sql as string).trimStart()).toMatch(/^SELECT\b/);
  });

  it('conserva null para curso y descriptores sin inventar un valor', async () => {
    const { bd, servicio } = escenario();
    bd.query.mockResolvedValueOnce({ rows: [{ ...contenido, curso: null, descriptores: null }] });
    const datos = await consultarTemario(servicio, bd);
    expect(datos.pruebas[0]?.ejes[0]?.contenidos[0]).toMatchObject({
      curso: null,
      descriptores: null,
    });
  });

  it('no mezcla habilidades de pruebas diferentes', async () => {
    const { bd, servicio } = escenario();
    bd.query
      .mockResolvedValueOnce({ rows: [contenido] })
      .mockResolvedValueOnce({ rows: [habilidad, { ...habilidad, id: 90, pruebaId: 3 }] });
    const datos = await consultarTemario(servicio, bd);
    expect(datos.pruebas[0]?.habilidades.map((h) => h.id)).toEqual([30]);
  });

  it('detecta información incompleta en vez de omitir contenidos silenciosamente', async () => {
    const { bd, servicio } = escenario();
    bd.query.mockResolvedValueOnce({ rows: [] });
    await expect(consultarTemario(servicio, bd)).rejects.toThrow('Faltan los datos');
  });

  it('una base vacía devuelve listas vacías', async () => {
    const bd = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    const servicio = {
      listarAreas: vi.fn().mockResolvedValue([]),
      listarTemario: vi.fn().mockResolvedValue([]),
    };
    expect(await consultarTemario(servicio, bd)).toEqual({ areas: [], pruebas: [] });
  });
});

describe('GET /admin/temario', () => {
  function app() {
    const servicios = crearServicios(crearDependenciasDePrueba());
    const datos: ConsultaTemario = { areas: [], pruebas: [] };
    const consulta = vi.fn().mockResolvedValue(datos);
    return {
      app: crearAppDePrueba({}, { temario: { ...servicios.temario, consultarTemario: consulta } }),
      consulta,
      datos,
    };
  }

  it('el administrador recibe { data, error, meta }', async () => {
    const e = app();
    const respuesta = await request(e.app)
      .get(RUTA)
      .auth(await tokenAdmin(), { type: 'bearer' });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ data: e.datos, error: null, meta: null });
    expect(e.consulta).toHaveBeenCalledOnce();
  });

  it('sin sesión no ejecuta ninguna consulta', async () => {
    const e = app();
    const respuesta = await request(e.app).get(RUTA);
    expect(respuesta.status).toBe(401);
    expect(e.consulta).not.toHaveBeenCalled();
  });

  it('un docente no puede consultar el catálogo de administración', async () => {
    const e = app();
    const respuesta = await request(e.app)
      .get(RUTA)
      .auth(await tokenAdmin('docente'), { type: 'bearer' });
    expect(respuesta.status).toBe(403);
    expect(respuesta.body).toEqual(errorConFormato('SIN_PERMISO'));
    expect(e.consulta).not.toHaveBeenCalled();
  });

  it('un token de estudiante no abre la consulta de administrador', async () => {
    const e = app();
    const respuesta = await request(e.app)
      .get(RUTA)
      .auth(await tokenApp(), { type: 'bearer' });
    expect(respuesta.status).toBe(401);
    expect(e.consulta).not.toHaveBeenCalled();
  });
});
