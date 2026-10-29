import { describe, expect, it, vi } from 'vitest';
import { FabricaProveedores } from '../adaptadores/fabrica.js';
import { PasarelaPagoSimulada } from '../adaptadores/pagos/simulado.js';
import { ErrorNoImplementado, ErrorSolicitudInvalida } from '../comun/errores.js';
import { relojDelSistema } from '../comun/reloj.js';
import { sobreDeepSeek, sobreGemini } from './ia-fixtures.js';

const leerModelo = () => Promise.resolve('modelo-de-prueba');

const solicitud = {
  instruccion: 'Devuelve una pregunta de ecuaciones en JSON.',
};

describe('FabricaProveedores: IA', () => {
  it.each([
    [{ proveedor: 'simulado' as const }, 'simulado'],
    [{ proveedor: 'deepseek' as const, claveApi: 'clave' }, 'deepseek'],
    [{ proveedor: 'gemini' as const, claveApi: 'clave', modelo: 'modelo-prueba' }, 'gemini'],
  ])('devuelve el proveedor indicado (%j)', (config, nombre) => {
    expect(FabricaProveedores.ia(config, leerModelo).nombre).toBe(nombre);
  });

  it('el proveedor simulado devuelve una pregunta fija con 4 alternativas y una correcta', async () => {
    const resultado = await FabricaProveedores.ia(
      { proveedor: 'simulado' },
      leerModelo,
    ).generarPreguntas(solicitud);

    expect(resultado.preguntas).toHaveLength(1);
    const [pregunta] = resultado.preguntas;
    expect(pregunta?.alternativas).toHaveLength(4);
    expect(pregunta?.alternativas.filter((a) => a.esCorrecta)).toHaveLength(1);
    for (const alternativa of pregunta?.alternativas ?? []) {
      expect(alternativa.explicacion.length).toBeGreaterThan(0);
    }
    expect(resultado.costoUsd).toBe(0);
  });

  it.each(['deepseek', 'gemini'] as const)(
    'el proveedor %s devuelve el contrato común con HTTP sustituido',
    async (p) => {
      const proveedor = FabricaProveedores.ia(
        p === 'gemini'
          ? { proveedor: p, claveApi: 'clave', modelo: 'modelo-prueba' }
          : { proveedor: p, claveApi: 'clave' },
        leerModelo,
      );
      const fetchFalso = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(Response.json(p === 'deepseek' ? sobreDeepSeek() : sobreGemini()));
      const resultado = await proveedor.generarPreguntas(solicitud);
      expect(resultado).toMatchObject({ proveedor: p, preguntas: expect.any(Array) as unknown[] });
      expect(fetchFalso).toHaveBeenCalledTimes(1);
    },
  );
});

describe('FabricaProveedores: correo', () => {
  const smtp = {
    proveedor: 'smtp' as const,
    host: 'localhost',
    puerto: 1025,
    tls: 'none' as const,
    usuario: undefined,
    clave: undefined,
    remitente: 'a@b.cl',
    timeoutMs: 10_000,
  };

  it.each([
    [{ proveedor: 'consola' as const }, 'consola'],
    [smtp, 'smtp'],
  ])('devuelve el proveedor indicado (%j)', (config, nombre) => {
    expect(FabricaProveedores.correo(config).nombre).toBe(nombre);
  });

  it('el proveedor consola de desarrollo escribe el mensaje completo en el registro y no falla', async () => {
    const escribir = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const mensaje = {
      para: 'eva@ejemplo.cl',
      asunto: 'Verifica tu correo',
      texto: 'Código: 123456',
    };

    await FabricaProveedores.correo({ proveedor: 'consola' }).enviar(mensaje);

    expect(escribir).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(escribir.mock.calls[0]?.[0]))).toMatchObject(mensaje);
  });
});

