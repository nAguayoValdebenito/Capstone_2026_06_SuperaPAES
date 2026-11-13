// Subir y entregar las imágenes de las preguntas por HTTP (HU-12.6), sin PostgreSQL: el
// servicio real de preguntas con las imágenes en memoria y imágenes de verdad generadas con sharp. La
// tabla, la huella única y la inmutabilidad contra la base real están en imagenes-migracion-bd.test.ts.
import { createHash } from 'node:crypto';
import request from 'supertest';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import type {
  ImagenesRepositorio,
  ImagenGuardada,
  ImagenNueva,
} from '../modulos/preguntas/preguntas.imagenes.repositorio.js';
import { errorConFormato, tokenAdmin, tokenApp } from './ayudantes.js';
import { comoAdmin, escenarioEdicion, problemas, RUTA_PREGUNTAS } from './edicion-de-prueba.js';

const RUTA_SUBIDA = `${RUTA_PREGUNTAS}/imagenes`;
const RUTA_PUBLICA = '/api/v1/recursos/imagenes';
const SIN_ARCHIVO = 'imagen: Envía el archivo de la imagen como PNG, JPEG o WebP.';

function imagenesEnMemoria() {
  const guardadas = new Map<string, ImagenNueva & { id: string }>();
  const repositorio: ImagenesRepositorio = {
    guardar: (imagen) => {
      const existente = guardadas.get(imagen.huella);
      if (existente) {
        return Promise.resolve<ImagenGuardada>({
          id: existente.id,
          ancho: existente.ancho,
          alto: existente.alto,
          bytes: existente.datos.length,
          nueva: false,
        });
      }
      const id = String(guardadas.size + 1);
      guardadas.set(imagen.huella, { ...imagen, id });
      return Promise.resolve<ImagenGuardada>({
        id,
        ancho: imagen.ancho,
        alto: imagen.alto,
        bytes: imagen.datos.length,
        nueva: true,
      });
    },
    datosPorHuella: (huella) => Promise.resolve(guardadas.get(huella)?.datos ?? null),
  };
  return { repositorio, guardadas };
}

const escenario = () => {
  const imagenes = imagenesEnMemoria();
  return { ...escenarioEdicion(undefined, undefined, imagenes.repositorio), ...imagenes };
};

const png = (ancho: number, alto: number) =>
  sharp({ create: { width: ancho, height: alto, channels: 3, background: '#1d4ed8' } })
    .png()
    .toBuffer();

const subir = async (app: ReturnType<typeof escenario>['app'], archivo: Buffer, tipo: string) =>
  request(app)
    .post(RUTA_SUBIDA)
    .set(await comoAdmin())
    .set('Content-Type', tipo)
    .send(archivo);

describe('subir una imagen (HU-12.6)', () => {
  it('guarda un PNG como WebP, devuelve su dirección y lo deja en la auditoría', async () => {
    const { app, guardadas, auditoria } = escenario();

    const respuesta = await subir(app, await png(400, 300), 'image/png');

    expect(respuesta.status).toBe(201);
    const { data } = respuesta.body as {
      data: { huella: string; direccion: string; ancho: number; alto: number; nueva: boolean };
    };
    expect(data).toMatchObject({ ancho: 400, alto: 300, nueva: true });
    expect(data.direccion).toBe(`api/v1/recursos/imagenes/${data.huella}.webp`);
    const guardada = guardadas.get(data.huella);
    expect(guardada?.datos.subarray(8, 12).toString()).toBe('WEBP');
    expect(
      createHash('sha256')
        .update(guardada?.datos ?? Buffer.alloc(0))
        .digest('hex'),
    ).toBe(data.huella);
    expect(guardada?.creadoPor).toBe('5');
    expect(auditoria.registrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: '5', accion: 'subir_imagen', entidad: 'imagen' }),
      expect.anything(),
    );
  });

  it('reduce una imagen grande a 1.600 píxeles de lado mayor, sin deformarla', async () => {
    const { app } = escenario();

    const respuesta = await subir(app, await png(3200, 1600), 'image/png');

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toMatchObject({ ancho: 1600, alto: 800 });
  });

  it('no agranda una imagen chica', async () => {
    const { app } = escenario();

    const respuesta = await subir(app, await png(50, 40), 'image/png');

    expect(respuesta.body.data).toMatchObject({ ancho: 50, alto: 40 });
  });

  it('quita los metadatos de la imagen (EXIF)', async () => {
    const { app, guardadas } = escenario();
    const conExif = await sharp({
      create: { width: 20, height: 20, channels: 3, background: '#ffffff' },
    })
      .jpeg()
      .withExif({ IFD0: { Copyright: 'Una persona' } })
      .toBuffer();
    expect((await sharp(conExif).metadata()).exif).toBeDefined();

    const respuesta = await subir(app, conExif, 'image/jpeg');

    expect(respuesta.status).toBe(201);
    const datos = guardadas.get(respuesta.body.data.huella as string)?.datos ?? Buffer.alloc(0);
    expect((await sharp(datos).metadata()).exif).toBeUndefined();
  });

  it('subir la misma imagen otra vez no guarda otra copia ni repite la auditoría', async () => {
    const { app, guardadas, auditoria } = escenario();
    const archivo = await png(100, 100);

    const primera = await subir(app, archivo, 'image/png');
    const segunda = await subir(app, archivo, 'image/png');

    expect(segunda.status).toBe(201);
    expect(segunda.body.data).toMatchObject({ huella: primera.body.data.huella, nueva: false });
    expect(guardadas.size).toBe(1);
    expect(auditoria.registrarAuditoria).toHaveBeenCalledTimes(1);
  });

  it('rechaza un SVG', async () => {
    const { app, guardadas } = escenario();
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );

    const respuesta = await subir(app, svg, 'image/svg+xml');

    expect(respuesta.status).toBe(400);
    expect(problemas(respuesta)).toEqual([SIN_ARCHIVO]);
    expect(guardadas.size).toBe(0);
  });

  it('rechaza un archivo que dice ser PNG pero no lo es', async () => {
    const { app } = escenario();

    const respuesta = await subir(app, Buffer.from('<svg></svg>'), 'image/png');

    expect(respuesta.status).toBe(400);
    expect(problemas(respuesta)).toEqual(['imagen: La imagen debe ser PNG, JPEG o WebP.']);
  });

  it('rechaza una imagen chica en bytes pero de más de 16 millones de píxeles', async () => {
    const { app, guardadas } = escenario();
    const enorme = await png(5000, 5000);
    expect(enorme.length).toBeLessThan(2 * 1024 * 1024);

    const respuesta = await subir(app, enorme, 'image/png');

    expect(respuesta.status).toBe(400);
    expect(guardadas.size).toBe(0);
  });

  it('rechaza una imagen dañada', async () => {
    const { app, guardadas } = escenario();
    const cortada = (await png(200, 200)).subarray(0, 60);

    const respuesta = await subir(app, cortada, 'image/png');

    expect(respuesta.status).toBe(400);
    expect(guardadas.size).toBe(0);
  });

  it('rechaza un archivo de más de 2 MB con 413', async () => {
    const { app, guardadas } = escenario();

    const respuesta = await subir(app, Buffer.alloc(2 * 1024 * 1024 + 1, 1), 'image/png');

    expect(respuesta.status).toBe(413);
    expect(respuesta.body.error.codigo).toBe('CUERPO_DEMASIADO_GRANDE');
    expect(guardadas.size).toBe(0);
  });

  it('rechaza una subida sin archivo', async () => {
    const { app } = escenario();

    const respuesta = await request(app)
      .post(RUTA_SUBIDA)
      .set(await comoAdmin());

    expect(respuesta.status).toBe(400);
    expect(problemas(respuesta)).toEqual([SIN_ARCHIVO]);
  });
});

