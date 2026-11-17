// HU-45.3 (CU-12 4.c, DAS 4.5.5): el recorrido del aviso de renovación, con dependencias falsas para los
// casos que no dependen de la base: el tope por ejecución, una falla que no detiene a las demás y el candado.
import { describe, expect, it, vi } from 'vitest';
import { registro } from '../comun/registro.js';
import { ErrorNoEncontrado } from '../comun/errores.js';
import type { CandadosDeSesion } from '../db/candados.js';
import type { Ejecutor } from '../db/transaccion.js';
import type { RenovacionPorAvisar } from '../modulos/suscripciones/suscripciones.renovacion.repositorio.js';
import {
  crearAvisoRenovacion,
  TOPE_POR_EJECUCION,
} from '../modulos/suscripciones/suscripciones.renovacion.servicio.js';

const AHORA = new Date('2027-02-25T12:00:00.000Z');
const renovacion = (id: number): RenovacionPorAvisar => ({
  id: String(id),
  estudianteId: `e${String(id)}`,
  plan: 'Todas las pruebas anual',
  montoClp: 23_990,
  tienda: 'google_play',
  idProducto: 'todas_anual',
  periodoFin: new Date('2027-03-01T15:00:00.000Z'),
});

const conCandado: CandadosDeSesion = {
  conCandado: async (_clave, trabajo) => ({ tomado: true, valor: await trabajo() }),
};

function preparar(cantidad: number, candados = conCandado) {
  const enviar = vi.fn<(para: string) => Promise<void>>(() => Promise.resolve());
  const registrarAuditoria = vi.fn(() => Promise.resolve());
  const existeAuditoria = vi.fn(() => Promise.resolve(false));
  const exportarCuenta = vi.fn((estudianteId: string) =>
    Promise.resolve({
      cuenta: { nombre: 'Ana', correo: `${estudianteId}@ejemplo.cl` },
      consentimientos: [],
    }),
  );
  const avisar = crearAvisoRenovacion(
    {
      bd: {} as Ejecutor,
      reloj: () => AHORA,
      avisoRenovacion: {
        administracion: { registrarAuditoria, existeAuditoria },
        cuentas: () => ({ exportarCuenta }) as never,
        correo: { nombre: 'consola', enviar: ({ para }) => enviar(para) },
        candados,
      },
    },
    {
      porAvisar: () =>
        Promise.resolve(Array.from({ length: cantidad }, (_, i) => renovacion(i + 1))),
    },
  );
  return { avisar, enviar, registrarAuditoria, existeAuditoria, exportarCuenta };
}

describe('aviso de renovación anual (HU-45.3)', () => {
  it('sin las dependencias del correo no hace nada', async () => {
    const avisar = crearAvisoRenovacion(
      { bd: {} as Ejecutor, reloj: () => AHORA },
      { porAvisar: () => Promise.reject(new Error('no debe consultar')) },
    );

    expect(await avisar()).toEqual({ enviados: 0, fallidos: 0 });
  });

  it('si otra ejecución tiene el candado, no envía nada', async () => {
    const { avisar, enviar } = preparar(2, {
      conCandado: () => Promise.resolve({ tomado: false }),
    });

    expect(await avisar()).toEqual({ enviados: 0, fallidos: 0 });
    expect(enviar).not.toHaveBeenCalled();
  });

  it('respeta el tope: el resto queda para la hora siguiente', async () => {
    const { avisar, enviar } = preparar(TOPE_POR_EJECUCION + 3);

    expect(await avisar()).toEqual({ enviados: TOPE_POR_EJECUCION, fallidos: 0 });
    expect(enviar).toHaveBeenCalledTimes(TOPE_POR_EJECUCION);
  });

  it('una falla no detiene a las demás y solo registra la clase del error', async () => {
    const { avisar, enviar, registrarAuditoria } = preparar(3);
    const error = vi.spyOn(registro, 'error').mockImplementation(() => undefined);
    enviar.mockRejectedValueOnce(new TypeError('SMTP rechazó e1@ejemplo.cl'));

    expect(await avisar()).toEqual({ enviados: 2, fallidos: 1 });

    expect(enviar).toHaveBeenCalledTimes(3);
    expect(registrarAuditoria).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(error.mock.calls)).toContain('TypeError');
    expect(JSON.stringify(error.mock.calls)).not.toContain('ejemplo.cl');
    error.mockRestore();
  });

  it('una ya avisada o de una cuenta borrada no cuenta como envío ni como falla', async () => {
    const { avisar, enviar, existeAuditoria, exportarCuenta } = preparar(3);
    existeAuditoria.mockResolvedValueOnce(true);
    exportarCuenta.mockRejectedValueOnce(new ErrorNoEncontrado('La cuenta no existe.'));

    expect(await avisar()).toEqual({ enviados: 1, fallidos: 0 });
    expect(enviar).toHaveBeenCalledTimes(1);
  });
});
