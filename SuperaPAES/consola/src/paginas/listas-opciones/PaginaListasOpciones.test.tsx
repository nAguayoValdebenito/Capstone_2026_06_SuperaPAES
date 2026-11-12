import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useListasOpciones } from '../../estado/listas-opciones';
import type * as ModuloListas from '../../estado/listas-opciones';
import type { ListasOpciones } from '../../tipos/temario';
import { PaginaListasOpciones } from './PaginaListasOpciones';

vi.mock('../../estado/listas-opciones', async (original) => ({
  ...(await original<typeof ModuloListas>()),
  useListasOpciones: vi.fn(),
}));

const LISTAS: ListasOpciones = {
  dificultades: [
    { codigo: 'facil', nombre: 'Fácil', minimo: 25, objetivo: 30, maximo: 35 },
    { codigo: 'media', nombre: 'Media', minimo: 40, objetivo: 45, maximo: 50 },
    { codigo: 'dificil', nombre: 'Difícil', minimo: 20, objetivo: 25, maximo: 30 },
  ],
  areasCarrera: [
    {
      codigo: 'salud',
      nombre: 'Salud',
      activa: true,
      pruebas: [
        { codigo: 'CL', nombre: 'Competencia Lectora' },
        { codigo: 'M1', nombre: 'Competencia Matemática 1' },
        { codigo: 'CIE', nombre: 'Ciencias' },
      ],
      electivo: 'Biología',
    },
    {
      codigo: 'ciencias_naturales',
      nombre: 'Ciencias naturales',
      activa: false,
      pruebas: [],
      electivo: null,
    },
  ],
  tiposEvaluacion: [
    {
      codigo: 'practica',
      nombre: 'Práctica',
      modoArmado: 'Según el estudiante, lo que eligió y la mezcla de dificultad',
      correccionInmediata: true,
      permiteCambiarRespuesta: false,
      conTiempo: false,
      permiteElegirAlcance: true,
      permiteElegirDificultad: true,
      filtraPorNivel: true,
      entregaPuntaje: false,
      unicaPorAnioEscolar: false,
      consumeCupo: true,
      cuentaParaProgreso: true,
    },
    {
      codigo: 'ensayo',
      nombre: 'Ensayo completo',
      modoArmado: 'Sorteo según la estructura de la prueba',
      correccionInmediata: false,
      permiteCambiarRespuesta: true,
      conTiempo: true,
      permiteElegirAlcance: false,
      permiteElegirDificultad: false,
      filtraPorNivel: false,
      entregaPuntaje: true,
      unicaPorAnioEscolar: false,
      consumeCupo: false,
      cuentaParaProgreso: true,
    },
  ],
  motivosAviso: [
    { codigo: 'enunciado', nombre: 'Error en el enunciado', activa: true },
    { codigo: 'otro', nombre: 'Otro', activa: false },
  ],
  tiposPregunta: [{ codigo: 'seleccion_multiple', nombre: 'Selección múltiple', activa: true }],
  tiposTexto: [{ codigo: 'grafico', nombre: 'Gráfico', activa: true }],
};

const SIN_LISTAS: ListasOpciones = {
  dificultades: [],
  areasCarrera: [],
  tiposEvaluacion: [],
  motivosAviso: [],
  tiposPregunta: [],
  tiposTexto: [],
};

type Estado = ReturnType<typeof useListasOpciones>;

function estado(cambios: Partial<Estado> = {}): Estado {
  return {
    carga: { tipo: 'lista', datos: LISTAS },
    lista: 'dificultades',
    elegir: vi.fn(),
    reintentar: vi.fn(),
    ...cambios,
  };
}

const dibujar = (cambios: Partial<Estado> = {}) => {
  vi.mocked(useListasOpciones).mockReturnValue(estado(cambios));
  return renderToString(<PaginaListasOpciones />);
};

beforeEach(() => vi.mocked(useListasOpciones).mockReset());