describe('permisos de la subida', () => {
  it('sin sesión recibe 401', async () => {
    const { app } = escenario();

    const respuesta = await request(app)
      .post(RUTA_SUBIDA)
      .set('Content-Type', 'image/png')
      .send(await png(10, 10));

    expect(respuesta.status).toBe(401);
  });

  it('un docente recibe 403', async () => {
    const { app } = escenario();

    const respuesta = await request(app)
      .post(RUTA_SUBIDA)
      .set({ Authorization: `Bearer ${await tokenAdmin('docente', '7')}` })
      .set('Content-Type', 'image/png')
      .send(await png(10, 10));

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.codigo).toBe(errorConFormato('SIN_PERMISO').error.codigo);
  });

  it('el token de la app no sirve en la consola', async () => {
    const { app } = escenario();

    const respuesta = await request(app)
      .post(RUTA_SUBIDA)
      .set({ Authorization: `Bearer ${await tokenApp('9')}` })
      .set('Content-Type', 'image/png')
      .send(await png(10, 10));

    expect(respuesta.status).toBe(401);
  });
});

describe('entregar una imagen (ruta pública)', () => {
  async function conUnaImagen() {
    const contexto = escenario();
    const subida = await subir(contexto.app, await png(120, 90), 'image/png');
    return { ...contexto, huella: subida.body.data.huella as string };
  }

  it('la entrega sin sesión, en WebP, con caché de un año y permiso entre dominios', async () => {
    const { app, huella } = await conUnaImagen();

    const respuesta = await request(app).get(`${RUTA_PUBLICA}/${huella}.webp`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['content-type']).toBe('image/webp');
    expect(respuesta.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(respuesta.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(respuesta.headers['x-content-type-options']).toBe('nosniff');
    expect(respuesta.headers['etag']).toBe(`"${huella}"`);
    expect((respuesta.body as Buffer).subarray(8, 12).toString()).toBe('WEBP');
  });

  it('responde 304 sin cuerpo si el navegador ya tiene la imagen', async () => {
    const { app, huella } = await conUnaImagen();

    const respuesta = await request(app)
      .get(`${RUTA_PUBLICA}/${huella}.webp`)
      .set('If-None-Match', `"${huella}"`);

    expect(respuesta.status).toBe(304);
    expect(respuesta.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('una huella que no existe da 404 sin caché', async () => {
    const { app } = escenario();

    const respuesta = await request(app).get(`${RUTA_PUBLICA}/${'a'.repeat(64)}.webp`);

    expect(respuesta.status).toBe(404);
    expect(respuesta.headers['cache-control'] ?? '').not.toContain('immutable');
    expect(respuesta.body.error.codigo).toBe('NO_ENCONTRADO');
  });

  it.each(['abc.webp', `${'A'.repeat(64)}.webp`, `${'a'.repeat(64)}.png`, 'a'.repeat(64)])(
    'un nombre que no es una huella (%s) no llega a la base',
    async (nombre) => {
      const { app } = escenario();

      const respuesta = await request(app).get(`${RUTA_PUBLICA}/${nombre}`);

      expect(respuesta.status).toBe(400);
    },
  );
});
