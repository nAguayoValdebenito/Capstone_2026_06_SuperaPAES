// El total de avisos de error pendientes, para el contador del menú de la consola (D3), por HTTP y sin
// PostgreSQL: el servicio real de preguntas con el repositorio de avisos en memoria.
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { AvisosRepositorio } from '../modulos/preguntas/preguntas.avisos.repositorio.js';
import { tokenAdmin } from './ayudantes.js';
import { comoAdmin, escenarioEdicion, RUTA_PREGUNTAS } from './edicion-de-prueba.js';

const RUTA = `${RUTA_PREGUNTAS}/avisos/pendientes`;

function escenario() {
  const contarPendientes = vi.fn(() => Promise.resolve(7));
  const avisos = { contarPendientes } as unknown as AvisosRepositorio;
  return { ...escenarioEdicion(undefined, avisos), contarPendientes };
}

describe('GET /admin/preguntas/avisos/pendientes', () => {
  it('el administrador recibe el total de avisos pendientes de todo el banco', async () => {
    const { app, contarPendientes } = escenario();
    const respuesta = await request(app)
      .get(RUTA)
      .set(await comoAdmin());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ data: { pendientes: 7 }, error: null, meta: null });
    expect(contarPendientes).toHaveBeenCalledTimes(1);
  });

  it('el docente no puede pedirlo (403) y sin sesión tampoco (401)', async () => {
    const { app, contarPendientes } = escenario();
    const docente = { Authorization: `Bearer ${await tokenAdmin('docente', '21')}` };
    expect((await request(app).get(RUTA).set(docente)).status).toBe(403);
    expect((await request(app).get(RUTA)).status).toBe(401);
    expect(contarPendientes).not.toHaveBeenCalled();
  });
});
