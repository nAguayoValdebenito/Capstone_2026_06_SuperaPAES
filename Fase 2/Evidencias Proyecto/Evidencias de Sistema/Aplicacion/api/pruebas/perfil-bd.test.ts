// Perfil del estudiante contra PostgreSQL real (HU-29.1, RF-A04, RN-24, RN-25, CU-05): opciones de las
// pantallas A08 a A10, guardar y editar el perfil, sus rechazos con motivo y la confirmación del curso
// en marzo (A11). Carga las semillas: las pruebas y las áreas de carrera con lo que sugiere cada una.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararPerfil, RUTA_CONFIRMAR, RUTA_OPCIONES, RUTA_PERFIL } from './perfil-de-prueba.js';

/** Mediodía del 27/10/2026 en Chile (UTC-3): año escolar 2026. */
const OCTUBRE_2026 = new Date('2026-10-27T15:00:00.000Z');
/** 23:59 del 28/02/2027 en Chile: todavía año escolar 2026. */
const FIN_DE_FEBRERO_2027 = new Date('2027-03-01T02:59:00.000Z');
/** 00:01 del 01/03/2027 en Chile: empieza el año escolar 2027. */
const INICIO_DE_MARZO_2027 = new Date('2027-03-01T03:01:00.000Z');

/** Respuesta de GET /app/temario/opciones-perfil. */
interface OpcionesPerfil {
  cursos: { codigo: string; nombre: string }[];
  pruebas: { id: number; codigo: string; electivos: { id: number; nombre: string }[] }[];
  areasCarrera: {
    id: number;
    codigo: string;
    pruebasSugeridas: number[];
    electivoSugeridoId: number | null;
  }[];
}

