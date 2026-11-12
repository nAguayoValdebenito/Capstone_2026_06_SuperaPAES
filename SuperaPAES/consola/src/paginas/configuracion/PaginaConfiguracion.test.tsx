import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConfiguracion } from '../../estado/configuracion';
import type { ParametroConfiguracion } from '../../tipos/configuracion';
import { PaginaConfiguracion } from './PaginaConfiguracion';

vi.mock('../../estado/configuracion', () => ({ useConfiguracion: vi.fn() }));

const parametro: ParametroConfiguracion = {
  clave: 'cupo_inicial',
  nombre: 'Cupo diario sin correo verificado',
  descripcion: 'Preguntas por día',
  valor: 10,
  unidad: 'preguntas',
  editable: true,
  regla: 'RN-01',
  actualizadoEn: '2026-11-12T12:00:00.000Z',
  actualizadoPor: 'Admin',
};

function estado(carga: ReturnType<typeof useConfiguracion>['carga']) {
  return {
    carga,
    borradores: {},
    errores: {},
    confirmacion: null,
    guardando: false,
    aviso: null,
    cambiarBorrador: vi.fn(),
    abrirConfirmacion: vi.fn(),
    cerrarConfirmacion: vi.fn(),
    confirmarCambio: vi.fn(),
    reintentar: vi.fn(),
  } satisfies ReturnType<typeof useConfiguracion>;
}

beforeEach(() => vi.mocked(useConfiguracion).mockReturnValue(estado({ tipo: 'cargando' })));

describe('Configuración C12 (HU-51.2)', () => {
  it('muestra carga, error con reintento y estado vacío', () => {
    expect(renderToString(<PaginaConfiguracion />)).toContain('Cargando la configuración');
    vi.mocked(useConfiguracion).mockReturnValue(
      estado({ tipo: 'fallida', codigo: 'SIN_CONEXION', mensaje: 'Sin conexión' }),
    );
    const error = renderToString(<PaginaConfiguracion />);
    expect(error).toContain('Sin conexión');
    expect(error).toContain('Reintentar');
    vi.mocked(useConfiguracion).mockReturnValue(
      estado({ tipo: 'lista', datos: { parametros: [] } }),
    );
    expect(renderToString(<PaginaConfiguracion />)).toContain('No hay parámetros');
  });

  it('agrupa parámetros, muestra unidad y deja los de solo lectura sin campo', () => {
    vi.mocked(useConfiguracion).mockReturnValue(
      estado({
        tipo: 'lista',
        datos: {
          parametros: [
            parametro,
            {
              ...parametro,
              clave: 'modelo_ia',
              nombre: 'Modelo de IA',
              valor: 'modelo',
              unidad: '',
              editable: false,
            },
          ],
        },
      }),
    );
    const html = renderToString(<PaginaConfiguracion />);
    expect(html).toContain('Cupos e invitaciones');
    expect(html).toContain('Generación con IA');
    expect(html).toContain('aria-describedby=');
    expect(html).toContain('preguntas');
    expect(html).toContain('Solo lectura');
    expect(html.match(/<input/g)).toHaveLength(1);
  });

  it('muestra error de campo y la confirmación con antes y después', () => {
    vi.mocked(useConfiguracion).mockReturnValue({
      ...estado({ tipo: 'lista', datos: { parametros: [parametro] } }),
      errores: { cupo_inicial: 'Escribe un número entero.' },
      confirmacion: { parametro, valor: 12 },
    });
    const html = renderToString(<PaginaConfiguracion />);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('Escribe un número entero.');
    expect(html).toContain('role="alertdialog"');
    expect(html).toContain('Confirmar cambio');
    expect(html).toContain('12');
  });
});
