// HU-43 (RF-A13, CU-12 paso 1, RN-05, A43), contra PostgreSQL real: los planes activos con su precio y su
// producto en cada tienda, que la app muestra y compra. El plan Gratis no es una fila: lo muestra la app.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararPracticas } from './base-practicas.js';
import { RUTA_SUSCRIPCIONES } from './compras-de-prueba.js';

const RUTA = `${RUTA_SUSCRIPCIONES}/planes`;

interface Plan {
  nombre: string;
  alcance: { codigo: string };
  periodicidad: { codigo: string; meses: number };
  precioClp: number;
  pruebasCubiertas: number | null;
  productos: Record<string, string>;
}

exigirBaseEnCi();
describe.skipIf(!urlBase)('planes con PostgreSQL (HU-43, CU-12 paso 1)', () => {
  const base = prepararPracticas('planes');
  const { entorno } = base;
  const consultar = async () => {
    const { token } = await base.sesion(`planes${String(Date.now())}@ejemplo.cl`);
    return request(entorno.app).get(RUTA).set('Authorization', `Bearer ${token}`);
  };

  it('entrega los cuatro planes con los precios de RN-05', async () => {
    const respuesta = await consultar();

    expect(respuesta.status).toBe(200);
    const planes = respuesta.body.data as Plan[];
    expect(planes.map(({ nombre, precioClp }) => [nombre, precioClp])).toEqual([
      ['Una prueba mensual', 1990],
      ['Una prueba anual', 15990],
      ['Todas las pruebas mensual', 2990],
      ['Todas las pruebas anual', 23990],
    ]);
  });

  it('cada plan trae su alcance, su periodicidad y su producto en cada tienda', async () => {
    const planes = (await consultar()).body.data as Plan[];

    expect(planes[1]).toMatchObject({
      alcance: { codigo: 'una_prueba', nombre: 'Una prueba' },
      periodicidad: { codigo: 'anual', meses: 12 },
      pruebasCubiertas: 1,
      productos: { google_play: 'una_prueba_anual', app_store: 'una_prueba_anual' },
    });
    expect(planes[3]).toMatchObject({ alcance: { codigo: 'todas' }, pruebasCubiertas: null });
  });

  it('un plan desactivado ya no se ofrece', async () => {
    await entorno.bd.query(
      "UPDATE contenido.plan SET activo = false WHERE nombre = 'Una prueba mensual'",
    );
    try {
      const planes = (await consultar()).body.data as Plan[];

      expect(planes.map(({ nombre }) => nombre)).not.toContain('Una prueba mensual');
      expect(planes).toHaveLength(3);
    } finally {
      await entorno.bd.query(
        "UPDATE contenido.plan SET activo = true WHERE nombre = 'Una prueba mensual'",
      );
    }
  });

  it('sin sesión responde 401', async () => {
    expect((await request(entorno.app).get(RUTA)).status).toBe(401);
  });
});