describe('Listas de opciones C09 / HU-64.1', () => {
  it('reemplaza «En construcción» por la consulta, sin controles de edición', () => {
    const html = dibujar();
    expect(html).toContain('>Listas de opciones</h1>');
    expect(html).not.toContain('En construcción');
    for (const texto of ['Agregar', 'Editar', 'Guardar', 'Eliminar', 'Desactivar'])
      expect(html).not.toContain(texto);
  });

  it('muestra código, nombre, mínimo, objetivo y máximo de cada dificultad', () => {
    const html = dibujar();
    for (const texto of ['Código', 'Nombre', 'Mínimo', 'Objetivo', 'Máximo', '<caption'])
      expect(html).toContain(texto);
    for (const texto of ['facil', 'Fácil', 'media', 'Media', 'dificil', 'Difícil'])
      expect(html).toContain(texto);
    for (const valor of [25, 30, 35, 40, 45, 50, 20]) expect(html).toContain(`${valor} %`);
    expect(html).toContain('scope="col"');
  });

  it('muestra las áreas con sus pruebas, su electivo y su estado', () => {
    const html = dibujar({ lista: 'areasCarrera' });
    for (const texto of [
      'Pruebas sugeridas',
      'Electivo sugerido',
      'salud',
      'Competencia Lectora, Competencia Matemática 1, Ciencias',
      'Biología',
      'Activa',
      'etiqueta--activa',
      'Ciencias naturales',
      'Sin pruebas sugeridas',
      'Sin electivo',
      'Inactiva',
    ])
      expect(html).toContain(texto);
    expect(html).not.toContain('Mínimo');
  });

  it('muestra cada tipo de evaluación con su modo de armado y su comportamiento', () => {
    const html = dibujar({ lista: 'tiposEvaluacion' });
    for (const texto of [
      'Modo de armado',
      'Comportamiento',
      'practica',
      'Según el estudiante, lo que eligió y la mezcla de dificultad',
      'Corrige al responder',
      'El estudiante elige la dificultad',
      'Descuenta cupo',
      'ensayo',
      'Corrige al entregar',
      'Con tiempo límite',
      'Entrega puntaje estimado',
      'Cuenta para el progreso',
    ])
      expect(html).toContain(texto);
  });

  it('muestra motivos de aviso, tipos de pregunta y tipos de texto con su estado', () => {
    const motivos = dibujar({ lista: 'motivosAviso' });
    for (const texto of ['enunciado', 'Error en el enunciado', 'otro', 'Activa', 'Inactiva'])
      expect(motivos).toContain(texto);
    expect(dibujar({ lista: 'tiposPregunta' })).toContain('Selección múltiple');
    expect(dibujar({ lista: 'tiposTexto' })).toContain('Gráfico');
  });

  it('ofrece las seis listas como pestañas de botones, alcanzables con el teclado', () => {
    const html = dibujar();
    expect(html).toContain('aria-label="Lista de opciones"');
    expect(html).toMatch(/<button[^>]*type="button"[^>]*aria-pressed="true"[^>]*>Dificultades</);
    for (const texto of [
      'Áreas de carrera',
      'Tipos de evaluación',
      'Motivos de aviso',
      'Tipos de pregunta',
      'Tipos de texto',
    ])
      expect(html).toMatch(new RegExp(`<button[^>]*aria-pressed="false"[^>]*>${texto}<`));
    expect(html).not.toContain('tabindex="-1"');
  });

  it('avisa cuando una lista viene vacía', () => {
    const vacia = { tipo: 'lista' as const, datos: SIN_LISTAS };
    for (const [lista, texto] of [
      ['dificultades', 'No hay dificultades cargadas.'],
      ['areasCarrera', 'No hay áreas de carrera cargadas.'],
      ['tiposEvaluacion', 'No hay tipos de evaluación cargados.'],
      ['motivosAviso', 'No hay motivos de aviso cargados.'],
      ['tiposPregunta', 'No hay tipos de pregunta cargados.'],
      ['tiposTexto', 'No hay tipos de texto cargados.'],
    ] as const)
      expect(dibujar({ carga: vacia, lista })).toContain(texto);
  });

  it('muestra la carga y, si falla, el error con un botón para reintentar', () => {
    const cargando = dibujar({ carga: { tipo: 'cargando' } });
    expect(cargando).toContain('Cargando las listas de opciones…');
    expect(cargando).not.toContain('Reintentar');

    const html = dibujar({
      carga: { tipo: 'fallida', codigo: 'SIN_CONEXION', mensaje: 'Sin conexión.' },
    });
    expect(html).toContain('Sin conexión.');
    expect(html).toContain('Reintentar');
    expect(html).not.toContain('<table');
  });
});
