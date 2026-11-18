// Acciones en lote del banco para llenar la app de pruebas, por HTTP y sin PostgreSQL: cuántas hay para
// cada acción, enviar a revisión y publicar sin revisión de 10 en 10 con los filtros del banco (la consulta
// de la URL, como la tabla). Las dos rutas existen siempre, solo para administradores. Lo que hacen en
// la base, clic tras clic, está en preguntas-lote-pruebas-bd.test.ts.
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { crearServicios, type Servicios } from '../app.js';
import { crearAppDePrueba, crearDependenciasDePrueba, tokenAdmin } from './ayudantes.js';

const ADMIN = '/api/v1/admin';

/** La app con los servicios de preguntas y revisión respondiendo datos fijos. */
function escenario() {
  const base = crearServicios(crearDependenciasDePrueba());
  const publicarSinRevision = vi.fn(() =>
    Promise.resolve({ publicadas: ['84'], noPublicadas: [{ id: '85', motivo: 'Sin texto.' }] }),
  );
  const contarLote = vi.fn(() => Promise.resolve({ paraRevision: 23, paraPublicar: 31 }));
  const enviarLoteARevision = vi.fn(() =>
    Promise.resolve({ enviadas: [], noEnviadas: [{ id: '85', motivo: 'Sin docentes.' }] }),
  );
  const servicios: Partial<Servicios> = {
    preguntas: { ...base.preguntas, publicarSinRevision, contarLote },
    revision: { ...base.revision, enviarLoteARevision },
  };
  const app = crearAppDePrueba({}, servicios);
  return { app, publicarSinRevision, contarLote, enviarLoteARevision };
}

const comoAdmin = async () => ({ Authorization: `Bearer ${await tokenAdmin()}` });

/** Los filtros del banco como llegan validados (con la página por omisión). */
const conPagina = (filtros: object) => ({ pagina: 1, porPagina: 20, ...filtros });

describe('acciones en lote del banco (siempre disponibles)', () => {
  it('dice cuántas hay para cada acción con los filtros del banco', async () => {
    const { app, contarLote } = escenario();

    const respuesta = await request(app)
      .get(`${ADMIN}/preguntas/lote/elegibles?prueba=2`)
      .set(await comoAdmin());

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({ paraRevision: 23, paraPublicar: 31 });
    expect(contarLote).toHaveBeenCalledWith(conPagina({ prueba: 2 }));
  });

  it('publica sin revisión las 10 siguientes del filtro y dice cuáles no', async () => {
    const { app, publicarSinRevision } = escenario();

    const respuesta = await request(app)
      .post(`${ADMIN}/preguntas/publicacion-sin-revision?prueba=2&estado=borrador`)
      .set(await comoAdmin());

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({
      publicadas: [84],
      noPublicadas: [{ id: 85, motivo: 'Sin texto.' }],
    });
    expect(publicarSinRevision).toHaveBeenCalledWith(
      expect.any(String),
      conPagina({ prueba: 2, estado: 'borrador' }),
    );
  });

  it('envía a revisión las 10 siguientes del filtro y dice cuáles no', async () => {
    const { app, enviarLoteARevision } = escenario();

    const respuesta = await request(app)
      .post(`${ADMIN}/revision/preguntas/lote`)
      .set(await comoAdmin());

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({
      enviadas: [],
      noEnviadas: [{ id: 85, motivo: 'Sin docentes.' }],
    });
    expect(enviarLoteARevision).toHaveBeenCalledWith(expect.any(String), conPagina({}));
  });

  it('rechaza un filtro inválido sin procesar nada', async () => {
    const { app, publicarSinRevision } = escenario();

    const respuesta = await request(app)
      .post(`${ADMIN}/preguntas/publicacion-sin-revision?prueba=abc`)
      .set(await comoAdmin());

    expect(respuesta.status).toBe(400);
    expect(publicarSinRevision).not.toHaveBeenCalled();
  });

  it('sin sesión de la consola responde 401', async () => {
    const { app } = escenario();

    const respuestas = await Promise.all([
      request(app).post(`${ADMIN}/preguntas/publicacion-sin-revision`),
      request(app).post(`${ADMIN}/revision/preguntas/lote`),
      request(app).get(`${ADMIN}/preguntas/lote/elegibles`),
    ]);

    expect(respuestas.map((r) => r.status)).toEqual([401, 401, 401]);
  });
});
