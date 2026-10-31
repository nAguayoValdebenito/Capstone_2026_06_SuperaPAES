// Crear, obtener y editar preguntas por HTTP (HU-12.1, RF-G02, RF-G09, RN-08, CP-09), sin PostgreSQL:
// el servicio real sobre un temario y un repositorio en memoria (edicion-de-prueba.ts).
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorConFormato, tokenAdmin } from './ayudantes.js';
import {
  alternativas,
  CL,
  cuerpo,
  escenarioEdicion,
  M2,
  RUTA_PREGUNTAS,
  TEXTO_GUARDADO,
  comoAdmin,
  problemas,
} from './edicion-de-prueba.js';

async function crear(app: ReturnType<typeof escenarioEdicion>['app'], datos = cuerpo()) {
  return request(app)
    .post(RUTA_PREGUNTAS)
    .set(await comoAdmin())
    .send(datos);
}

describe('crear una pregunta (HU-12.1, CU-15)', () => {
  it('queda en borrador, con su autor, sus alternativas y su eje; responde 201 (esc. 4)', async () => {
    const { app, repositorio, auditoria } = escenarioEdicion();

    const respuesta = await crear(app);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toMatchObject({
      id: 7,
      pruebaId: 2,
      ejeId: 11,
      contenidoId: 110,
      habilidadId: 30,
      tipoPregunta: 'seleccion_multiple',
      dificultadSugerida: 'media',
      estado: { codigo: 'borrador', nombre: 'Borrador' },
      editable: true,
      origen: 'manual',
      textoEstimuloId: null,
    });
    expect(respuesta.body.data.alternativas).toHaveLength(4);
    expect(respuesta.body.data.alternativas[0]).toEqual({
      id: 100,
      letra: 'A',
      texto: 'Opción A',
      esCorrecta: true,
      explicacion: null,
    });
    expect(repositorio.fijarAutor).toHaveBeenCalledWith('5', expect.anything());
    expect(repositorio.insertar).toHaveBeenCalledWith(
      expect.objectContaining({ enunciado: 'Si $2x + 3 = 11$, ¿cuánto vale $x$?' }),
      '5',
      expect.anything(),
    );
    expect(auditoria.registrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: '5',
        accion: 'crear_pregunta',
        entidad: 'pregunta',
        entidadId: '7',
        antes: null,
      }),
      expect.anything(),
    );
  });

  it('CP-09: rechaza una de M1 con 5 alternativas, con su motivo', async () => {
    const { app, repositorio } = escenarioEdicion();

    const respuesta = await crear(app, cuerpo({ alternativas: alternativas(5) }));

    expect(respuesta.status).toBe(400);
    expect(problemas(respuesta)).toEqual([
      'alternativas: Competencia Matemática 1 lleva 4 alternativas.',
    ]);
    expect(repositorio.insertar).not.toHaveBeenCalled();
  });

  it('CP-09: acepta una de M2 con 5 alternativas', async () => {
    const { app } = escenarioEdicion();

    const respuesta = await crear(app, cuerpo({ ...M2, alternativas: alternativas(5, ['E']) }));

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.alternativas).toHaveLength(5);
  });

  it('M2 tampoco acepta 3 alternativas: dice que lleva 4 o 5', async () => {
    const { app } = escenarioEdicion();

    const respuesta = await crear(app, cuerpo({ ...M2, alternativas: alternativas(3) }));

    expect(problemas(respuesta)).toEqual([
      'alternativas: Competencia Matemática 2 lleva 4 o 5 alternativas.',
    ]);
  });

  it.each([
    [['A', 'C'], 'Marca una sola alternativa correcta.'],
    [[], 'Marca la alternativa correcta.'],
  ])('CP-09: con las correctas %j responde «%s»', async (correctas, mensaje) => {
    const { app } = escenarioEdicion();

    const respuesta = await crear(app, cuerpo({ alternativas: alternativas(4, correctas) }));

    expect(respuesta.status).toBe(400);
    expect(problemas(respuesta)).toEqual([`alternativas: ${mensaje}`]);
  });

  it('CP-09: rechaza una de Competencia Lectora sin su texto de lectura (esc. 2)', async () => {
    const { app } = escenarioEdicion();

    const respuesta = await crear(app, cuerpo({ ...CL }));

    expect(respuesta.status).toBe(400);
    expect(problemas(respuesta)).toEqual([
      'textoEstimuloId: En Competencia Lectora cada pregunta va con su texto de lectura.',
    ]);
  });

  it('acepta una de Competencia Lectora con un texto guardado y su orden', async () => {
    const { app } = escenarioEdicion();

    const respuesta = await crear(
      app,
      cuerpo({ ...CL, textoEstimuloId: TEXTO_GUARDADO, ordenEnTexto: 2 }),
    );

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toMatchObject({ textoEstimuloId: 12, ordenEnTexto: 2 });
  });

  it('rechaza un texto de lectura que no existe', async () => {
    const { app } = escenarioEdicion();

    const respuesta = await crear(app, cuerpo({ ...CL, textoEstimuloId: 99, ordenEnTexto: 1 }));

    expect(problemas(respuesta)).toEqual(['textoEstimuloId: El texto de lectura no existe.']);
  });

  it('el texto de lectura y su orden van juntos', async () => {
    const { app } = escenarioEdicion();

    const respuesta = await crear(app, cuerpo({ ...CL, textoEstimuloId: TEXTO_GUARDADO }));

    expect(problemas(respuesta)).toEqual([
      'ordenEnTexto: Indica el texto de lectura y el orden de la pregunta en él.',
    ]);
  });

  it('rechaza el contenido, la habilidad y el tipo que no son de la prueba, todo de una vez', async () => {
    const { app } = escenarioEdicion();

    const respuesta = await crear(
      app,
      cuerpo({
        contenidoId: M2.contenidoId,
        habilidadId: CL.habilidadId,
        tipoPregunta: 'suficiencia_datos',
      }),
    );

    expect(problemas(respuesta)).toEqual([
      'contenidoId: El contenido no es de Competencia Matemática 1.',
      'habilidadId: La habilidad no es de Competencia Matemática 1.',
      'tipoPregunta: Competencia Matemática 1 no admite ese tipo de pregunta.',
    ]);
  });

  it.each([
    ['la prueba', { pruebaId: 9 }, 'pruebaId: La prueba no existe.'],
    [
      'la dificultad',
      { dificultadSugerida: 'extrema' },
      'dificultadSugerida: La dificultad no existe.',
    ],
  ])('rechaza %s que no existe', async (_nombre, cambios, problema) => {
    const { app } = escenarioEdicion();

    expect(problemas(await crear(app, cuerpo(cambios)))).toEqual([problema]);
  });

  it('las letras van seguidas desde la A, sin repetir', async () => {
    const { app } = escenarioEdicion();
    const [a, b, c] = alternativas(4);

    const respuesta = await crear(
      app,
      cuerpo({ alternativas: [a, b, c, { ...a, esCorrecta: false }] }),
    );

    expect(problemas(respuesta)).toEqual([
      'alternativas: Las alternativas van con letras seguidas desde la A, sin repetir.',
    ]);
  });

  it.each([
    ['sin enunciado', { enunciado: '   ' }, 'enunciado'],
    ['sin explicación', { explicacion: '' }, 'explicacion'],
    ['con un campo desconocido', { autorId: 1 }, ''],
    ['con el id como texto', { pruebaId: '2' }, 'pruebaId'],
  ])('rechaza una pregunta %s', async (_caso, cambios, ruta) => {
    const { app } = escenarioEdicion();

    const respuesta = await crear(app, cuerpo(cambios));

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.detalles[0].ruta).toBe(ruta);
  });
});

