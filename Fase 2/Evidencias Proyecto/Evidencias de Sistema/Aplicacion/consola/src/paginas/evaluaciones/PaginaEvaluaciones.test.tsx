import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { useEstructuras, useTablas } from '../../estado/evaluaciones';
import type { Estructura, TablaConversion } from '../../tipos/evaluaciones';
import {
  camposDe,
  cantidadesDe,
  edicionDe,
  gratisDe,
  leerTabla,
  preguntasDe,
  problemaDeLaCarga,
  sumaDelReparto,
  tiempoDe,
} from '../../utilidades/evaluaciones';
import { FormularioEstructura } from './FormularioEstructura';
import { PanelEstructuras } from './PanelEstructuras';
import { PanelTablas } from './PanelTablas';

vi.mock('../../estado/evaluaciones', () => ({ useEstructuras: vi.fn(), useTablas: vi.fn() }));

const mini: Estructura = {
  id: 19,
  tipo: 'mini_ensayo',
  tipoNombre: 'Mini-ensayo',
  cantidadMin: 22,
  cantidadMax: 22,
  noPuntuables: 0,
  duracionMin: 48,
  textos: null,
  usosGratisMes: 1,
  reparto: [
    { id: 1, nombre: 'Números', cantidad: 12, noPuntuables: 0 },
    { id: 2, nombre: 'Geometría', cantidad: 10, noPuntuables: 0 },
  ],
};

const practica: Estructura = {
  ...mini,
  id: 2,
  tipo: 'practica',
  tipoNombre: 'Práctica',
  cantidadMin: 5,
  cantidadMax: 20,
  duracionMin: null,
  usosGratisMes: 0,
  reparto: [],
};

const tabla: TablaConversion = {
  id: 4,
  anioAdmision: 2026,
  proceso: 'Regular',
  electivoId: null,
  electivo: null,
  publicadaEn: '2026-01-05',
  filas: 61,
  vigente: true,
};

function estructuras(editandoId: number | null = null) {
  vi.mocked(useEstructuras).mockReturnValue({
    carga: { tipo: 'lista', datos: [practica, mini] },
    editandoId,
    editar: vi.fn(),
    guardarEstructura: vi.fn().mockResolvedValue(undefined),
    guardando: false,
    error: null,
    aviso: null,
  });
}

const formulario = (estructura: Estructura) =>
  renderToString(
    <FormularioEstructura
      estructura={estructura}
      guardando={false}
      error={null}
      alGuardar={vi.fn()}
      alCancelar={vi.fn()}
    />,
  );

describe('Estructuras de C08 (CU-31)', () => {
  it('muestra cada tipo con sus valores y un guion donde no aplica', () => {
    estructuras();

    const html = renderToString(<PanelEstructuras pruebaId={2} />);

    for (const texto of ['Práctica', '5 a 20', 'Mini-ensayo', '48 min', 'Editar']) {
      expect(html).toContain(texto);
    }
    expect(preguntasDe(mini)).toBe('22');
    expect(tiempoDe(practica)).toBe('—');
    expect(gratisDe(practica)).toBe('—');
  });

  it('una evaluación con reparto pide una cantidad y muestra la suma de sus ejes', () => {
    const html = formulario(mini);

    expect(html).toContain('Números');
    expect(html).toContain('Tiempo (minutos)');
    expect(html).not.toContain('Mínimo de preguntas');
    expect(html).toContain('estado__ok');
  });

  it('marca el total si el reparto no suma', () => {
    const html = formulario({ ...mini, cantidadMax: 23, cantidadMin: 23 });

    expect(html).toContain('estado__error');
  });

  it('una evaluación sin tiempo ni reparto pide su rango y no ofrece tiempo', () => {
    const html = formulario(practica);

    expect(html).toContain('Mínimo de preguntas');
    expect(html).not.toContain('Tiempo (minutos)');
    expect(html).not.toContain('Total:');
  });

  it('envía una sola cantidad si hay reparto, y deja en null lo que no aplica', () => {
    const campos = { ...camposDe(mini), maximo: '24', minimo: '22' };

    expect(edicionDe(mini, campos)).toMatchObject({
      cantidadMin: 24,
      cantidadMax: 24,
      textos: null,
    });
    expect(edicionDe(practica, camposDe(practica))).toMatchObject({
      cantidadMin: 5,
      cantidadMax: 20,
      duracionMin: null,
      reparto: [],
    });
  });

  it('calcula las cantidades y su suma', () => {
    expect(cantidadesDe(mini.reparto)).toEqual({ 1: '12', 2: '10' });
    expect(sumaDelReparto([12, 10])).toBe(22);
  });
});

describe('Tablas de conversión de C08 (RN-23)', () => {
  const tablas = (lista: TablaConversion[], electivos: { id: number; nombre: string }[] = []) => {
    vi.mocked(useTablas).mockReturnValue({
      carga: {
        tipo: 'lista',
        datos: { tablas: lista, procesos: [{ id: 1, nombre: 'Regular' }], electivos },
      },
      guardarTabla: vi.fn().mockResolvedValue(true),
      guardando: false,
      error: null,
      aviso: null,
    });
  };

  it('marca la tabla vigente y ofrece cargar otra', () => {
    tablas([tabla, { ...tabla, id: 3, anioAdmision: 2025, vigente: false }]);

    const html = renderToString(<PanelTablas pruebaId={2} />);

    expect(html).toContain('Vigente');
    expect(html).toContain('Anterior');
    expect(html).toContain('Cargar tabla del DEMRE');
    expect(html).not.toContain('Electivo</label>');
  });

  it('sin tabla avisa que el ensayo no tendrá puntaje', () => {
    tablas([]);

    expect(renderToString(<PanelTablas pruebaId={2} />)).toContain('aún no tiene tabla');
  });

  it('en Ciencias pide el electivo', () => {
    tablas([tabla], [{ id: 8, nombre: 'Biología' }]);

    expect(renderToString(<PanelTablas pruebaId={5} />)).toContain('Elige el electivo');
  });

  it.each([
    ['0,100\n1,159', [100, 159]],
    ['0;100\r\n1;159\r\n', [100, 159]],
    ['0\t100\n1\t159', [100, 159]],
  ])('lee %j, también pegada desde Excel', (texto, puntajes) => {
    const leida = leerTabla(texto);

    expect('filas' in leida && leida.filas.map((f) => f.puntaje)).toEqual(puntajes);
  });

  it('pide lo que falta antes de cargar', () => {
    const campos = { anio: '2027', procesoId: 1, publicadaEn: '2027-01-05' };

    expect(problemaDeLaCarga({ ...campos, publicadaEn: '' }, false)).toContain('fecha');
    expect(problemaDeLaCarga(campos, true)).toBe('Elige el electivo.');
    expect(problemaDeLaCarga({ ...campos, electivoId: 8 }, true)).toMatchObject({
      electivoAreaId: 8,
      anioAdmision: 2027,
    });
  });

  it('explica qué línea no se pudo leer, o si no hay filas', () => {
    expect(leerTabla('0,100\nhola')).toEqual({
      error: 'La línea 2 debe tener correctas y puntaje.',
    });
    expect(leerTabla('  ')).toEqual({
      error: 'Pega la tabla: una línea por cantidad de correctas.',
    });
  });
});
