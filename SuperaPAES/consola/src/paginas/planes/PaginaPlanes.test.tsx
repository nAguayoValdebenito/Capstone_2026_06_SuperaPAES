import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlanes, type CargaPlanes } from '../../estado/planes';
import { datosPlanes, planDePrueba } from '../../pruebas/planes';
import { FormularioPlan } from './FormularioPlan';
import { PaginaPlanes } from './PaginaPlanes';
import { TablaPlanes } from './TablaPlanes';

vi.mock('../../estado/planes', () => ({ usePlanes: vi.fn() }));

function estado(carga: CargaPlanes, guardando = false) {
  return {
    carga,
    plan: planDePrueba,
    guardando,
    aviso: '',
    seleccionar: vi.fn(),
    guardar: vi.fn().mockResolvedValue(undefined),
    reintentar: vi.fn(),
  };
}

beforeEach(() =>
  vi.mocked(usePlanes).mockReturnValue(estado({ tipo: 'lista', datos: datosPlanes })),
);

describe('Planes C11 (HU-52.2, solo editar)', () => {
  it('muestra la tabla, el formulario y las notas del boceto sin ofrecer crear', () => {
    const html = renderToString(<PaginaPlanes />);
    for (const texto of [
      'Producto Google Play',
      'Producto App Store',
      'Periodicidad',
      'Precio (CLP)',
      'Editar plan:',
      'Guardar',
      'Cancelar',
      'Un plan desactivado',
      'El plan Gratis no se cobra',
    ]) {
      expect(html).toContain(texto);
    }
    expect(html).not.toContain('Nuevo plan');
    expect(html).not.toContain('En construcción');
  });

  it('precarga los identificadores reales y los valores del plan', () => {
    const html = renderToString(
      <FormularioPlan
        plan={planDePrueba}
        opciones={datosPlanes}
        guardando={false}
        alGuardar={vi.fn()}
        alCancelar={vi.fn()}
      />,
    );
    expect(html).toContain('value="23" selected=""');
    expect(html).toContain('value="31" selected=""');
    expect(html).toContain('value="1990"');
    expect(html).toContain('value="una_prueba_mensual"');
  });

  it('muestra carga y permite reintentar una carga fallida', () => {
    vi.mocked(usePlanes).mockReturnValue(estado({ tipo: 'cargando' }));
    expect(renderToString(<PaginaPlanes />)).toContain('Cargando planes');
    vi.mocked(usePlanes).mockReturnValue(estado({ tipo: 'fallida', mensaje: 'Sin conexión.' }));
    const html = renderToString(<PaginaPlanes />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('Sin conexión.');
    expect(html).toContain('Reintentar');
  });

  it('durante el guardado bloquea los campos y cambiar de fila', () => {
    vi.mocked(usePlanes).mockReturnValue(estado({ tipo: 'lista', datos: datosPlanes }, true));
    const html = renderToString(<PaginaPlanes />);
    expect(html).toContain('<fieldset disabled=""');
    expect(html).toContain('Guardando…');
    expect(html).toContain('disabled="" aria-label="Editar Una prueba mensual"');
  });

  it('un plan inactivo sigue visible para poder editarlo', () => {
    const html = renderToString(
      <TablaPlanes
        planes={[{ ...planDePrueba, activo: false }]}
        seleccionado={undefined}
        guardando={false}
        alEditar={vi.fn()}
      />,
    );
    expect(html).toContain('Desactivado');
    expect(html).toContain('Editar Una prueba mensual');
  });
});
