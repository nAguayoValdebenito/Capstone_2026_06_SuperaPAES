// Contrato fijo de conversión: rutas/campos explícitos y ningún id convertido por coincidencia de nombre.
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { CAMPOS_ID_POR_RUTA, serializarIds } from '../comun/ids-respuesta.js';
import { registro } from '../comun/registro.js';
import { tokenAdmin, tokenApp } from './ayudantes.js';
import { escenario, consultarContrato, comprobarCampos, PREFIJO } from './escenario-ids.js';

const MAXIMO = Number.MAX_SAFE_INTEGER;

describe('contrato central de ids', () => {
  it('fija cada ruta y campo convertido; agregar un campo requiere cambiar este inventario', () => {
    // Una línea por ruta, en el orden del inventario: «método ruta → campos».
    const inventario = Object.entries(CAMPOS_ID_POR_RUTA).map(
      ([ruta, campos]) => `${ruta} → ${campos.join(', ')}`,
    );
    expect(inventario).toEqual([
      'POST /api/v1/app/cuentas/registro → data.estudiante.id',
      'POST /api/v1/app/cuentas/ingreso → data.estudiante.id',
      'GET /api/v1/app/cuentas/documentos-legales/vigentes → data[].id',
      'GET /api/v1/app/cuentas/perfil → data.pruebas[], data.electivoId, data.pruebaReforzarId, data.areasCarrera[]',
      'PUT /api/v1/app/cuentas/perfil → data.pruebas[], data.electivoId, data.pruebaReforzarId, data.areasCarrera[]',
      'POST /api/v1/app/cuentas/perfil/confirmar-curso → data.pruebas[], data.electivoId, data.pruebaReforzarId, data.areasCarrera[]',
      'GET /api/v1/app/cuentas/puntajes → data.permiso.documento.id, data.puntajes[].id, data.puntajes[].pruebaId',
      'PUT /api/v1/app/cuentas/puntajes → data.permiso.documento.id, data.puntajes[].id, data.puntajes[].pruebaId',
      'POST /api/v1/app/cuentas/puntajes/permiso → data.permiso.documento.id, data.puntajes[].id, data.puntajes[].pruebaId',
      'DELETE /api/v1/app/cuentas/puntajes/permiso → data.permiso.documento.id, data.puntajes[].id, data.puntajes[].pruebaId',
      'DELETE /api/v1/app/cuentas/puntajes/:id → data.permiso.documento.id, data.puntajes[].id, data.puntajes[].pruebaId',
      'GET /api/v1/app/temario/opciones-perfil → data.pruebas[].id, data.pruebas[].electivos[].id, data.areasCarrera[].id, data.areasCarrera[].pruebasSugeridas[], data.areasCarrera[].electivoSugeridoId',
      'GET /api/v1/app/temario/opciones-practica → data.dificultades[].id, data.pruebas[].id, data.pruebas[].ejes[].id, data.pruebas[].ejes[].contenidos[].id, data.pruebas[].habilidades[].id',
      'POST /api/v1/admin/cuentas/ingreso → data.usuario.id',
      'GET /api/v1/admin/cuentas/yo → data.id, data.areas[]',
      'GET /api/v1/admin/cuentas/estudiantes → data[].id',
      'POST /api/v1/admin/cuentas/estudiantes/:id/confirmar-correo → data.id',
      'GET /api/v1/admin/administracion/usuarios-internos → data[].id, data[].areas[]',
      'POST /api/v1/admin/administracion/usuarios-internos → data.id, data.areas[]',
      'PATCH /api/v1/admin/administracion/usuarios-internos/:id → data.id, data.areas[]',
      'POST /api/v1/admin/administracion/usuarios-internos/:id/activar → data.id, data.areas[]',
      'POST /api/v1/admin/administracion/usuarios-internos/:id/desactivar → data.id, data.areas[]',
      'GET /api/v1/admin/temario/areas → data[].id',
      'GET /api/v1/admin/preguntas/ → data[].id, data[].prueba.id, data[].eje.id, data[].contenido.id',
      'GET /api/v1/admin/preguntas/filtros → data.pruebas[].id, data.pruebas[].ejes[].id, data.pruebas[].ejes[].contenidos[].id, data.pruebas[].habilidades[].id',
      'POST /api/v1/admin/preguntas/ → data.id, data.pruebaId, data.ejeId, data.contenidoId, data.habilidadId, data.textoEstimuloId, data.alternativas[].id',
      'GET /api/v1/admin/preguntas/:id → data.id, data.pruebaId, data.ejeId, data.contenidoId, data.habilidadId, data.textoEstimuloId, data.alternativas[].id',
      'PUT /api/v1/admin/preguntas/:id → data.id, data.pruebaId, data.ejeId, data.contenidoId, data.habilidadId, data.textoEstimuloId, data.alternativas[].id',
      'POST /api/v1/app/evaluaciones/practicas → data.id, data.pruebaId, data.ejeId, data.contenidoId, data.habilidadId, data.dificultadId',
      'POST /api/v1/app/evaluaciones/practicas/:id/siguiente → data.id, data.alternativas[].id',
      'POST /api/v1/app/evaluaciones/practicas/:id/cerrar → data.id, data.prueba.id, data.alcance.id, data.dificultad.id, data.ejes[].id, data.habilidades[].id',
      'GET /api/v1/app/evaluaciones/practicas/:id/resumen → data.id, data.prueba.id, data.alcance.id, data.dificultad.id, data.ejes[].id, data.habilidades[].id',
      'POST /api/v1/app/evaluaciones/:id/items/:item/respuesta → data.alternativaElegidaId, data.alternativaCorrectaId, data.alternativas[].id',
      'GET /api/v1/app/evaluaciones/progreso → data.pruebas[].pruebaId, data.pruebas[].ejes[].id, data.pruebas[].habilidades[].id, data.pruebas[].ensayos[].id',
    ]);
  });

  it('convierte ids anidados y listas, incluso las pruebas del perfil, sin tocar otros campos', () => {
    const datos = {
      perfil: { id: '84', pruebas: ['1', 2, '003'], notas: [{ id: '11' }] },
      nuevo: { id: '92' },
      token: '12345',
      codigo: '123456',
      productoId: '12345',
      opcionalId: null,
      externoId: 'producto-de-tienda',
    };
    expect(
      serializarIds(datos, [
        'data.perfil.id',
        'data.perfil.pruebas[]',
        'data.perfil.notas[].id',
        'data.opcionalId',
        'data.externoId',
      ]),
    ).toEqual({
      perfil: { id: 84, pruebas: [1, 2, 3], notas: [{ id: 11 }] },
      nuevo: { id: '92' },
      token: '12345',
      codigo: '123456',
      productoId: '12345',
      opcionalId: null,
      externoId: 'producto-de-tienda',
    });
    expect(datos.perfil.id).toBe('84'); // el servicio conserva sus tipos internos
  });

  it('acepta el máximo entero seguro y falla antes de redondear el siguiente BIGINT', () => {
    expect(serializarIds({ id: String(MAXIMO) }, ['data.id'])).toEqual({ id: MAXIMO });
    expect(() => serializarIds({ id: '9007199254740992' }, ['data.id'])).toThrow();
    expect(() => serializarIds({ id: 9007199254740992 }, ['data.id'])).toThrow();
  });
});

