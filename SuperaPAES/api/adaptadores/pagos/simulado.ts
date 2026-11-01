// Pasarela simulada: recorre el mismo flujo que las tiendas sin salir del servidor. La usan el
// desarrollo y las pruebas automáticas. Una compra simulada es «<producto>:<cuentaTienda>», con
// «:pendiente» (pago en espera), «:rechazada» (primer pago fallido) o «:vencida» (no vigente) al final
// si se quiere otro resultado; sin producto y cuenta, la tienda no la encuentra. Al consultar una
// suscripción, el dato de prueba decide: "rechazada" falla, "mora" queda en mora y lo demás se aprueba.
// Un producto o compra que contiene "anual" dura 12 meses; el resto, 1 mes.
// Los avisos no llevan firma: nunca se usa con PROVEEDOR_PAGOS=tiendas.
import { z } from 'zod';
import { ErrorCompraNoValida, ErrorSolicitudInvalida } from '../../comun/errores.js';
import type { Reloj } from '../../comun/reloj.js';
import type {
  AvisoEntrante,
  AvisoVerificado,
  CompraVerificada,
  EstadoSuscripcion,
  PasarelaPago,
  SuscripcionEnTienda,
  Tienda,
} from './pasarela.js';

const esquemaAviso = z.object({
  idEvento: z.string().min(1),
  tipo: z.string().min(1),
  idCompraTienda: z.string().min(1).nullable().default(null),
});

function estadoSimulado(idCompraTienda: string): EstadoSuscripcion {
  if (idCompraTienda.includes('rechazada')) return 'fallida';
  if (idCompraTienda.includes('mora')) return 'en_mora';
  return 'activa';
}

export class PasarelaPagoSimulada implements PasarelaPago {
  readonly nombre = 'simulado';

  constructor(
    private readonly tienda: Tienda,
    private readonly reloj: Reloj,
  ) {}

  verificarCompra(idCompraTienda: string): Promise<CompraVerificada> {
    const [idProducto, cuentaTienda, resultado, ...resto] = idCompraTienda.split(':');
    if (!idProducto || !cuentaTienda || resto.length > 0)
      return Promise.reject(new ErrorCompraNoValida('no_encontrada'));
    if (resultado === 'vencida') return Promise.reject(new ErrorCompraNoValida('no_vigente'));
    const estado =
      resultado === 'pendiente' ? 'pendiente' : resultado === 'rechazada' ? 'fallida' : 'activa';
    const cobrada = estado === 'activa';
    return Promise.resolve({
      tienda: this.tienda,
      idCompraTienda,
      idProducto,
      cuentaTienda,
      estado,
      periodoInicio: cobrada ? this.reloj() : null,
      periodoFin: cobrada ? this.finDePeriodo(idProducto) : null,
      idPagoPasarela: cobrada ? `sim-${idCompraTienda}` : null,
      porConfirmar: false,
      productoRenovacion: null,
    });
  }

  /** Las compras simuladas no se confirman: no hay tienda que las reembolse. */
  confirmarCompra(_compra: Pick<CompraVerificada, 'idProducto' | 'idCompraTienda'>): Promise<void> {
    return Promise.resolve();
  }

  consultarSuscripcion(idCompraTienda: string): Promise<SuscripcionEnTienda> {
    const estado = estadoSimulado(idCompraTienda);
    return Promise.resolve({
      idCompraTienda,
      estado,
      periodoFin: estado === 'activa' ? this.finDePeriodo(idCompraTienda) : null,
      renovacionAutomatica: estado === 'activa',
    });
  }

  verificarAviso(aviso: AvisoEntrante): Promise<AvisoVerificado> {
    let datos: unknown;
    try {
      datos = JSON.parse(aviso.cuerpoCrudo.toString('utf8'));
    } catch {
      return Promise.reject(new ErrorSolicitudInvalida('El aviso simulado no es JSON válido.'));
    }
    const resultado = esquemaAviso.safeParse(datos);
    if (!resultado.success) {
      return Promise.reject(
        new ErrorSolicitudInvalida('El aviso simulado no tiene el formato esperado.'),
      );
    }
    return Promise.resolve({ tienda: this.tienda, ...resultado.data });
  }

  /**
   * Planes anuales: 12 meses; el resto: 1 mes. Si el día no existe en el mes de término
   * (31 de enero + 1 mes), se usa el último día de ese mes, como hacen las tiendas.
   */
  private finDePeriodo(datoDePrueba: string): Date {
    const inicio = this.reloj();
    const meses = datoDePrueba.includes('anual') ? 12 : 1;
    const fin = new Date(inicio);
    fin.setUTCDate(1);
    fin.setUTCMonth(fin.getUTCMonth() + meses);
    const ultimoDia = new Date(
      Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth() + 1, 0),
    ).getUTCDate();
    fin.setUTCDate(Math.min(inicio.getUTCDate(), ultimoDia));
    return fin;
  }
}
