// Acciones en lote del banco para llenar la app de pruebas, por HTTP y sin PostgreSQL: enviar a revisión
// hasta 10 preguntas (siempre disponible) y publicar sin revisión hasta 10 borradores, que solo existe
// con MODO_PRUEBAS_PREGUNTAS. Lo que hacen en la base está en preguntas-lote-pruebas-bd.test.ts.
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { Servicios } from '../app.js';
import { crearAppDePrueba, crearDependenciasDePrueba, tokenAdmin } from './ayudantes.js';
import { crearServicios } from '../app.js';

const ADMIN = '/api/v1/admin';
const ONCE = Array.from({ length: 11 }, (_, i) => i + 1);

/** La app con los servicios de preguntas y revisión respondiendo datos fijos. */
function escenario(modoPruebasPreguntas: boolean) {
  const base = crearServicios(crearDependenciasDePrueba());
  const publicarSinRevision = vi.fn(() =>
    Promise.resolve({ publicadas: ['84'], noPublicadas: [{ id: '85', motivo: 'En revisión.' }] }),
  );
  const enviarLoteARevision = vi.fn(() =>
    Promise.resolve({ enviadas: [], noEnviadas: [{ id: '85', motivo: 'Sin docentes.' }] }),
  );
  const listarBanco = vi.fn(() =>
    Promise.resolve({ preguntas: [], paginacion: { pagina: 1, porPagina: 20, total: 0 } }),
  );
  const servicios: Partial<Servicios> = {
    preguntas: { ...base.preguntas, publicarSinRevision, listarBanco },
    revision: { ...base.revision, enviarLoteARevision },
  };
  const app = crearAppDePrueba({ modoPruebasPreguntas }, servicios);
  return { app, publicarSinRevision, enviarLoteARevision };
}

const comoAdmin = async () => ({ Authorization: `Bearer ${await tokenAdmin()}` });

describe('publicar sin revisión (modo de pruebas de preguntas)', () => {
  it('con el modo apagado la ruta no existe y el banco no lo anuncia', async () => {
    const { app, publicarSinRevision } = escenario(false);

    const publicar = await request(app)
      .post(`${ADMIN}/preguntas/publicacion-sin-revision`)
      .set(await comoAdmin())
      .send({ ids: [84] });
    const banco = await request(app)
      .get(`${ADMIN}/preguntas`)
      .set(await comoAdmin());

    expect(publicar.status).toBe(404);
    expect(publicarSinRevision).not.toHaveBeenCalled();
    expect(banco.body.meta.modoPruebasPreguntas).toBeUndefined();
  });

  it('con el modo encendido publica el lote, dice cuáles no y el banco lo anuncia', async () => {
    const { app, publicarSinRevision } = escenario(true);

    const publicar = await request(app)
      .post(`${ADMIN}/preguntas/publicacion-sin-revision`)
      .set(await comoAdmin())
      .send({ ids: [84, 85] });
    const banco = await request(app)
      .get(`${ADMIN}/preguntas`)
      .set(await comoAdmin());

    expect(publicar.status).toBe(200);
    expect(publicar.body.data).toEqual({
      publicadas: [84],
      noPublicadas: [{ id: 85, motivo: 'En revisión.' }],
    });
    expect(publicarSinRevision).toHaveBeenCalledWith(expect.any(String), ['84', '85']);
    expect(banco.body.meta.modoPruebasPreguntas).toBe(true);
  });

  it('acepta hasta 10 preguntas distintas por vez', async () => {
    const { app, publicarSinRevision } = escenario(true);

    const once = await request(app)
      .post(`${ADMIN}/preguntas/publicacion-sin-revision`)
      .set(await comoAdmin())
      .send({ ids: ONCE });
    const repetidas = await request(app)
      .post(`${ADMIN}/preguntas/publicacion-sin-revision`)
      .set(await comoAdmin())
      .send({ ids: [84, 84] });

    expect(once.status).toBe(400);
    expect(once.body.error.codigo).toBe('VALIDACION');
    expect(repetidas.status).toBe(400);
    expect(publicarSinRevision).not.toHaveBeenCalled();
  });

  it('sin sesión de la consola responde 401', async () => {
    const { app } = escenario(true);

    const respuesta = await request(app)
      .post(`${ADMIN}/preguntas/publicacion-sin-revision`)
      .send({ ids: [84] });

    expect(respuesta.status).toBe(401);
  });
});

describe('enviar a revisión en lote', () => {
  it('existe aunque el modo de pruebas esté apagado y dice cuáles no se enviaron', async () => {
    const { app, enviarLoteARevision } = escenario(false);

    const respuesta = await request(app)
      .post(`${ADMIN}/revision/preguntas/lote`)
      .set(await comoAdmin())
      .send({ ids: [85] });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({
      enviadas: [],
      noEnviadas: [{ id: 85, motivo: 'Sin docentes.' }],
    });
    expect(enviarLoteARevision).toHaveBeenCalledWith(expect.any(String), ['85']);
  });

  it('rechaza más de 10 preguntas o ninguna', async () => {
    const { app, enviarLoteARevision } = escenario(false);

    const once = await request(app)
      .post(`${ADMIN}/revision/preguntas/lote`)
      .set(await comoAdmin())
      .send({ ids: ONCE });
    const ninguna = await request(app)
      .post(`${ADMIN}/revision/preguntas/lote`)
      .set(await comoAdmin())
      .send({ ids: [] });

    expect([once.status, ninguna.status]).toEqual([400, 400]);
    expect(enviarLoteARevision).not.toHaveBeenCalled();
  });
});
