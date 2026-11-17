import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { migrar } from '../db/migrador.js';
import { ejecutarSemillas } from '../db/semillas.js';
import { crearBaseTemporal, exigirBaseEnCi, MINUTO, urlBase } from './base-temporal.js';

const directorio = path.join(import.meta.dirname, '../db');
const archivo = '004_modelo_ia_vigente.sql';

interface Parametro {
  clave: string;
  valor: unknown;
  descripcion: string;
  actualizado_por: string | null;
  actualizado_en: Date;
}

describe('migración del modelo de IA sin base', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('migración del modelo de IA con PostgreSQL', () => {
  let base: Awaited<ReturnType<typeof crearBaseTemporal>>;
  let administrador: string;
  beforeAll(async () => {
    base = await crearBaseTemporal('modelo_ia');
    const { rows } = await base.bd.query<{ id: string }>(
      `INSERT INTO contenido.usuario_interno
         (nombre, correo, hash_contrasena, rol_id, creado_en)
       SELECT 'Administrador de prueba', 'modelo-ia@example.test', 'hash-ficticio', id, now()
         FROM contenido.rol WHERE codigo = 'admin'
       RETURNING id`,
    );
    administrador = rows[0]!.id;
  }, MINUTO);
  afterAll(async () => {
    await base.cerrar();
  }, MINUTO);

  async function configuracion() {
    return (await base.bd.query<Parametro>('SELECT * FROM contenido.configuracion ORDER BY clave'))
      .rows;
  }

  async function modelo() {
    return (
      await base.bd.query<Parametro>(
        "SELECT * FROM contenido.configuracion WHERE clave = 'modelo_ia'",
      )
    ).rows[0]!;
  }

  async function preparar(valor: unknown, descripcion = 'Modelo para generar preguntas.') {
    await base.bd.query(
      `UPDATE contenido.configuracion
          SET valor = $1::jsonb, descripcion = $2, actualizado_por = $3,
              actualizado_en = '2000-01-01T00:00:00Z'
        WHERE clave = 'modelo_ia'`,
      [JSON.stringify(valor), descripcion, administrador],
    );
  }

  async function aplicar() {
    return base.bd.query(await readFile(path.join(directorio, 'migraciones', archivo), 'utf8'));
  }

  it('una instalación nueva conserva el modelo vigente y metadatos después de migrar y sembrar', async () => {
    const antes = await configuracion();
    expect(await modelo()).toMatchObject({
      valor: 'deepseek-flash',
      descripcion: 'Modelo de IA usado para generar preguntas.',
      actualizado_por: null,
    });
    await ejecutarSemillas(base.bd, path.join(directorio, 'semillas'));
    expect(await configuracion()).toEqual(antes);
    expect(await modelo()).toMatchObject({ valor: 'deepseek-flash' });
    expect(await migrar(base.bd, path.join(directorio, 'migraciones'))).toEqual([]);
    expect(await configuracion()).toEqual(antes);
    const { rows } = await base.bd.query(
      'SELECT nombre FROM public.migracion_aplicada WHERE nombre = $1',
      [archivo],
    );
    expect(rows).toEqual([{ nombre: archivo }]);
  });

  describe('actualización condicionada del parámetro', () => {
    beforeEach(async () => {
      await base.bd.query('BEGIN');
    });
    afterEach(async () => {
      await base.bd.query('ROLLBACK');
    });

    it('cambia el nombre anterior y la fecha, conservando descripción genérica y último usuario', async () => {
      await preparar('deepseek-chat');
      const antes = await modelo();
      expect((await aplicar()).rowCount).toBe(1);
      const despues = await modelo();
      expect(despues).toEqual({
        ...antes,
        valor: 'deepseek-flash',
        actualizado_en: expect.any(Date),
      });
      expect(despues.actualizado_en.getTime()).toBeGreaterThan(antes.actualizado_en.getTime());
    });

    it('corrige una descripción que menciona el modelo anterior en la misma fila', async () => {
      await preparar('deepseek-chat', 'Modelo deepseek-chat para generar preguntas.');
      await aplicar();
      expect(await modelo()).toMatchObject({
        valor: 'deepseek-flash',
        descripcion: 'Modelo deepseek-flash para generar preguntas.',
        actualizado_por: administrador,
      });
    });

    it.each(['otro-modelo-elegido', 'deepseek-flash'])(
      'conserva toda la fila con el valor %s, aunque su descripción mencione el anterior',
      async (valor) => {
        await preparar(valor, 'Modelo elegido después de deepseek-chat.');
        const antes = await configuracion();
        expect((await aplicar()).rowCount).toBe(0);
        expect(await configuracion()).toEqual(antes);
      },
    );

    it.each(
      [
        ['deepseek-chat'],
        { modelo: 'deepseek-chat' },
        17,
        null,
        'DEEPSEEK-CHAT',
        ' deepseek-chat ',
      ].map((valor) => ({ valor })),
    )('no confunde otro valor JSON con la cadena exacta: $valor', async ({ valor }) => {
      await preparar(valor);
      const antes = await configuracion();
      expect((await aplicar()).rowCount).toBe(0);
      expect(await configuracion()).toEqual(antes);
    });

    it('no crea el parámetro si no existe', async () => {
      await base.bd.query("DELETE FROM contenido.configuracion WHERE clave = 'modelo_ia'");
      const antes = await configuracion();
      expect((await aplicar()).rowCount).toBe(0);
      expect(await configuracion()).toEqual(antes);
    });

    it('la segunda ejecución deja toda la configuración y sus metadatos idénticos', async () => {
      await preparar('deepseek-chat', 'Modelo deepseek-chat.');
      expect((await aplicar()).rowCount).toBe(1);
      const despuesDeLaPrimera = await configuracion();
      expect((await aplicar()).rowCount).toBe(0);
      expect(await configuracion()).toEqual(despuesDeLaPrimera);
    });

    it('no modifica ninguna otra clave, aunque contenga el nombre anterior', async () => {
      await preparar('deepseek-chat');
      await base.bd.query(
        `UPDATE contenido.configuracion
            SET valor = '"deepseek-chat"'::jsonb, descripcion = 'Ejemplo deepseek-chat.',
                actualizado_por = $1, actualizado_en = '2000-01-01T00:00:00Z'
          WHERE clave = 'cupo_inicial'`,
        [administrador],
      );
      const otras = (filas: Awaited<ReturnType<typeof configuracion>>) =>
        filas.filter((fila) => fila.clave !== 'modelo_ia');
      const antes = otras(await configuracion());
      expect((await aplicar()).rowCount).toBe(1);
      expect(otras(await configuracion())).toEqual(antes);
    });
  });
});
