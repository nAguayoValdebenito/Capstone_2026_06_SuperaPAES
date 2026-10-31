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

  it('lee un número decimal sin redondearlo', async () => {
    await base.bd.query(
      "UPDATE contenido.configuracion SET valor = '0.54'::jsonb WHERE clave = 'precio_entrada_ia_gemini'",
    );
    expect(await servicio.obtenerParametroNumero('precio_entrada_ia_gemini')).toBe(0.54);
  });

  it.each(['"0.5"', 'null', 'true', '{}', '[1]'])(
    'rechaza un valor que no es un número: %s',
    async (valor) => {
      await base.bd.query(
        "UPDATE contenido.configuracion SET valor = $1::jsonb WHERE clave = 'precio_salida_ia_gemini'",
        [valor],
      );
      await expect(servicio.obtenerParametroNumero('precio_salida_ia_gemini')).rejects.toThrow();
    },
  );

  it('no inventa un número para una clave ausente', async () => {
    await expect(servicio.obtenerParametroNumero('no_existe')).rejects.toThrow();
  });
});
