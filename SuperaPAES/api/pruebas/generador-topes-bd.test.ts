// HU-16.2 y RNF-03, CU-17 paso 2 y alternativo 2.a, contra PostgreSQL real: los topes diario y mensual se
// comprueban antes de registrar el lote (si se alcanzó, no se pide nada a la IA); un proveedor sin precio
// configurado hace fallar la creación de forma segura (nunca se calcula como si costara cero); solo el
// administrador crea y consulta lotes.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearDependenciasDePrueba, errorConFormato, tokenApp } from './ayudantes.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararGenerador, RUTA_LOTES } from './generador-bd.js';
import { crearIaFalsa } from './ia-falsa.js';

interface LoteSembrado {
  cantidad?: number;
  estado?: 'pendiente' | 'completado' | 'fallido';
  validas?: number;
  descartadas?: number;
  tokens?: number | null;
  costo?: number | null;
  /** Expresión SQL de la fecha, por ejemplo «now() - interval '2 days'». */
  creadoEn?: string;
}

exigirBaseEnCi();
describe.skipIf(!urlBase)('topes, precios y permisos del generador con PostgreSQL', () => {
  const g = prepararGenerador('topes');
  const { entorno } = g;

  /** Un lote ya existente con el estado, los conteos y el costo indicados. */
  async function sembrar(datos: LoteSembrado = {}): Promise<void> {
    await entorno.bd.query(
      `INSERT INTO contenido.lote_generacion
         (contenido_id, solicitante_id, tipo_pregunta_id, con_texto, cantidad, modelo,
          version_instrucciones, tokens_usados, costo_usd, validas, descartadas, estado_lote_id, creado_en)
       SELECT $1, u.id, t.id, false, $2, 'modelo-previo', '1.0', $3, $4, $5, $6, e.id, ${datos.creadoEn ?? 'now()'}
         FROM contenido.usuario_interno u, contenido.tipo_pregunta t, contenido.estado_lote e
        WHERE t.codigo = 'seleccion_multiple' AND e.codigo = $7 ORDER BY u.id LIMIT 1`,
      [
        g.contenidos.m1,
        datos.cantidad ?? 5,
        datos.tokens ?? null,
        datos.costo ?? null,
        datos.validas ?? 0,
        datos.descartadas ?? 0,
        datos.estado ?? 'completado',
      ],
    );
  }

  describe('tope diario (tope_diario_ia)', () => {
    it('rechaza (409 TOPE_DIARIO_IA) un lote que pasaría el tope y no pide nada a la IA', async () => {
      const sesion = await g.sesionAdmin();
      await g.parametro('tope_diario_ia', 5);
      expect(
        (await g.pedirLote(sesion, { contenidoId: g.contenidos.m1, cantidad: 3 })).status,
      ).toBe(202);

      const excede = await g.pedirLote(sesion, { contenidoId: g.contenidos.m2, cantidad: 3 });

      expect(excede.status).toBe(409);
      expect(excede.body.error).toMatchObject({
        codigo: 'TOPE_DIARIO_IA',
        detalles: { usadas: 3, pedidas: 3, maximo: 5 },
      });
      expect(g.ia.generarPreguntas).not.toHaveBeenCalled();
    });

    it('un lote que justo llega al tope sí se acepta', async () => {
      const sesion = await g.sesionAdmin();
      await g.parametro('tope_diario_ia', 5);
      await g.pedirLote(sesion, { contenidoId: g.contenidos.m1, cantidad: 3 });

      const justo = await g.pedirLote(sesion, { contenidoId: g.contenidos.m2, cantidad: 2 });

      expect(justo.status).toBe(202);
    });

    it('cuenta lo pedido en el día de Chile y no lo de ayer', async () => {
      const sesion = await g.sesionAdmin();
      await g.parametro('tope_diario_ia', 5);
      await sembrar({ cantidad: 5, validas: 5, creadoEn: "now() - interval '2 days'" });

      const hoy = await g.pedirLote(sesion, { contenidoId: g.contenidos.m1, cantidad: 5 });

      expect(hoy.status).toBe(202);
    });

    it('de un lote ya procesado cuenta lo que se pidió a la IA, y un fallido sin nada no cuenta', async () => {
      const sesion = await g.sesionAdmin();
      await g.parametro('tope_diario_ia', 5);
      await sembrar({ cantidad: 4, validas: 2, descartadas: 2 });
      await sembrar({ cantidad: 10, estado: 'fallido' });

      const uno = await g.pedirLote(sesion, { contenidoId: g.contenidos.m2, cantidad: 1 });
      const dos = await g.pedirLote(sesion, { contenidoId: g.contenidos.m1, cantidad: 2 });

      expect(uno.status).toBe(202);
      expect(dos.status).toBe(409);
      expect(dos.body.error.detalles).toMatchObject({ usadas: 5, maximo: 5 });
    });
  });

  describe('tope mensual (tope_mensual_ia_usd, RNF-03: US$ 10)', () => {
    it('con el gasto del mes en el tope no registra el lote (409 TOPE_MENSUAL_IA)', async () => {
      const sesion = await g.sesionAdmin();
      await sembrar({ tokens: 1000, costo: 10 });

      const respuesta = await g.pedirLote(sesion, { contenidoId: g.contenidos.m1, cantidad: 3 });

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error).toMatchObject({
        codigo: 'TOPE_MENSUAL_IA',
        detalles: { gastado: 10, maximo: 10 },
      });
      expect(g.ia.generarPreguntas).not.toHaveBeenCalled();
    });

    it('un centavo por debajo del tope todavía acepta, y el gasto de otros meses no cuenta', async () => {
      const sesion = await g.sesionAdmin();
      await sembrar({ tokens: 10, costo: 9.9999 });
      await sembrar({ tokens: 10, costo: 99, creadoEn: "now() - interval '40 days'" });

      const respuesta = await g.pedirLote(sesion, { contenidoId: g.contenidos.m1, cantidad: 3 });

      expect(respuesta.status).toBe(202);
    });

    it('el tope sale del parámetro, no de un 10 fijo', async () => {
      const sesion = await g.sesionAdmin();
      await g.parametro('tope_mensual_ia_usd', 2);
      await sembrar({ tokens: 10, costo: 2.5 });

      const respuesta = await g.pedirLote(sesion, { contenidoId: g.contenidos.m1, cantidad: 3 });

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.detalles).toMatchObject({ maximo: 2 });
    });
  });

  describe('precios: sin precio no se calcula, no se asume cero', () => {
    const PRECIOS_DEEPSEEK = ['precio_entrada_ia_deepseek', 'precio_salida_ia_deepseek'];

    it.each([
      [
        'falta la fila',
        async (clave: string) =>
          g.entorno.bd.query('DELETE FROM contenido.configuracion WHERE clave = $1', [clave]),
      ],
      ['vale cero', async (clave: string) => g.parametro(clave, 0)],
      ['es negativo', async (clave: string) => g.parametro(clave, -1)],
      ['es un texto', async (clave: string) => g.parametro(clave, '0.3')],
    ])(
      'si el precio %s: 503 PRECIO_IA_NO_CONFIGURADO y no se crea el lote',
      async (_caso, romper) => {
        const sesion = await g.sesionAdmin();
        for (const clave of PRECIOS_DEEPSEEK) await romper(clave);

        const respuesta = await g.pedirLote(sesion, { contenidoId: g.contenidos.m1, cantidad: 3 });

        expect(respuesta.status).toBe(503);
        expect(respuesta.body.error.codigo).toBe('PRECIO_IA_NO_CONFIGURADO');
        const { rows } = await entorno.bd.query('SELECT 1 FROM contenido.lote_generacion');
        expect(rows).toHaveLength(0);
      },
    );

    it('con respaldo, también exige el precio del segundo proveedor', async () => {
      const sesion = await g.sesionAdmin();
      await entorno.bd.query(
        "DELETE FROM contenido.configuracion WHERE clave = 'precio_salida_ia_gemini'",
      );
      const conRespaldo = crearIaFalsa({ usa: ['deepseek', 'gemini'] });
      const app = entorno.crearAppCon({
        proveedores: { ...crearDependenciasDePrueba().proveedores, ia: conRespaldo.proveedor },
      });

      const respuesta = await request(app)
        .post(RUTA_LOTES)
        .set(sesion)
        .send({ contenidoId: g.contenidos.m1, cantidad: 3 });

      expect(respuesta.status).toBe(503);
      expect(respuesta.body.error.codigo).toBe('PRECIO_IA_NO_CONFIGURADO');
    });

    it('el proveedor simulado no tiene precio ni lo necesita', async () => {
      const sesion = await g.sesionAdmin();
      await entorno.bd.query(
        "DELETE FROM contenido.configuracion WHERE clave LIKE 'precio_%_ia_%'",
      );
      const simulada = crearIaFalsa({ nombre: 'simulado', usa: [] });
      const app = entorno.crearAppCon({
        proveedores: { ...crearDependenciasDePrueba().proveedores, ia: simulada.proveedor },
      });

      const respuesta = await request(app)
        .post(RUTA_LOTES)
        .set(sesion)
        .send({ contenidoId: g.contenidos.m1, cantidad: 3 });

      expect(respuesta.status).toBe(202);
    });

    it('si un lote del mes usó tokens y no tiene costo, el gasto no se puede verificar: 503', async () => {
      const sesion = await g.sesionAdmin();
      await sembrar({ tokens: 5000, costo: null });

      const respuesta = await g.pedirLote(sesion, { contenidoId: g.contenidos.m1, cantidad: 3 });

      expect(respuesta.status).toBe(503);
      expect(respuesta.body.error.codigo).toBe('PRECIO_IA_NO_CONFIGURADO');
    });
  });

  describe('permisos y consulta', () => {
    it('sin sesión o con un token de estudiante responde 401', async () => {
      const sinSesion = await request(g.app)
        .post(RUTA_LOTES)
        .send({ contenidoId: g.contenidos.m1, cantidad: 3 });
      const deEstudiante = await request(g.app)
        .get(RUTA_LOTES)
        .set({ Authorization: `Bearer ${await tokenApp()}` });

      expect(sinSesion.status).toBe(401);
      expect(deEstudiante.status).toBe(401);
    });

    it('un docente recibe 403 al pedir, listar y consultar lotes', async () => {
      const admin = await g.sesionAdmin();
      const docente = await g.sesionDocente(admin);
      const creado = await g.pedirLote(admin, { contenidoId: g.contenidos.m1, cantidad: 3 });

      const pide = await g.pedirLote(docente, { contenidoId: g.contenidos.m1, cantidad: 4 });
      const lista = await request(g.app).get(RUTA_LOTES).set(docente);
      const uno = await g.leerLote(docente, creado.body.data.id as number);

      expect([pide.status, lista.status, uno.status]).toEqual([403, 403, 403]);
      expect(pide.body).toEqual(errorConFormato('SIN_PERMISO'));
    });

    it('el administrador consulta el lote y la lista, los más recientes primero, paginada', async () => {
      const sesion = await g.sesionAdmin();
      const primero = await g.pedirLote(sesion, { contenidoId: g.contenidos.m1, cantidad: 3 });
      const segundo = await g.pedirLote(sesion, { contenidoId: g.contenidos.m2, cantidad: 4 });

      const uno = await g.leerLote(sesion, primero.body.data.id as number);
      const lista = await request(g.app).get(RUTA_LOTES).query({ porPagina: 1 }).set(sesion);

      expect(uno.status).toBe(200);
      expect(uno.body.data).toMatchObject({
        id: primero.body.data.id,
        estado: 'pendiente',
        cantidad: 3,
      });
      expect((lista.body.data as { id: number }[]).map((l) => l.id)).toEqual([
        segundo.body.data.id,
      ]);
      expect(lista.body.meta).toEqual({ pagina: 1, porPagina: 1, total: 2 });
    });
  });
});
