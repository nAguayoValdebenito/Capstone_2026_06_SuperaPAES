// Documentos legales vigentes contra PostgreSQL real (HU-01.1, RN-30, CP-01): la ruta pública que usan el
// registro de la app y las páginas /terminos y /privacidad de la consola. Carga la semilla 003.
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { ejecutarSemillas } from '../db/semillas.js';
import { URL_CONSOLA_DE_PRUEBA } from './ayudantes.js';
import { usarBaseDeSesiones } from './base-sesiones.js';
import { exigirBaseEnCi, MINUTO, urlBase } from './base-temporal.js';

const RUTA = '/api/v1/app/cuentas/documentos-legales/vigentes';
const CARPETA_SEMILLAS = path.join(import.meta.dirname, '../db/semillas');

interface Documento {
  id: number;
  tipo: string;
  nombre: string;
  version: string;
  texto: string;
  vigenteDesde: string;
}

describe('documentos legales vigentes sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('documentos legales vigentes con PostgreSQL', () => {
  const entorno = usarBaseDeSesiones('documentos');

  beforeAll(async () => {
    const todas = (await readdir(CARPETA_SEMILLAS)).filter((nombre) => nombre.endsWith('.sql'));
    await ejecutarSemillas(
      entorno.bd,
      CARPETA_SEMILLAS,
      todas.filter((nombre) => nombre !== '003_documentos_legales.sql'),
    );
  }, MINUTO);

  const pedir = async () => (await request(entorno.app).get(RUTA)).body.data as Documento[];
  const publicar = (version: string, vigenteDesde: Date) =>
    entorno.bd.query<{ id: number }>(
      `INSERT INTO contenido.documento_legal (tipo_documento_legal_id, version, contenido, vigente_desde)
       SELECT id, $1, $2, $3 FROM contenido.tipo_documento_legal WHERE codigo = 'terminos'
       RETURNING id`,
      [version, `Términos ${version}`, vigenteDesde],
    );

  it('es pública y entrega términos y privacidad 1.0 con id, tipo, versión, texto y fecha de vigencia', async () => {
    const respuesta = await request(entorno.app).get(RUTA);

    expect(respuesta.status).toBe(200);
    const documentos = respuesta.body.data as Documento[];
    expect(documentos.map((d) => [d.tipo, d.version])).toEqual([
      ['terminos', '1.0'],
      ['privacidad', '1.0'],
    ]);
    expect(documentos[0]).toMatchObject({
      id: expect.any(Number) as number,
      nombre: 'Términos y condiciones',
      vigenteDesde: '2026-10-19T03:00:00.000Z',
    });
    expect(documentos[0]?.texto).toMatch(/^# Términos y condiciones/);
    // El permiso de puntajes no es obligatorio: no se acepta al registrarse.
    expect(documentos.some((d) => d.tipo === 'puntajes')).toBe(false);
  });

  it('de cada tipo entrega la versión con mayor vigencia que ya empezó; una futura todavía no', async () => {
    const ahora = entorno.ahora().getTime();
    const nueva = await publicar('1.1', new Date(ahora - 60_000));
    const futura = await publicar('2.0', new Date(ahora + 24 * 3600 * 1000));
    try {
      const terminos = (await pedir()).find((d) => d.tipo === 'terminos');

      expect(terminos).toMatchObject({ id: nueva.rows[0]?.id, version: '1.1' });
    } finally {
      await entorno.bd.query('DELETE FROM contenido.documento_legal WHERE id = ANY($1)', [
        [nueva.rows[0]?.id, futura.rows[0]?.id],
      ]);
    }
  });

  it('se puede guardar cinco minutos (Cache-Control) y tiene un límite de 60 por minuto por IP', async () => {
    const respuesta = await request(entorno.app).get(RUTA);
    const limitada = entorno.crearAppConLimite({ ventanaMs: 60_000, maximo: 1000 });
    const estados = [];
    for (let i = 0; i < 61; i++) estados.push((await request(limitada).get(RUTA)).status);

    expect(respuesta.headers['cache-control']).toBe('public, max-age=300');
    expect(respuesta.headers['ratelimit']).toBeDefined();
    expect(estados.slice(0, 60).every((estado) => estado === 200)).toBe(true);
    expect(estados[60]).toBe(429);
  });

  it('CORS permite a la consola pedirla (páginas /terminos y /privacidad)', async () => {
    const respuesta = await request(entorno.app).get(RUTA).set('Origin', URL_CONSOLA_DE_PRUEBA);

    expect(respuesta.headers['access-control-allow-origin']).toBe(URL_CONSOLA_DE_PRUEBA);
  });
});