describe('FabricaProveedores: pagos', () => {
  const tiendas = {
    proveedor: 'tiendas' as const,
    googlePlay: { paquete: 'cl.superapaes.app', cuentaServicio: '{}', audienciaPubSub: 'aud' },
    appStore: {
      bundleId: 'cl.superapaes.app',
      idEmisor: 'emisor',
      idClave: 'clave',
      clavePrivada: 'privada',
      entorno: 'sandbox' as const,
    },
  };

  it('con simulado, ambas tiendas usan la pasarela simulada', () => {
    const pagos = FabricaProveedores.pagos({ proveedor: 'simulado' }, relojDelSistema);

    expect(pagos.google_play.nombre).toBe('simulado');
    expect(pagos.app_store.nombre).toBe('simulado');
  });

  it('con tiendas, cada tienda usa su pasarela', () => {
    const pagos = FabricaProveedores.pagos(tiendas, relojDelSistema);

    expect(pagos.google_play.nombre).toBe('google-play');
    expect(pagos.app_store.nombre).toBe('app-store');
  });

  it('las pasarelas de las tiendas aún no están implementadas', async () => {
    const aviso = { cuerpoCrudo: Buffer.from('{}'), encabezados: {} };
    for (const pasarela of Object.values(FabricaProveedores.pagos(tiendas, relojDelSistema))) {
      await expect(
        pasarela.verificarCompra({ tienda: 'google_play', idProducto: 'p', idCompraTienda: 'c' }),
      ).rejects.toBeInstanceOf(ErrorNoImplementado);
      await expect(pasarela.consultarSuscripcion('c')).rejects.toBeInstanceOf(ErrorNoImplementado);
      await expect(pasarela.verificarAviso(aviso)).rejects.toBeInstanceOf(ErrorNoImplementado);
    }
  });

  it('crea todos los proveedores a partir de la configuración', () => {
    const proveedores = FabricaProveedores.crear(
      {
        ia: { proveedor: 'simulado' },
        correo: { proveedor: 'consola' },
        pagos: tiendas,
      },
      relojDelSistema,
      leerModelo,
    );

    expect(proveedores.ia.nombre).toBe('simulado');
    expect(proveedores.correo.nombre).toBe('consola');
    expect(proveedores.pagos.app_store.nombre).toBe('app-store');
  });
});

describe('PasarelaPagoSimulada', () => {
  const ahora = new Date('2027-03-15T12:00:00Z');
  const pasarela = new PasarelaPagoSimulada('google_play', () => ahora);
  const compra = (idCompraTienda: string, idProducto = 'una_prueba_mensual') =>
    pasarela.verificarCompra({ tienda: 'google_play', idProducto, idCompraTienda });

  it('aprueba la compra y calcula el fin del período mensual', async () => {
    const resultado = await compra('simulado-aprobada-1');

    expect(resultado.estado).toBe('activa');
    expect(resultado.periodoFin).toEqual(new Date('2027-04-15T12:00:00Z'));
    expect(resultado.idPagoPasarela).toBe('simulado-pago-simulado-aprobada-1');
  });

  it('un plan anual dura 12 meses', async () => {
    const resultado = await compra('simulado-aprobada-2', 'todas_anual');

    expect(resultado.periodoFin).toEqual(new Date('2028-03-15T12:00:00Z'));
  });

  it('al fin de mes usa el último día del mes de término', async () => {
    const fin31 = new PasarelaPagoSimulada('app_store', () => new Date('2027-01-31T12:00:00Z'));

    const resultado = await fin31.verificarCompra({
      tienda: 'app_store',
      idProducto: 'una_prueba_mensual',
      idCompraTienda: 'simulado-aprobada-3',
    });

    expect(resultado.periodoFin).toEqual(new Date('2027-02-28T12:00:00Z'));
  });

  it('consultar una suscripción anual informa 12 meses, igual que al comprarla', async () => {
    const consulta = await pasarela.consultarSuscripcion('simulado-anual-aprobada-1');

    expect(consulta.periodoFin).toEqual(new Date('2028-03-15T12:00:00Z'));
  });

  it('rechaza o deja en mora según el dato de prueba', async () => {
    expect((await compra('simulado-rechazada-1')).estado).toBe('fallida');
    expect((await compra('simulado-mora-1')).estado).toBe('en_mora');
    expect((await compra('simulado-rechazada-1')).idPagoPasarela).toBeNull();
  });

  it('traduce un aviso simulado y rechaza uno mal formado', async () => {
    const aviso = await pasarela.verificarAviso({
      cuerpoCrudo: Buffer.from(JSON.stringify({ idEvento: 'e1', tipo: 'RENOVADA' })),
      encabezados: {},
    });

    expect(aviso).toEqual({
      tienda: 'google_play',
      idEvento: 'e1',
      tipo: 'RENOVADA',
      idCompraTienda: null,
    });
    await expect(
      pasarela.verificarAviso({ cuerpoCrudo: Buffer.from('no es json'), encabezados: {} }),
    ).rejects.toBeInstanceOf(ErrorSolicitudInvalida);
  });
});
