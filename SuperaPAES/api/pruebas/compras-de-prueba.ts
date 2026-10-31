// Entorno de las pruebas de validación de compras (HU-43.1) contra PostgreSQL real: la app usa una
// pasarela falsa que responde lo que cada prueba indica (como la tienda, ya traducido por el adaptador)
// y guarda las confirmaciones. Las pasarelas reales se prueban aparte con respuestas simuladas.
// La hora queda fija en noviembre (horario de verano de Chile, sin cambios de hora en el mes).
import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, expect, vi } from 'vitest';
import type { CompraVerificada, PasarelaPago } from '../adaptadores/fabrica.js';
import { crearDependenciasDePrueba } from './ayudantes.js';
import { prepararPracticas } from './base-practicas.js';
import { historialDe, pagosDe, suscripcionGuardada } from './suscripciones-de-prueba.js';

export const RUTA_SUSCRIPCIONES = '/api/v1/app/suscripciones';
export const AHORA = new Date('2026-11-15T15:00:00.000Z');
export const FIN_MENSUAL = new Date('2026-12-15T15:00:00.000Z');

/** Una compra que la tienda confirma como activa, con lo que cambia cada caso. */
export function compraActiva(cambios: Partial<CompraVerificada> = {}): CompraVerificada {
  return {
    tienda: 'google_play',
    idCompraTienda: 'token-compra-1',
    idProducto: 'todas_mensual',
    cuentaTienda: null,
    estado: 'activa',
    periodoInicio: null,
    periodoFin: FIN_MENSUAL,
    idPagoPasarela: 'GPA.0001',
    porConfirmar: false,
    productoRenovacion: null,
    ...cambios,
  };
}

/** Pasarela falsa para las dos tiendas: `verificar` y `confirmar` se ajustan en cada prueba. */
function tiendaFalsa() {
  const verificar = vi.fn<(id: string) => Promise<CompraVerificada>>();
  const confirmar =
    vi.fn<(compra: Pick<CompraVerificada, 'idProducto' | 'idCompraTienda'>) => Promise<void>>();
  const noSeUsa = () => Promise.reject(new Error('HU-44'));
  const pasarela: PasarelaPago = {
    nombre: 'simulado',
    verificarCompra: (id) => verificar(id),
    confirmarCompra: (compra) => confirmar(compra),
    consultarSuscripcion: noSeUsa,
    verificarAviso: noSeUsa,
  };
  return {
    verificar,
    confirmar,
    pagos: { google_play: pasarela, app_store: pasarela },
    reiniciar() {
      verificar.mockReset();
      confirmar.mockReset();
      confirmar.mockResolvedValue(undefined);
    },
  };
}

export function prepararCompras(prefijo: string) {
  const base = prepararPracticas(prefijo);
  const { entorno } = base;
  const planes: Record<string, number> = {};
  const tienda = tiendaFalsa();
  let app: Express;

  beforeAll(async () => {
    const { rows } = await entorno.bd.query<{ nombre: string; id: number }>(
      'SELECT nombre, id FROM contenido.plan',
    );
    for (const plan of rows) planes[plan.nombre] = plan.id;
    app = entorno.crearAppCon({
      proveedores: { ...crearDependenciasDePrueba().proveedores, pagos: tienda.pagos },
    });
  });

  beforeEach(() => {
    tienda.reiniciar();
    entorno.fijarHora(AHORA);
  });

  /** Crea la pendiente del plan y devuelve lo que la app recibe (id y cuenta en la tienda). */
  async function pendiente(
    token: string,
    plan: string,
    extra: { tienda?: 'google_play' | 'app_store'; pruebaId?: number } = {},
  ) {
    const respuesta = await request(app)
      .post(RUTA_SUSCRIPCIONES)
      .set('Authorization', `Bearer ${token}`)
      .send({
        planId: planes[plan],
        tienda: extra.tienda ?? 'google_play',
        pruebaId: extra.pruebaId,
      });
    expect(respuesta.status).toBe(201);
    return respuesta.body.data as { id: number; cuentaTienda: string; planId: number };
  }

  /** POST /app/suscripciones/{id}/compra, en la app con la pasarela falsa o en la indicada. */
  const validar = (token: string, id: number, cuerpo: Record<string, unknown>, en?: Express) =>
    request(en ?? app)
      .post(`${RUTA_SUSCRIPCIONES}/${String(id)}/compra`)
      .set('Authorization', `Bearer ${token}`)
      .send(cuerpo);

  return {
    base,
    entorno,
    planes,
    tienda,
    pendiente,
    validar,
    guardada: (id: number) => suscripcionGuardada(entorno.bd, id),
    historial: (id: number) => historialDe(entorno.bd, id),
    pagos: (id: number) => pagosDe(entorno.bd, id),
  };
}
