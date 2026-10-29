import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearServicios } from '../app.js';
import { crearDependenciasDePrueba } from './ayudantes.js';
import { crearBaseTemporal, exigirBaseEnCi, MINUTO, urlBase } from './base-temporal.js';

describe('parámetros de administración sin base', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('parámetros de texto con PostgreSQL', () => {
  let base: Awaited<ReturnType<typeof crearBaseTemporal>>;
  let servicio: ReturnType<typeof crearServicios>['administracion'];
  beforeAll(async () => {
    base = await crearBaseTemporal('parametros');
    servicio = crearServicios(crearDependenciasDePrueba({ bd: base.bd })).administracion;
  }, MINUTO);
  afterAll(async () => {
    await base.cerrar();
  }, MINUTO);

  it('lee el modelo desde la base en cada llamada', async () => {
    await base.bd.query(
      "UPDATE contenido.configuracion SET valor = '\"modelo-uno\"'::jsonb WHERE clave = 'modelo_ia'",
    );
    expect(await servicio.obtenerParametroTexto('modelo_ia')).toBe('modelo-uno');
    await base.bd.query(
      "UPDATE contenido.configuracion SET valor = '\"modelo-dos\"'::jsonb WHERE clave = 'modelo_ia'",
    );
    expect(await servicio.obtenerParametroTexto('modelo_ia')).toBe('modelo-dos');
  });

  it.each([123, null, '', '   ', {}])('rechaza un valor no textual válido: %j', async (valor) => {
    await base.bd.query(
      "UPDATE contenido.configuracion SET valor = $1::jsonb WHERE clave = 'modelo_ia'",
      [JSON.stringify(valor)],
    );
    await expect(servicio.obtenerParametroTexto('modelo_ia')).rejects.toThrow();
  });

  it('no sustituye una clave ausente por un modelo por defecto', async () => {
    await expect(servicio.obtenerParametroTexto('no_existe')).rejects.toThrow();
  });
});
