// Estrategia de respaldo: solo saldo agotado; ambas llamadas comparten límites y reintento.
import { ErrorIASaldoAgotado } from '../../comun/errores.js';
import { registro } from '../../comun/registro.js';
import { crearPresupuestoIA, type PresupuestoIA } from './http.js';
import type { ProveedorIA, ResultadoGeneracion, SolicitudGeneracion } from './proveedor.js';

interface GeneracionPresupuestada {
  generarConPresupuesto(
    solicitud: SolicitudGeneracion,
    presupuesto: PresupuestoIA,
  ): Promise<ResultadoGeneracion>;
}

export class ProveedorIAConRespaldo implements ProveedorIA {
  readonly nombre = 'deepseek';

  constructor(
    private readonly principal: GeneracionPresupuestada,
    private readonly respaldo: GeneracionPresupuestada,
  ) {}

  async generarPreguntas(solicitud: SolicitudGeneracion): Promise<ResultadoGeneracion> {
    const presupuesto = crearPresupuestoIA();
    try {
      return await this.principal.generarConPresupuesto(solicitud, presupuesto);
    } catch (error) {
      if (!(error instanceof ErrorIASaldoAgotado)) throw error;
      registro.info('Se usa el respaldo de IA', {
        origen: 'deepseek',
        destino: 'gemini',
        causa: 'saldo_agotado',
        estadoHttp: 402,
      });
      return this.respaldo.generarConPresupuesto(solicitud, presupuesto);
    }
  }
}
