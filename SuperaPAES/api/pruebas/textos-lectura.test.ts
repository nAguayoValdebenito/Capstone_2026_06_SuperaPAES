// Textos de lectura por HTTP (HU-12.2, RF-G02, C03), sin PostgreSQL: listar con búsqueda, obtener,
// crear y editar textos, y crear una pregunta de Competencia Lectora junto con su texto nuevo.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { tokenAdmin } from './ayudantes.js';
import {
  CL,
  cuerpo,
  escenarioEdicion,
  RUTA_PREGUNTAS,
  TEXTO_GUARDADO,
  comoAdmin,
  problemas,
} from './edicion-de-prueba.js';
import { cuerpoTexto, RUTA_TEXTOS } from './textos-de-prueba.js';

type App = ReturnType<typeof escenarioEdicion>['app'];

async function crearTexto(app: App, datos = cuerpoTexto()) {
  return request(app)
    .post(RUTA_TEXTOS)
    .set(await comoAdmin())
    .send(datos);
}

describe('crear un texto de lectura (HU-12.2)', () => {
  it('lo guarda con su autor, responde 201 y queda en la auditoría', async () => {
    const { app, textos, auditoria } = escenarioEdicion();

    const respuesta = await crearTexto(app);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toMatchObject({
      id: 13,
      tipoTexto: 'literario',
      titulo: 'El faro del sur',
      contenido: 'Había una vez un faro con $2^{3}$ ventanas.',
      imagenUrl: null,
      preguntas: 0,
      editable: true,
    });
    expect(textos.repositorio.insertar).toHaveBeenCalledWith(
      expect.objectContaining({ titulo: 'El faro del sur' }),
      '5',
      expect.anything(),
    );
    expect(auditoria.registrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'crear_texto',
        entidad: 'texto_estimulo',
        entidadId: '13',
        antes: null,
      }),
      expect.anything(),
    );
  });

  it.each([
    ['una dirección https', 'https://superapaes.cl/imagenes/tabla.png'],
    ['una ruta relativa', 'imagenes/tabla-1.png'],
  ])('acepta una imagen con %s, aunque no tenga contenido', async (_caso, imagenUrl) => {
    const { app } = escenarioEdicion();

    const respuesta = await crearTexto(
      app,
      cuerpoTexto({ tipoTexto: 'tabla', contenido: null, imagenUrl }),
    );

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toMatchObject({ contenido: null, imagenUrl });
  });

  it.each([
    [{ tipoTexto: 'poema' }, 'tipoTexto: El tipo de texto no existe.'],
    [
      { contenido: '  ', imagenUrl: null },
      'contenido: Escribe el texto o indica la dirección de su imagen.',
    ],
    [{ titulo: '' }, 'titulo: Escribe el título del texto.'],
    [{ titulo: 'a'.repeat(201) }, 'titulo: El título puede tener hasta 200 caracteres.'],
    [{ imagenUrl: 'javascript:alert(1)' }, 'imagenUrl: La dirección de la imagen no es válida.'],
    [
      { imagenUrl: 'data:image/png;base64,AAAA' },
      'imagenUrl: La dirección de la imagen no es válida.',
    ],
  ])('rechaza %j con su motivo', async (cambios, problema) => {
    const { app, textos } = escenarioEdicion();

    const respuesta = await crearTexto(app, cuerpoTexto(cambios));

    expect(respuesta.status).toBe(400);
    expect(problemas(respuesta)).toEqual([problema]);
    expect(textos.repositorio.insertar).not.toHaveBeenCalled();
  });
});

describe('listar y obtener textos de lectura', () => {
  it('busca por título sin importar mayúsculas y entrega la paginación', async () => {
    const { app } = escenarioEdicion();
    await crearTexto(app);

    const respuesta = await request(app)
      .get(RUTA_TEXTOS)
      .query({ buscar: 'FARO' })
      .set(await comoAdmin());

    expect(respuesta.status).toBe(200);
    const titulos = (respuesta.body.data as { titulo: string }[]).map((t) => t.titulo);
    expect(titulos).toEqual(['El faro del sur']);
    expect(respuesta.body.meta).toEqual({ pagina: 1, porPagina: 20, total: 1 });
  });

  it('entrega los tipos de texto y un texto por su id; 404 si no existe', async () => {
    const { app } = escenarioEdicion();

    const tipos = await request(app)
      .get(`${RUTA_TEXTOS}/tipos`)
      .set(await comoAdmin());
    const texto = await request(app)
      .get(`${RUTA_TEXTOS}/${String(TEXTO_GUARDADO)}`)
      .set(await comoAdmin());
    const falta = await request(app)
      .get(`${RUTA_TEXTOS}/99`)
      .set(await comoAdmin());

    expect(tipos.body.data).toContainEqual({ codigo: 'literario', nombre: 'Literario' });
    expect(texto.body.data).toMatchObject({ id: 12, titulo: 'La migración de las aves' });
    expect(falta.status).toBe(404);
  });
});