describe('perfil sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('perfil del estudiante con PostgreSQL (HU-29.1)', () => {
  const { entorno, prueba, area, estudianteA, perfilDe, guardar, perfilSalud } =
    prepararPerfil('perfil');

  it('opciones: cursos de 1° a 4° medio y egresado, electivos de Ciencias y lo que sugiere cada área (RN-25)', async () => {
    const { sesion } = await estudianteA(OCTUBRE_2026);

    const respuesta = await request(entorno.app).get(RUTA_OPCIONES).set(sesion);

    expect(respuesta.status).toBe(200);
    const { cursos, pruebas, areasCarrera } = respuesta.body.data as OpcionesPerfil;
    expect(cursos.map((c) => c.codigo)).toEqual(['1M', '2M', '3M', '4M', 'EG']);
    const ciencias = pruebas.find((p) => p.codigo === 'CIE');
    expect(ciencias?.electivos.map((e) => e.nombre)).toEqual(['Biología', 'Física', 'Química']);
    expect(pruebas.find((p) => p.codigo === 'M1')?.electivos).toEqual([]);
    const porCodigo = new Map(areasCarrera.map((a) => [a.codigo, a]));
    expect(areasCarrera).toHaveLength(9);
    expect(porCodigo.get('salud')).toMatchObject({
      pruebasSugeridas: [prueba('CL'), prueba('M1'), prueba('CIE')],
      electivoSugeridoId: area('Biología'),
    });
    expect(porCodigo.get('ingenieria_tecnologia')).toMatchObject({
      pruebasSugeridas: [prueba('CL'), prueba('M1'), prueba('M2'), prueba('CIE')],
      electivoSugeridoId: area('Física'),
    });
    expect(porCodigo.get('ciencias_naturales')?.electivoSugeridoId).toBeNull();
    expect(porCodigo.get('derecho')?.pruebasSugeridas).toEqual([
      prueba('CL'),
      prueba('M1'),
      prueba('HCS'),
    ]);
  });

  it('sin sesión no entrega opciones ni perfil', async () => {
    const respuestas = await Promise.all([
      request(entorno.app).get(RUTA_OPCIONES),
      request(entorno.app).get(RUTA_PERFIL),
      request(entorno.app).put(RUTA_PERFIL).send(perfilSalud()),
    ]);

    expect(respuestas.map((r) => r.status)).toEqual([401, 401, 401]);
  });

  it('un estudiante recién registrado tiene el perfil sin completar (CU-05 paso 1)', async () => {
    const { sesion } = await estudianteA(OCTUBRE_2026);

    const respuesta = await perfilDe(sesion);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({
      completo: false,
      curso: null,
      anioEgreso: null,
      pruebas: [],
      electivoId: null,
      pruebaReforzarId: null,
      areasCarrera: [],
      debeConfirmarCurso: false,
    });
  });

  it('guarda el curso como año de egreso, las pruebas, el electivo, la prueba a reforzar y las áreas (esc. 1 a 5)', async () => {
    const { id, sesion } = await estudianteA(OCTUBRE_2026);

    const respuesta = await guardar(sesion, perfilSalud());

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({
      completo: true,
      curso: { codigo: '3M', nombre: '3° medio' },
      anioEgreso: 2027,
      pruebas: [prueba('CL'), prueba('M1'), prueba('CIE')].sort((a, b) => a - b),
      electivoId: area('Biología'),
      pruebaReforzarId: prueba('M1'),
      areasCarrera: [1],
      debeConfirmarCurso: false,
    });
    expect((await perfilDe(sesion)).body.data).toEqual(respuesta.body.data);
    const filas = await entorno.bd.query<{ prueba: string; principal: boolean; electivo: boolean }>(
      `SELECT p.codigo AS prueba, ep.es_principal AS principal, ep.electivo_area_id IS NOT NULL AS electivo
         FROM app.estudiante_prueba ep JOIN contenido.prueba p ON p.id = ep.prueba_id
        WHERE ep.estudiante_id = $1 ORDER BY p.codigo`,
      [id],
    );
    expect(filas.rows).toEqual([
      { prueba: 'CIE', principal: false, electivo: true },
      { prueba: 'CL', principal: false, electivo: false },
      { prueba: 'M1', principal: true, electivo: false },
    ]);
  });

  it('al editar, cambia todo y las áreas que siguen marcadas conservan su fecha (esc. 9, CU-05 1.b)', async () => {
    const { id, sesion } = await estudianteA(OCTUBRE_2026);
    await guardar(sesion, { ...perfilSalud(), areasCarrera: [1, 2] });
    entorno.avanzarSegundos(60);

    const respuesta = await guardar(sesion, {
      curso: '4M',
      pruebas: [prueba('CL'), prueba('M1'), prueba('HCS')],
      areasCarrera: [2, 6],
    });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({
      curso: { codigo: '4M' },
      anioEgreso: 2026,
      electivoId: null,
      pruebaReforzarId: null,
      areasCarrera: [2, 6],
    });
    const fechas = await entorno.bd.query<{ area: number; creado: Date }>(
      `SELECT area_carrera_id AS area, creado_en AS creado FROM app.estudiante_interes_carrera
        WHERE estudiante_id = $1 ORDER BY area_carrera_id`,
      [id],
    );
    expect(fechas.rows[0]?.creado.getTime()).toBe(OCTUBRE_2026.getTime());
    expect(fechas.rows[1]?.creado.getTime()).toBe(OCTUBRE_2026.getTime() + 60_000);
  });

  it.each([
    ['Ciencias sin electivo (CU-05 6.a)', { electivoId: null }, 'electivoId', 'electivo_requerido'],
    [
      'un electivo que no es de Ciencias',
      { electivoId: 'Lenguaje' },
      'electivoId',
      'electivo_invalido',
    ],
    [
      'electivo sin rendir Ciencias',
      { pruebas: ['CL', 'M1'], pruebaReforzarId: null },
      'electivoId',
      'electivo_invalido',
    ],
    [
      'una cuarta área de carrera (CU-05 4.b)',
      { areasCarrera: [1, 2, 3, 4] },
      'areasCarrera',
      'tope_areas_carrera',
    ],
    [
      'un área de carrera inexistente',
      { areasCarrera: [99] },
      'areasCarrera',
      'area_carrera_inexistente',
    ],
    [
      'una prueba a reforzar que no rinde',
      { pruebaReforzarId: 'M2' },
      'pruebaReforzarId',
      'reforzar_fuera_de_pruebas',
    ],
    ['egresado sin año', { curso: 'EG' }, 'anioEgreso', 'anio_egreso_requerido'],
    [
      'egresado este año escolar',
      { curso: 'EG', anioEgreso: 2026 },
      'anioEgreso',
      'anio_egreso_invalido',
    ],
    ['año de egreso con un curso', { anioEgreso: 2024 }, 'anioEgreso', 'anio_egreso_invalido'],
    [
      'una prueba inexistente',
      { pruebas: ['CL', 999], electivoId: null, pruebaReforzarId: null },
      'pruebas',
      'prueba_inexistente',
    ],
  ] as const)('rechaza %s con su motivo y no guarda nada', async (_caso, cambios, ruta, motivo) => {
    const { sesion } = await estudianteA(OCTUBRE_2026);
    const cuerpo: Record<string, unknown> = { ...perfilSalud(), ...cambios };
    // Los códigos se traducen a ids de la base temporal; los números quedan tal cual.
    const id = (valor: unknown) =>
      typeof valor === 'string' ? prueba(valor) || area(valor) : valor;
    if (Array.isArray(cuerpo['pruebas'])) cuerpo['pruebas'] = cuerpo['pruebas'].map(id);
    for (const campo of ['electivoId', 'pruebaReforzarId'] as const)
      cuerpo[campo] = id(cuerpo[campo]);

    const respuesta = await guardar(sesion, cuerpo);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION');
    expect(respuesta.body.error.detalles).toContainEqual(expect.objectContaining({ ruta, motivo }));
    expect((await perfilDe(sesion)).body.data.completo).toBe(false);
  });

  it('el curso sube en marzo y la app pide confirmarlo una vez (esc. 8, CU-05 1.a)', async () => {
    const estudiante = await estudianteA(OCTUBRE_2026);
    await guardar(estudiante.sesion, perfilSalud());

    entorno.fijarHora(FIN_DE_FEBRERO_2027);
    const febrero = await perfilDe(await estudiante.nuevaSesion());
    entorno.fijarHora(INICIO_DE_MARZO_2027);
    const sesionDeMarzo = await estudiante.nuevaSesion();
    const marzo = await perfilDe(sesionDeMarzo);
    const confirmacion = await request(entorno.app)
      .post(RUTA_CONFIRMAR)
      .set(sesionDeMarzo)
      .send({ curso: '4M' });

    expect(febrero.body.data).toMatchObject({ curso: { codigo: '3M' }, debeConfirmarCurso: false });
    expect(marzo.body.data).toMatchObject({ curso: { codigo: '4M' }, debeConfirmarCurso: true });
    expect(confirmacion.status).toBe(200);
    expect(confirmacion.body.data).toMatchObject({
      curso: { codigo: '4M' },
      anioEgreso: 2027,
      debeConfirmarCurso: false,
    });
  });

  it('en marzo el estudiante puede corregir su curso si repite (A11)', async () => {
    const estudiante = await estudianteA(OCTUBRE_2026);
    await guardar(estudiante.sesion, perfilSalud());
    entorno.fijarHora(INICIO_DE_MARZO_2027);

    const respuesta = await request(entorno.app)
      .post(RUTA_CONFIRMAR)
      .set(await estudiante.nuevaSesion())
      .send({ curso: '3M' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({
      curso: { codigo: '3M' },
      anioEgreso: 2028,
      debeConfirmarCurso: false,
    });
  });

  it('a quien ya egresó no se le pide confirmar el curso en marzo', async () => {
    const estudiante = await estudianteA(OCTUBRE_2026);
    await guardar(estudiante.sesion, { ...perfilSalud(), curso: 'EG', anioEgreso: 2025 });
    entorno.fijarHora(INICIO_DE_MARZO_2027);

    const respuesta = await perfilDe(await estudiante.nuevaSesion());

    expect(respuesta.body.data).toMatchObject({
      curso: { codigo: 'EG', nombre: 'Egresado' },
      anioEgreso: 2025,
      debeConfirmarCurso: false,
    });
  });

  it('confirmar el curso sin perfil completo responde 409', async () => {
    const { sesion } = await estudianteA(OCTUBRE_2026);

    const respuesta = await request(entorno.app)
      .post(RUTA_CONFIRMAR)
      .set(sesion)
      .send({ curso: '3M' });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.codigo).toBe('CONFLICTO');
  });
});
