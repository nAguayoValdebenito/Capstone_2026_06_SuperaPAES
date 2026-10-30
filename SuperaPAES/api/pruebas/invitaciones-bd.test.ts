// HU-46.1 (RF-A12, CU-11 paso 2, RN-33) contra PostgreSQL real: el estudiante ve su código propio, el
// link a la página de invitación de la consola y cuántos se registraron con su código y cuántos
// verificaron su correo; nada de otro estudiante.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { URL_CONSOLA_DE_PRUEBA } from './ayudantes.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { crearEstudianteDePrueba } from './estudiantes-de-prueba.js';
import { prepararRespuestas } from './respuestas-de-prueba.js';

const RUTA = '/api/v1/app/cupo-invitaciones/invitaciones';

exigirBaseEnCi();
describe.skipIf(!urlBase)('invitaciones con PostgreSQL (HU-46.1)', () => {
  const { base, entorno } = prepararRespuestas('invitaciones');

  const consultar = (token: string) =>
    request(entorno.app).get(RUTA).set('Authorization', `Bearer ${token}`);

  /** Un invitado de `invitanteId`, con el correo verificado o no. */
  async function invitado(invitanteId: string, correo: string, verificado: boolean) {
    const id = await crearEstudianteDePrueba(entorno.bd, {
      correo,
      contrasena: 'clave-para-practicar',
      correoVerificado: verificado,
    });
    await entorno.bd.query(
      `INSERT INTO app.invitacion (invitante_id, invitado_id, registrado_en, verificado_en)
       VALUES ($1, $2, now(), CASE WHEN $3 THEN now() END)`,
      [invitanteId, id, verificado],
    );
  }

  it('entrega el código propio, el link a la página de invitación y los contadores', async () => {
    const ana = await base.sesion('ana@ejemplo.cl');
    await invitado(ana.id, 'uno@ejemplo.cl', true);
    await invitado(ana.id, 'dos@ejemplo.cl', false);
    await invitado(ana.id, 'tres@ejemplo.cl', false);
    const beto = await base.sesion('beto@ejemplo.cl');
    await invitado(beto.id, 'cuatro@ejemplo.cl', true);
    const { rows } = await entorno.bd.query<{ codigo: string }>(
      'SELECT codigo_invitacion AS codigo FROM app.estudiante WHERE id = $1',
      [ana.id],
    );
    const codigo = rows[0]?.codigo ?? '';

    const respuesta = await consultar(ana.token);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({
      codigo,
      link: `${URL_CONSOLA_DE_PRUEBA}/invitar/${codigo}`,
      registrados: 3,
      verificados: 1,
    });
    expect(codigo).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });

  it('sin invitados, los contadores en cero', async () => {
    const { token } = await base.sesion('nueva@ejemplo.cl');

    const respuesta = await consultar(token);

    expect(respuesta.body.data).toMatchObject({ registrados: 0, verificados: 0 });
  });

  it('exige sesión', async () => {
    expect((await request(entorno.app).get(RUTA)).status).toBe(401);
  });
});
