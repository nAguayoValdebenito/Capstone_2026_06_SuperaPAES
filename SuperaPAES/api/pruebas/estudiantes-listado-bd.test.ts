// Listado de estudiantes de la consola (C15) contra PostgreSQL real: carga sin filtro, con y sin
// suscripción vigente, intereses del perfil, orden por fecha de registro, paginación desde la API,
// filtro opcional por nombre o correo, cuentas eliminadas fuera y permisos (docente 403, estudiante 401).
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { errorConFormato } from './ayudantes.js';
import { usarBaseDeSesiones } from './base-sesiones.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { crearSuscripcion } from './datos-contingencia.js';
import { conToken, RUTA_INGRESO, RUTA_USUARIOS } from './escenario-sesiones.js';
import { crearEstudianteDePrueba } from './estudiantes-de-prueba.js';
import { estudianteConSesion } from './verificacion-de-prueba.js';

const RUTA_ESTUDIANTES = '/api/v1/admin/cuentas/estudiantes';
const CONTRASENA = 'clave-de-prueba-1';

/** Correos de una respuesta del listado, en el orden en que llegan. */
const correos = (respuesta: { body: { data: { correo: string }[] } }) =>
  respuesta.body.data.map((fila) => fila.correo);

describe('listado de estudiantes sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('listado de estudiantes con PostgreSQL (C15)', () => {
  const entorno = usarBaseDeSesiones('listado_estudiantes');
  let areaId: number | undefined;

  beforeAll(async () => {
    const { rows } = await entorno.bd.query<{ id: number }>(
      `INSERT INTO contenido.area (nombre) VALUES ('Área de prueba') RETURNING id`,
    );
    areaId = rows[0]?.id;
  });

  async function sesionAdmin() {
    const credenciales = await entorno.crearAdmin();
    const ingreso = await request(entorno.app).post(RUTA_INGRESO).send(credenciales);
    return conToken(ingreso.body.data.tokenAcceso as string);
  }

  /** Inserta un estudiante con su fecha de registro y sus áreas de carrera de interés (por código). */
  async function estudiante(
    nombre: string,
    correo: string,
    registro: string,
    intereses: string[] = [],
  ): Promise<string> {
    const id = await crearEstudianteDePrueba(entorno.bd, {
      nombre,
      correo,
      contrasena: CONTRASENA,
    });
    await entorno.bd.query('UPDATE app.estudiante SET creado_en = $2 WHERE id = $1', [
      id,
      registro,
    ]);
    await entorno.bd.query(
      `INSERT INTO app.estudiante_interes_carrera (estudiante_id, area_carrera_id, creado_en)
       SELECT $1, id, now() FROM contenido.area_carrera WHERE codigo = ANY($2::text[])`,
      [id, intereses],
    );
    return id;
  }

  /** Deja la suscripción en el estado dado (por código de contenido.estado_suscripcion). */
  async function suscripcion(estudianteId: string, estado = 'activa') {
    const id = await crearSuscripcion(entorno.bd, estudianteId);
    await entorno.bd.query(
      `UPDATE app.suscripcion
          SET estado_suscripcion_id = (SELECT id FROM contenido.estado_suscripcion WHERE codigo = $2),
              vigente = $2 IN ('activa', 'en_mora')
        WHERE id = $1`,
      [id, estado],
    );
  }

  it('sin filtro lista a todos, del registro más reciente al más antiguo, con suscripción e intereses', async () => {
    const admin = await sesionAdmin();
    const ana = await estudiante('Ana Activa', 'ana@ejemplo.cl', '2026-11-01T10:00:00Z', [
      'educacion',
      'salud',
    ]);
    const beto = await estudiante('Beto Sin Plan', 'beto@ejemplo.cl', '2026-11-03T10:00:00Z');
    const carla = await estudiante('Carla Mora', 'carla@ejemplo.cl', '2026-11-02T10:00:00Z');
    const dani = await estudiante('Dani Cancelada', 'dani@ejemplo.cl', '2026-10-30T10:00:00Z');
    await crearEstudianteDePrueba(entorno.bd, {
      correo: 'borrada@ejemplo.cl',
      contrasena: CONTRASENA,
      eliminado: true,
    });
    await suscripcion(ana);
    await suscripcion(carla, 'en_mora');
    await suscripcion(dani, 'cancelada');

    const respuesta = await request(entorno.app).get(RUTA_ESTUDIANTES).set(admin);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.meta).toEqual({ pagina: 1, porPagina: 20, total: 4 });
    expect(respuesta.body.data).toEqual([
      {
        id: Number(beto),
        nombre: 'Beto Sin Plan',
        correo: 'beto@ejemplo.cl',
        correoVerificado: false,
        suscripcionActiva: false,
        intereses: [],
      },
      {
        id: Number(carla),
        nombre: 'Carla Mora',
        correo: 'carla@ejemplo.cl',
        correoVerificado: false,
        suscripcionActiva: true,
        intereses: [],
      },
      {
        id: Number(ana),
        nombre: 'Ana Activa',
        correo: 'ana@ejemplo.cl',
        correoVerificado: false,
        suscripcionActiva: true,
        // En el orden de la lista de opciones (Salud va antes que Educación).
        intereses: ['Salud', 'Educación'],
      },
      {
        id: Number(dani),
        nombre: 'Dani Cancelada',
        correo: 'dani@ejemplo.cl',
        correoVerificado: false,
        suscripcionActiva: false,
        intereses: [],
      },
    ]);
    expect(JSON.stringify(respuesta.body)).not.toMatch(/hash|contrasena|codigo/i);
  });

  it('pagina desde la API: cada página trae sus filas y el total de todos', async () => {
    const admin = await sesionAdmin();
    for (let i = 1; i <= 5; i++) {
      await estudiante(
        `Estudiante ${String(i)}`,
        `e${String(i)}@ejemplo.cl`,
        `2026-11-0${String(i)}T10:00:00Z`,
      );
    }
    const pagina = (numero: number) =>
      request(entorno.app).get(RUTA_ESTUDIANTES).query({ pagina: numero, porPagina: 2 }).set(admin);

    const primera = await pagina(1);
    const tercera = await pagina(3);
    const despues = await pagina(4);

    expect(correos(primera)).toEqual(['e5@ejemplo.cl', 'e4@ejemplo.cl']);
    expect(primera.body.meta).toEqual({ pagina: 1, porPagina: 2, total: 5 });
    expect(correos(tercera)).toEqual(['e1@ejemplo.cl']);
    expect(despues.body.data).toEqual([]);
    expect(despues.body.meta).toEqual({ pagina: 4, porPagina: 2, total: 5 });
  });

  it('filtra por parte del nombre o del correo sin distinguir mayúsculas; vacío lista a todos', async () => {
    const admin = await sesionAdmin();
    await estudiante('Ana Activa', 'ana@ejemplo.cl', '2026-11-01T10:00:00Z');
    await estudiante('Beto Pérez', 'beto@colegio.cl', '2026-11-02T10:00:00Z');
    const buscar = (texto: string) =>
      request(entorno.app).get(RUTA_ESTUDIANTES).query({ buscar: texto }).set(admin);

    expect(correos(await buscar('PÉREZ'))).toEqual(['beto@colegio.cl']);
    expect(correos(await buscar('colegio'))).toEqual(['beto@colegio.cl']);
    expect(correos(await buscar('  '))).toEqual(['beto@colegio.cl', 'ana@ejemplo.cl']);
    const ninguno = await buscar('nadie');
    expect(ninguno.body.data).toEqual([]);
    expect(ninguno.body.meta.total).toBe(0);
  });

  it('rechaza una página o un tamaño inválidos con 400', async () => {
    const admin = await sesionAdmin();
    const pedir = (consulta: Record<string, string>) =>
      request(entorno.app).get(RUTA_ESTUDIANTES).query(consulta).set(admin);

    expect((await pedir({ pagina: '0' })).status).toBe(400);
    expect((await pedir({ porPagina: '101' })).status).toBe(400);
    expect((await pedir({ correo: 'ana@ejemplo.cl' })).status).toBe(400);
  });

  it('un docente recibe 403 y un token de estudiante 401', async () => {
    const admin = await sesionAdmin();
    const docente = { correo: 'diego@ejemplo.cl', contrasena: 'clave-de-diego-1' };
    await request(entorno.app)
      .post(RUTA_USUARIOS)
      .set(admin)
      .send({ nombre: 'Diego Docente', ...docente, rol: 'docente', areas: [areaId] });
    const ingreso = await request(entorno.app).post(RUTA_INGRESO).send(docente);
    const eva = await estudianteConSesion(entorno);

    const comoDocente = await request(entorno.app)
      .get(RUTA_ESTUDIANTES)
      .set(conToken(ingreso.body.data.tokenAcceso as string));
    const comoEstudiante = await request(entorno.app).get(RUTA_ESTUDIANTES).set(eva.sesion);

    expect(comoDocente.status).toBe(403);
    expect(comoDocente.body).toEqual(errorConFormato('SIN_PERMISO'));
    expect(comoEstudiante.status).toBe(401);
  });
});
