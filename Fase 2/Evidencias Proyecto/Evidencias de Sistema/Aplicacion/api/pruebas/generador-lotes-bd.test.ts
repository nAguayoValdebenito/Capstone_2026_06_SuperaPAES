// HU-16.2 y HU-16.3, CU-17 pasos 1 y 2, contra PostgreSQL real: el administrador pide un lote, la API lo
// registra en la cola y responde de inmediato (202) sin llamar a la IA. Valida el pedido contra el temario
// (RN-08), deja la auditoría y no duplica un pedido repetido, aunque lleguen dos a la vez.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { conBarrera } from './barrera-de-prueba.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { crearDependenciasDePrueba, errorConFormato } from './ayudantes.js';
import { prepararGenerador, RUTA_LOTES } from './generador-bd.js';

exigirBaseEnCi();
describe.skipIf(!urlBase)('crear un lote de generación con PostgreSQL (CU-17)', () => {
  const g = prepararGenerador('lotes');
  const { entorno } = g;

  const filasDeLotes = async () =>
    (
      await entorno.bd.query<Record<string, unknown>>(
        'SELECT * FROM contenido.lote_generacion ORDER BY id',
      )
    ).rows;

  it('registra el lote pendiente, responde 202 y no llama a la IA', async () => {
    const sesion = await g.sesionAdmin();

    const respuesta = await g.pedirLote(sesion, { contenidoId: g.contenidos.m1, cantidad: 5 });

    expect(respuesta.status).toBe(202);
    expect(respuesta.body.data).toMatchObject({
      id: expect.any(Number) as number,
      estado: 'pendiente',
      contenidoId: g.contenidos.m1,
      cantidad: 5,
      conTexto: false,
      validas: 0,
      descartadas: 0,
      procesadas: 0,
    });
    expect(g.ia.generarPreguntas).not.toHaveBeenCalled();
  });

  it('guarda el modelo configurado, la versión de las instrucciones y el origen del pedido', async () => {
    const sesion = await g.sesionAdmin();
    await g.parametro('modelo_ia', 'deepseek-flash');

    await g.pedirLote(sesion, { contenidoId: g.contenidos.m1, cantidad: 3 });

    const [lote] = await entorno.bd
      .query<Record<string, unknown>>(
        `SELECT l.cantidad, l.con_texto, l.modelo, l.version_instrucciones, l.validas, l.descartadas,
              l.tokens_usados, l.costo_usd, e.codigo AS estado, t.codigo AS tipo, u.rol_id IS NOT NULL AS hay_solicitante
         FROM contenido.lote_generacion l
         JOIN contenido.estado_lote e ON e.id = l.estado_lote_id
         JOIN contenido.tipo_pregunta t ON t.id = l.tipo_pregunta_id
         JOIN contenido.usuario_interno u ON u.id = l.solicitante_id`,
      )
      .then((r) => r.rows);
    expect(lote).toMatchObject({
      cantidad: 3,
      con_texto: false,
      modelo: 'deepseek-flash',
      version_instrucciones: '1.0',
      validas: 0,
      descartadas: 0,
      tokens_usados: null,
      costo_usd: null,
      estado: 'pendiente',
      tipo: 'seleccion_multiple',
      hay_solicitante: true,
    });
  });

  it('deja la auditoría solicitar_lote_ia en la misma transacción', async () => {
    const sesion = await g.sesionAdmin();

    const respuesta = await g.pedirLote(sesion, { contenidoId: g.contenidos.m1, cantidad: 4 });

    const { rows } = await entorno.bd.query<Record<string, unknown>>(
      `SELECT aa.codigo AS accion, a.entidad, a.entidad_id::text AS entidad_id, a.antes, a.despues
         FROM contenido.auditoria a JOIN contenido.accion_auditoria aa ON aa.id = a.accion_auditoria_id
        WHERE aa.codigo = 'solicitar_lote_ia'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      accion: 'solicitar_lote_ia',
      entidad: 'lote_generacion',
      entidad_id: String(respuesta.body.data.id),
      antes: null,
    });
    expect(rows[0]?.['despues']).toMatchObject({ contenidoId: g.contenidos.m1, cantidad: 4 });
  });

  it('repetir el mismo pedido mientras está pendiente devuelve el mismo lote (200), sin otro', async () => {
    const sesion = await g.sesionAdmin();
    const cuerpo = { contenidoId: g.contenidos.m1, cantidad: 5 };
    const primero = await g.pedirLote(sesion, cuerpo);

    const segundo = await g.pedirLote(sesion, cuerpo);

    expect(segundo.status).toBe(200);
    expect(segundo.body.data.id).toBe(primero.body.data.id);
    expect(await filasDeLotes()).toHaveLength(1);
  });

  it('otra cantidad u otro contenido es otro pedido', async () => {
    const sesion = await g.sesionAdmin();
    await g.pedirLote(sesion, { contenidoId: g.contenidos.m1, cantidad: 5 });

    const otraCantidad = await g.pedirLote(sesion, { contenidoId: g.contenidos.m1, cantidad: 6 });
    const otroContenido = await g.pedirLote(sesion, { contenidoId: g.contenidos.m2, cantidad: 5 });

    expect([otraCantidad.status, otroContenido.status]).toEqual([202, 202]);
    expect(await filasDeLotes()).toHaveLength(3);
  });

  it('dos pedidos iguales que llegan a la vez dejan un solo lote', async () => {
    const sesion = await g.sesionAdmin();
    // Ambas transacciones llegan al candado de creación antes de que cualquiera avance.
    const cruzada = entorno.crearAppCon({
      proveedores: { ...crearDependenciasDePrueba().proveedores, ia: g.ia.proveedor },
      unidadDeTrabajo: conBarrera(entorno.unidadDeTrabajo, /pg_advisory_xact_lock/u),
    });
    const pedir = () =>
      request(cruzada)
        .post(RUTA_LOTES)
        .set(sesion)
        .send({ contenidoId: g.contenidos.m1, cantidad: 5 });

    const [una, otra] = await Promise.all([pedir(), pedir()]);

    expect([una.status, otra.status].sort()).toEqual([200, 202]);
    expect(una.body.data.id).toBe(otra.body.data.id);
    expect(await filasDeLotes()).toHaveLength(1);
  });

  describe('validación contra el temario', () => {
    it.each<Record<string, unknown>>([
      { cantidad: 0 },
      { cantidad: 1.5 },
      { cantidad: 3, extra: true },
      { cantidad: 3, contenidoId: '5' },
      { cantidad: 3, contenidoId: -1 },
    ])('rechaza el cuerpo %j (VALIDACION)', async (cambios) => {
      const sesion = await g.sesionAdmin();

      const respuesta = await g.pedirLote(sesion, { contenidoId: g.contenidos.m1, ...cambios });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.codigo).toBe('VALIDACION');
      expect(await filasDeLotes()).toHaveLength(0);
    });

    it('la cantidad máxima sale del parámetro max_preguntas_lote, no de un 10 fijo', async () => {
      const sesion = await g.sesionAdmin();
      await g.parametro('max_preguntas_lote', 4);

      const excede = await g.pedirLote(sesion, { contenidoId: g.contenidos.m1, cantidad: 5 });
      const cabe = await g.pedirLote(sesion, { contenidoId: g.contenidos.m1, cantidad: 4 });

      expect(excede.status).toBe(400);
      expect(excede.body.error.detalles).toEqual([
        expect.objectContaining({ ruta: 'cantidad', motivo: 'cantidad_excedida' }),
      ]);
      expect(cabe.status).toBe(202);
    });

    it('un contenido que no existe o está inactivo es VALIDACION con su motivo', async () => {
      const sesion = await g.sesionAdmin();
      await entorno.bd.query(
        'UPDATE contenido.contenido_tematico SET activo = false WHERE id = $1',
        [g.contenidos.m2],
      );

      const inexistente = await g.pedirLote(sesion, { contenidoId: 2_000_000_000, cantidad: 3 });
      const inactivo = await g.pedirLote(sesion, { contenidoId: g.contenidos.m2, cantidad: 3 });

      expect(inexistente.body.error.detalles).toEqual([
        expect.objectContaining({ ruta: 'contenidoId', motivo: 'contenido_inexistente' }),
      ]);
      expect(inactivo.body.error.detalles).toEqual([
        expect.objectContaining({ ruta: 'contenidoId', motivo: 'contenido_inactivo' }),
      ]);
    });

    it('un texto de lectura solo se pide en Competencia Lectora, y allí es obligatorio', async () => {
      const sesion = await g.sesionAdmin();

      const textoEnM1 = await g.pedirLote(sesion, {
        contenidoId: g.contenidos.m1,
        cantidad: 3,
        conTexto: true,
      });
      const clSinTexto = await g.pedirLote(sesion, { contenidoId: g.contenidos.cl, cantidad: 3 });

      expect(textoEnM1.body.error.detalles).toEqual([
        expect.objectContaining({ ruta: 'conTexto', motivo: 'texto_no_aplica' }),
      ]);
      expect(clSinTexto.body.error.detalles).toEqual([
        expect.objectContaining({ ruta: 'conTexto', motivo: 'texto_obligatorio' }),
      ]);
    });

    it('un texto con menos de 3 preguntas no cubre Localizar, Interpretar y Evaluar: 400 con mensaje claro', async () => {
      const sesion = await g.sesionAdmin();

      const corto = await g.pedirLote(sesion, {
        contenidoId: g.contenidos.cl,
        cantidad: 2,
        conTexto: true,
      });
      const justo = await g.pedirLote(sesion, {
        contenidoId: g.contenidos.cl,
        cantidad: 3,
        conTexto: true,
      });

      expect(corto.status).toBe(400);
      expect(corto.body.error.detalles).toEqual([
        expect.objectContaining({ ruta: 'cantidad', motivo: 'texto_minimo_preguntas' }),
      ]);
      expect(corto.body.error.mensaje).toMatch(/Localizar, Interpretar y Evaluar/u);
      expect(justo.status).toBe(202);
      expect(justo.body.data.conTexto).toBe(true);
    });
  });

  it('un lote que no existe responde 404', async () => {
    const sesion = await g.sesionAdmin();

    const respuesta = await g.leerLote(sesion, 999_999);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toEqual(errorConFormato('NO_ENCONTRADO'));
  });
});
