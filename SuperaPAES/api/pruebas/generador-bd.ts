// Entorno de las pruebas del generador con IA contra PostgreSQL real (HU-16 a HU-18): una base temporal con
// las semillas del temario, la app con un proveedor de IA falso, la sesión del administrador y los
// parámetros de la IA en sus valores de fábrica al empezar cada prueba. Nunca llama a un proveedor real.
import path from 'node:path';
import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, expect } from 'vitest';
import { ejecutarSemillas } from '../db/semillas.js';
import type { Dependencias } from '../app.js';
import { crearDependenciasDePrueba } from './ayudantes.js';
import { usarBaseDeSesiones } from './base-sesiones.js';
import { conToken, RUTA_INGRESO, RUTA_USUARIOS } from './escenario-sesiones.js';
import { crearIaFalsa } from './ia-falsa.js';

export const RUTA_LOTES = '/api/v1/admin/generador/lotes';

const PARAMETROS_DE_FABRICA: Record<string, number> = {
  max_preguntas_lote: 10,
  tope_diario_ia: 100,
  tope_mensual_ia_usd: 10,
  temperatura_ia_deepseek: 0.7,
  temperatura_ia_gemini: 0.7,
  precio_entrada_ia_deepseek: 0.3,
  precio_salida_ia_deepseek: 1.2,
  precio_entrada_ia_gemini: 0.54,
  precio_salida_ia_gemini: 4.5,
  concurrencia_ia: 1,
};

export function prepararGenerador(prefijo: string) {
  const entorno = usarBaseDeSesiones(prefijo);
  const ia = crearIaFalsa();
  let app: Express;
  const contenidos = { m1: 0, cl: 0, m2: 0 };

  beforeAll(async () => {
    await ejecutarSemillas(entorno.bd, path.join(import.meta.dirname, '../db/semillas'));
    const { rows } = await entorno.bd.query<{ codigo: string; id: number }>(
      `SELECT p.codigo, MIN(c.id) AS id FROM contenido.contenido_tematico c
         JOIN contenido.prueba p ON p.id = c.prueba_id GROUP BY p.codigo`,
    );
    for (const fila of rows) {
      if (fila.codigo === 'M1') contenidos.m1 = fila.id;
      if (fila.codigo === 'CL') contenidos.cl = fila.id;
      if (fila.codigo === 'M2') contenidos.m2 = fila.id;
    }
    const base = crearDependenciasDePrueba();
    app = entorno.crearAppCon({ proveedores: { ...base.proveedores, ia: ia.proveedor } });
  });

  beforeEach(async () => {
    ia.reiniciar();
    for (const [clave, valor] of Object.entries(PARAMETROS_DE_FABRICA)) {
      await entorno.bd.query(
        `INSERT INTO contenido.configuracion (clave, valor, descripcion, actualizado_en)
         VALUES ($1, $2::jsonb, 'Parámetro de prueba para el generador.', now())
         ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor`,
        [clave, JSON.stringify(valor)],
      );
    }
    await entorno.bd.query('UPDATE contenido.contenido_tematico SET activo = true');
  });

  async function parametro(clave: string, valor: unknown): Promise<void> {
    await entorno.bd.query(
      'UPDATE contenido.configuracion SET valor = $2::jsonb WHERE clave = $1',
      [clave, JSON.stringify(valor)],
    );
  }

  async function sesionAdmin() {
    const credenciales = await entorno.crearAdmin();
    const ingreso = await request(entorno.app).post(RUTA_INGRESO).send(credenciales);
    expect(ingreso.status).toBe(200);
    return conToken(ingreso.body.data.tokenAcceso as string);
  }

  async function sesionDocente(admin: ReturnType<typeof conToken>) {
    const { rows } = await entorno.bd.query<{ id: number }>(
      "INSERT INTO contenido.area (nombre) VALUES ('Área de prueba') RETURNING id",
    );
    const docente = { correo: 'diego@ejemplo.cl', contrasena: 'clave-de-diego-1' };
    const creado = await request(entorno.app)
      .post(RUTA_USUARIOS)
      .set(admin)
      .send({ nombre: 'Diego Docente', ...docente, rol: 'docente', areas: [rows[0]?.id] });
    expect(creado.status).toBe(201);
    const ingreso = await request(entorno.app).post(RUTA_INGRESO).send(docente);
    return conToken(ingreso.body.data.tokenAcceso as string);
  }

  const pedirLote = (sesion: ReturnType<typeof conToken>, cuerpo: Record<string, unknown>) =>
    request(app).post(RUTA_LOTES).set(sesion).send(cuerpo);
  const leerLote = (sesion: ReturnType<typeof conToken>, id: number | string) =>
    request(app)
      .get(`${RUTA_LOTES}/${String(id)}`)
      .set(sesion);

  /** El generador de «otro proceso»: servicios nuevos sobre la misma base, con la IA falsa o la que se indique. */
  const trabajador = (cambios: Partial<Dependencias> = {}) =>
    entorno.crearServiciosCon({
      proveedores: { ...crearDependenciasDePrueba().proveedores, ia: ia.proveedor },
      ...cambios,
    }).generador;

  /** El lote como quedó en la base, con su estado. */
  const filaDeLote = async (id: number | string) =>
    (
      await entorno.bd.query<Record<string, unknown>>(
        `SELECT l.*, e.codigo AS estado FROM contenido.lote_generacion l
           JOIN contenido.estado_lote e ON e.id = l.estado_lote_id WHERE l.id = $1`,
        [id],
      )
    ).rows[0]!;

  return {
    entorno,
    ia,
    trabajador,
    filaDeLote,
    contenidos,
    parametro,
    sesionAdmin,
    sesionDocente,
    pedirLote,
    leerLote,
    get app() {
      return app;
    },
  };
}