describe('obtener y editar una pregunta (HU-12.1, RF-G09)', () => {
  it('obtiene la pregunta con la correcta; 404 si no existe', async () => {
    const { app } = escenarioEdicion();
    await crear(app);

    const encontrada = await request(app)
      .get(`${RUTA_PREGUNTAS}/7`)
      .set(await comoAdmin());
    const falta = await request(app)
      .get(`${RUTA_PREGUNTAS}/8`)
      .set(await comoAdmin());

    expect(encontrada.status).toBe(200);
    expect(encontrada.body.data).toMatchObject({ id: 7, ejeId: 11, enunciado: expect.any(String) });
    expect(falta.status).toBe(404);
    expect(falta.body).toEqual(errorConFormato('NO_ENCONTRADO'));
  });

  it('edita una en borrador, cambia sus alternativas por letra y lo deja en la auditoría', async () => {
    const { app, repositorio, auditoria } = escenarioEdicion();
    await crear(app);

    const respuesta = await request(app)
      .put(`${RUTA_PREGUNTAS}/7`)
      .set(await comoAdmin())
      .send(cuerpo({ ...M2, enunciado: 'Nuevo enunciado', alternativas: alternativas(5, ['E']) }));

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({
      enunciado: 'Nuevo enunciado',
      pruebaId: 3,
      ejeId: 31,
    });
    // La A conserva su id: se cambia por letra, no se borra y se vuelve a crear.
    const alternativasEditadas = respuesta.body.data.alternativas as { id: number }[];
    expect(alternativasEditadas.map((a) => a.id)).toEqual([100, 101, 102, 103, 104]);
    expect(repositorio.quitarAlternativas).toHaveBeenLastCalledWith(
      '7',
      ['A', 'B', 'C', 'D', 'E'],
      expect.anything(),
    );
    expect(auditoria.registrarAuditoria).toHaveBeenLastCalledWith(
      expect.objectContaining({
        accion: 'editar_pregunta',
        antes: expect.objectContaining({ enunciado: 'Si $2x + 3 = 11$, ¿cuánto vale $x$?' }),
        despues: expect.objectContaining({ enunciado: 'Nuevo enunciado' }),
      }),
      expect.anything(),
    );
  });

  it('RF-G09: una pregunta aprobada no se edita (409, con su motivo)', async () => {
    const { app, repositorio, ponerEtapa } = escenarioEdicion();
    await crear(app);
    ponerEtapa('7', { codigo: 'aprobada', nombre: 'Aprobada' }, false);

    const respuesta = await request(app)
      .put(`${RUTA_PREGUNTAS}/7`)
      .set(await comoAdmin())
      .send(cuerpo({ enunciado: 'Cambio' }));

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.mensaje).toContain('«Aprobada» y no se puede editar');
    expect(respuesta.body.error.mensaje).toContain('RF-G09');
    expect(repositorio.actualizar).not.toHaveBeenCalled();
  });

  it('editar una que no existe responde 404', async () => {
    const { app } = escenarioEdicion();

    const respuesta = await request(app)
      .put(`${RUTA_PREGUNTAS}/8`)
      .set(await comoAdmin())
      .send(cuerpo());

    expect(respuesta.status).toBe(404);
  });

  it('un rechazo de los triggers llega como 409 con su motivo, sin el SQL', async () => {
    const { app, repositorio } = escenarioEdicion();
    await crear(app);
    const rechazo = Object.assign(
      new Error('La pregunta no se puede editar en la etapa en_revision'),
      {
        code: 'P0001',
      },
    );
    repositorio.actualizar.mockRejectedValueOnce(rechazo);

    const respuesta = await request(app)
      .put(`${RUTA_PREGUNTAS}/7`)
      .set(await comoAdmin())
      .send(cuerpo());

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.mensaje).toBe(
      'La pregunta no se puede editar en la etapa en_revision',
    );
  });

  it('quitar una alternativa que ya está en una versión guardada responde 409', async () => {
    const { app, repositorio } = escenarioEdicion();
    await crear(app);
    const enUso = Object.assign(new Error('viola la llave foránea'), {
      code: '23503',
      table: 'pregunta_version',
    });
    repositorio.quitarAlternativas.mockRejectedValueOnce(enUso);

    const respuesta = await request(app)
      .put(`${RUTA_PREGUNTAS}/7`)
      .set(await comoAdmin())
      .send(cuerpo());

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.mensaje).not.toContain('llave');
  });
});

describe('permisos de crear y editar preguntas', () => {
  type App = ReturnType<typeof escenarioEdicion>['app'];
  const rutas = {
    'POST /preguntas': (app: App) => request(app).post(RUTA_PREGUNTAS),
    'GET /preguntas/:id': (app: App) => request(app).get(`${RUTA_PREGUNTAS}/7`),
    'PUT /preguntas/:id': (app: App) => request(app).put(`${RUTA_PREGUNTAS}/7`),
  };

  it.each(Object.entries(rutas))('%s sin sesión responde 401', async (_ruta, peticion) => {
    const { app } = escenarioEdicion();

    expect((await peticion(app).send(cuerpo())).status).toBe(401);
  });

  it.each(Object.entries(rutas))('%s con un docente responde 403', async (_ruta, peticion) => {
    const { app } = escenarioEdicion();

    const respuesta = await peticion(app)
      .set({ Authorization: `Bearer ${await tokenAdmin('docente')}` })
      .send(cuerpo());

    expect(respuesta.status).toBe(403);
  });
});