describe('editar un texto de lectura', () => {
  it('lo edita si sus preguntas están en borrador u observadas, y queda en la auditoría', async () => {
    const { app, textos, auditoria } = escenarioEdicion();
    textos.usarEn('12', { nombre: 'Observada', editable: true });

    const respuesta = await request(app)
      .put(`${RUTA_TEXTOS}/12`)
      .set(await comoAdmin())
      .send(cuerpoTexto({ titulo: 'Las aves migratorias' }));

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.titulo).toBe('Las aves migratorias');
    expect(auditoria.registrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'editar_texto',
        antes: expect.objectContaining({ titulo: 'La migración de las aves' }),
        despues: expect.objectContaining({ titulo: 'Las aves migratorias' }),
      }),
      expect.anything(),
    );
  });

  it('no lo edita si una pregunta que lo usa está publicada (409, con su motivo)', async () => {
    const { app, textos } = escenarioEdicion();
    textos.usarEn('12', { nombre: 'Borrador', editable: true });
    textos.usarEn('12', { nombre: 'Publicada', editable: false });

    const respuesta = await request(app)
      .put(`${RUTA_TEXTOS}/12`)
      .set(await comoAdmin())
      .send(cuerpoTexto());

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.mensaje).toContain('«Publicada» y no se puede editar');
    expect(textos.repositorio.actualizar).not.toHaveBeenCalled();
  });

  it('editar uno que no existe responde 404', async () => {
    const { app } = escenarioEdicion();

    const respuesta = await request(app)
      .put(`${RUTA_TEXTOS}/99`)
      .set(await comoAdmin())
      .send(cuerpoTexto());

    expect(respuesta.status).toBe(404);
  });
});

describe('pregunta de Competencia Lectora con un texto nuevo (HU-12.2)', () => {
  it('crea el texto y la pregunta en la misma operación, y audita los dos', async () => {
    const { app, auditoria } = escenarioEdicion();

    const respuesta = await request(app)
      .post(RUTA_PREGUNTAS)
      .set(await comoAdmin())
      .send(cuerpo({ ...CL, textoNuevo: cuerpoTexto(), ordenEnTexto: 1 }));

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toMatchObject({ textoEstimuloId: 13, ordenEnTexto: 1 });
    const acciones = auditoria.registrarAuditoria.mock.calls.map(
      (llamada) => (llamada as unknown as [{ accion: string }])[0].accion,
    );
    expect(acciones).toEqual(['crear_texto', 'crear_pregunta']);
  });

  it.each([
    [
      'un texto guardado y uno nuevo a la vez',
      { textoEstimuloId: TEXTO_GUARDADO, textoNuevo: cuerpoTexto(), ordenEnTexto: 1 },
      'textoNuevo: Elige un texto guardado o escribe uno nuevo, no ambos.',
    ],
    [
      'un texto nuevo sin su orden',
      { textoNuevo: cuerpoTexto() },
      'ordenEnTexto: Indica el texto de lectura y el orden de la pregunta en él.',
    ],
    [
      'un texto nuevo de un tipo que no existe',
      { textoNuevo: cuerpoTexto({ tipoTexto: 'poema' }), ordenEnTexto: 1 },
      'textoNuevo.tipoTexto: El tipo de texto no existe.',
    ],
  ])('rechaza %s', async (_caso, cambios, problema) => {
    const { app, textos } = escenarioEdicion();

    const respuesta = await request(app)
      .post(RUTA_PREGUNTAS)
      .set(await comoAdmin())
      .send(cuerpo({ ...CL, ...cambios }));

    expect(respuesta.status).toBe(400);
    expect(problemas(respuesta)).toEqual([problema]);
    expect(textos.repositorio.insertar).not.toHaveBeenCalled();
  });
});

describe('permisos de los textos de lectura', () => {
  const rutas = {
    'GET /textos': (app: App) => request(app).get(RUTA_TEXTOS),
    'GET /textos/tipos': (app: App) => request(app).get(`${RUTA_TEXTOS}/tipos`),
    'GET /textos/:id': (app: App) => request(app).get(`${RUTA_TEXTOS}/12`),
    'POST /textos': (app: App) => request(app).post(RUTA_TEXTOS),
    'PUT /textos/:id': (app: App) => request(app).put(`${RUTA_TEXTOS}/12`),
  };

  it.each(Object.entries(rutas))('%s sin sesión responde 401', async (_ruta, peticion) => {
    const { app } = escenarioEdicion();

    expect((await peticion(app).send(cuerpoTexto())).status).toBe(401);
  });

  it.each(Object.entries(rutas))('%s con un docente responde 403', async (_ruta, peticion) => {
    const { app } = escenarioEdicion();

    const respuesta = await peticion(app)
      .set({ Authorization: `Bearer ${await tokenAdmin('docente')}` })
      .send(cuerpoTexto());

    expect(respuesta.status).toBe(403);
  });
});