describe('ids en todas las rutas actuales que los devuelven', () => {
  it.each(Object.entries(CAMPOS_ID_POR_RUTA))(
    '%s entrega todos sus ids declarados como números',
    async (contrato, campos) => {
      const { app } = escenario();
      const respuesta = await consultarContrato(app, contrato);
      expect(respuesta.status).toBeLessThan(300);
      comprobarCampos(respuesta.body, campos);
    },
  );

  it('cuentas de la app: registro e ingreso', async () => {
    const { app } = escenario();
    const registro = await request(app)
      .post(`${PREFIJO}/app/cuentas/registro`)
      .send({
        nombre: 'Ana',
        correo: 'ana@ejemplo.cl',
        contrasena: 'Clave-larga-123',
        declaraTenerCatorceAnios: true,
        documentosAceptados: [1, 2],
      });
    const ingreso = await request(app).post(`${PREFIJO}/app/cuentas/ingreso`).send({
      correo: 'ana@ejemplo.cl',
      contrasena: 'Clave-larga-123',
    });
    expect(registro.status).toBe(201);
    expect(ingreso.status).toBe(200);
    expect(registro.body.data.estudiante.id).toBe(84);
    expect(ingreso.body.data.estudiante.id).toBe(84);
  });

  it('documentos legales vigentes', async () => {
    const { app } = escenario();
    const respuesta = await request(app).get(`${PREFIJO}/app/cuentas/documentos-legales/vigentes`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data[0].id).toBe(1);
  });

  it('cuentas de la consola: ingreso, yo, búsqueda y confirmación', async () => {
    const { app, cuentas } = escenario();
    const admin = { Authorization: `Bearer ${await tokenAdmin()}` };
    const ingreso = await request(app).post(`${PREFIJO}/admin/cuentas/ingreso`).send({
      correo: 'admin@ejemplo.cl',
      contrasena: 'Clave-larga-123',
    });
    const yo = await request(app).get(`${PREFIJO}/admin/cuentas/yo`).set(admin);
    const busqueda = await request(app)
      .get(`${PREFIJO}/admin/cuentas/estudiantes?correo=ana@ejemplo.cl`)
      .set(admin);
    const confirmacion = await request(app)
      .post(`${PREFIJO}/admin/cuentas/estudiantes/84/confirmar-correo`)
      .set(admin);
    expect(ingreso.body.data.usuario.id).toBe(7);
    expect(yo.body.data.id).toBe(7);
    expect(busqueda.body.data[0].id).toBe(84);
    expect(confirmacion.body.data.id).toBe(84);
    expect(cuentas.confirmarCorreo).toHaveBeenCalledWith('1', '84');
  });

  it('usuarios internos: lista, creación, edición, activación y desactivación', async () => {
    const { app, administracion } = escenario();
    const admin = { Authorization: `Bearer ${await tokenAdmin()}` };
    const ruta = `${PREFIJO}/admin/administracion/usuarios-internos`;
    const lista = await request(app).get(ruta).set(admin);
    const creacion = await request(app)
      .post(ruta)
      .set(admin)
      .send({
        nombre: 'Diego',
        correo: 'diego@ejemplo.cl',
        rol: 'docente',
        areas: [1, 2],
        contrasena: 'Clave-larga-123',
      });
    const edicion = await request(app)
      .patch(`${ruta}/7`)
      .set(admin)
      .send({ nombre: 'Diego Nuevo' });
    const activacion = await request(app).post(`${ruta}/7/activar`).set(admin);
    const desactivacion = await request(app).post(`${ruta}/7/desactivar`).set(admin);
    expect(lista.body.data[0].id).toBe(7);
    for (const respuesta of [creacion, edicion, activacion, desactivacion]) {
      expect(respuesta.status).toBeLessThan(300);
      expect(respuesta.body.data.id).toBe(7);
      expect(respuesta.body.data.areas).toEqual([1, 2]);
    }
    expect(administracion.editarUsuarioInterno).toHaveBeenCalledWith('1', '7', {
      nombre: 'Diego Nuevo',
    });
  });

  it('áreas del temario', async () => {
    const { app } = escenario();
    const respuesta = await request(app)
      .get(`${PREFIJO}/admin/temario/areas`)
      .set({ Authorization: `Bearer ${await tokenAdmin()}` });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data[0].id).toBe(4);
  });

  it('inicio y siguiente de práctica: el ítem y sus alternativas tienen ids numéricos', async () => {
    const { app, evaluaciones } = escenario();
    const appToken = { Authorization: `Bearer ${await tokenApp()}` };
    const inicio = await request(app)
      .post(`${PREFIJO}/app/evaluaciones/practicas`)
      .set(appToken)
      .send({ pruebaId: 2, cantidad: 5 });
    const siguiente = await request(app)
      .post(`${PREFIJO}/app/evaluaciones/practicas/41/siguiente`)
      .set(appToken);
    expect(inicio.status).toBe(201);
    expect(inicio.body.data.id).toBe(41);
    expect(siguiente.status).toBe(200);
    expect(siguiente.body.data.id).toBe(84);
    const alternativas = siguiente.body.data.alternativas as { id: number }[];
    expect(alternativas.map((a) => a.id)).toEqual([101, 102]);
    expect(evaluaciones.siguientePregunta).toHaveBeenCalledWith('10', '41');
  });

  it('responder: la alternativa elegida, la correcta y las alternativas tienen ids numéricos', async () => {
    const { app, evaluaciones } = escenario();
    const respuesta = await request(app)
      .post(`${PREFIJO}/app/evaluaciones/41/items/84/respuesta`)
      .set({ Authorization: `Bearer ${await tokenApp()}` })
      .send({ alternativaId: 102 });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({
      alternativaElegidaId: 102,
      alternativaCorrectaId: 101,
    });
    const alternativas = respuesta.body.data.alternativas as { id: number }[];
    expect(alternativas.map((a) => a.id)).toEqual([101, 102]);
    expect(evaluaciones.responderPregunta).toHaveBeenCalledWith('10', {
      evaluacionId: '41',
      itemId: '84',
      alternativaId: 102,
    });
  });

  it('rechaza ids de cuerpo como texto o decimales y segmentos de ruta inválidos', async () => {
    const { app } = escenario();
    const appToken = { Authorization: `Bearer ${await tokenApp()}` };
    const admin = { Authorization: `Bearer ${await tokenAdmin()}` };
    const respuestas = await Promise.all([
      request(app)
        .post(`${PREFIJO}/app/evaluaciones/practicas`)
        .set(appToken)
        .send({ pruebaId: '2', cantidad: 5 }),
      request(app)
        .post(`${PREFIJO}/app/evaluaciones/practicas`)
        .set(appToken)
        .send({ pruebaId: 2.5, cantidad: 5 }),
      request(app)
        .post(`${PREFIJO}/app/cuentas/registro`)
        .send({
          nombre: 'Ana',
          correo: 'ana@ejemplo.cl',
          contrasena: 'Clave-larga-123',
          declaraTenerCatorceAnios: true,
          documentosAceptados: ['1'],
        }),
      request(app).post(`${PREFIJO}/app/evaluaciones/practicas/41.5/siguiente`).set(appToken),
      request(app).post(`${PREFIJO}/admin/cuentas/estudiantes/abc/confirmar-correo`).set(admin),
      request(app)
        .patch(`${PREFIJO}/admin/administracion/usuarios-internos/%2241%22`)
        .set(admin)
        .send({ nombre: 'Otro' }),
      request(app)
        .post(`${PREFIJO}/app/evaluaciones/practicas/9007199254740992/siguiente`)
        .set(appToken),
      request(app)
        .post(`${PREFIJO}/app/evaluaciones/41/items/84/respuesta`)
        .set(appToken)
        .send({ alternativaId: '102' }),
      request(app)
        .post(`${PREFIJO}/app/evaluaciones/41/items/8.4/respuesta`)
        .set(appToken)
        .send({ alternativaId: 102 }),
    ]);
    for (const respuesta of respuestas) {
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.codigo).toBe('VALIDACION');
    }
  });

  it('un BIGINT de salida mayor al máximo responde 500 sin devolver el id', async () => {
    const { app, evaluaciones } = escenario();
    const errorRegistrado = vi.spyOn(registro, 'error').mockImplementation(() => {});
    evaluaciones.iniciarPractica.mockResolvedValueOnce({
      id: '9007199254740992',
      pruebaId: 2,
      ejeId: 3,
      contenidoId: null,
      habilidadId: null,
      dificultadId: null,
      dificultad: 'mezcla',
      cantidad: 5,
      entregadas: 0,
    });
    const respuesta = await request(app)
      .post(`${PREFIJO}/app/evaluaciones/practicas`)
      .set({ Authorization: `Bearer ${await tokenApp()}` })
      .send({ pruebaId: 2, cantidad: 5 });
    expect(respuesta.status).toBe(500);
    expect(respuesta.body.error.codigo).toBe('ERROR_INTERNO');
    expect(JSON.stringify(respuesta.body)).not.toContain('9007199254740992');
    expect(errorRegistrado).toHaveBeenCalledOnce();
    expect(JSON.stringify(errorRegistrado.mock.calls)).not.toContain('9007199254740992');
  });
});
