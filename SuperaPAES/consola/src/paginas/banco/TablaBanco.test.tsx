import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Paginacion } from '../../componentes/Paginacion';
import type { OpcionesFiltrosBanco, PreguntaDelBanco } from '../../tipos';
import { FiltrosBanco } from './FiltrosBanco';
import { ResultadoBanco } from './PaginaBanco';
import { TablaBanco } from './TablaBanco';

const pregunta = (cambios: Partial<PreguntaDelBanco> = {}): PreguntaDelBanco => ({
  id: 7,
  resumen: 'Si 2x + 3 = 11, ¿cuánto vale x?',
  prueba: { id: 2, codigo: 'M1', nombre: 'Matemática 1' },
  eje: { id: 11, nombre: 'Álgebra' },
  contenido: { id: 110, nombre: 'Ecuaciones' },
  estado: { codigo: 'en_revision', nombre: 'En revisión' },
  origen: 'importacion',
  dificultadSugerida: { codigo: 'facil', nombre: 'Fácil' },
  dificultadAsignada: null,
  posibleAmbigua: false,
  actualizadoEn: '2026-10-20T12:00:00.000Z',
  ...cambios,
});

const OPCIONES: OpcionesFiltrosBanco = {
  pruebas: [
    {
      id: 2,
      codigo: 'M1',
      nombre: 'Matemática 1',
      ejes: [{ id: 11, nombre: 'Álgebra', contenidos: [{ id: 110, nombre: 'Ecuaciones' }] }],
      habilidades: [{ id: 30, nombre: 'Modelar' }],
    },
  ],
  estados: [{ codigo: 'borrador', nombre: 'Borrador' }],
  origenes: [
    { codigo: 'manual', nombre: 'Manual' },
    { codigo: 'importacion', nombre: 'Importada' },
    { codigo: 'ia', nombre: 'IA' },
  ],
  dificultades: [{ codigo: 'media', nombre: 'Media' }],
};
const nada = () => undefined;

describe('tabla del banco (C02, HU-11 esc. 2)', () => {
  it('muestra el estado de cada pregunta, su ubicación en el temario, el origen y la dificultad', () => {
    const html = renderToString(
      <TablaBanco
        preguntas={[
          pregunta(),
          pregunta({
            id: 8,
            estado: { codigo: 'publicada', nombre: 'Publicada' },
            origen: 'ia',
            dificultadAsignada: { codigo: 'media', nombre: 'Media' },
          }),
        ]}
      />,
    );

    expect(html).toContain('etiqueta--en_revision">En revisión<');
    expect(html).toContain('etiqueta--publicada">Publicada<');
    expect(html).toContain('Álgebra');
    expect(html).toContain('Ecuaciones');
    expect(html).toContain('>Importada<');
    expect(html).toContain('>IA<');
    expect(html).toContain('Sugerida: <!-- -->Fácil');
    expect(html).toContain('Media');
    expect(html).not.toContain('es_correcta');
    expect(html).not.toContain('Posiblemente confusa');
  });

  it('marca las preguntas posiblemente confusas (C02)', () => {
    const html = renderToString(<TablaBanco preguntas={[pregunta({ posibleAmbigua: true })]} />);

    expect(html).toContain('etiqueta--confusa">Posiblemente confusa<');
  });

  it('sin preguntas avisa que no hay resultados para el filtro', () => {
    expect(renderToString(<TablaBanco preguntas={[]} />)).toContain(
      'No hay preguntas que cumplan el filtro.',
    );
  });
});

describe('estados de la página del banco', () => {
  it('mientras carga lo avisa', () => {
    const html = renderToString(
      <ResultadoBanco carga={{ tipo: 'cargando' }} alCambiarPagina={nada} />,
    );

    expect(html).toContain('Cargando preguntas');
  });

  it('si la API falla muestra su mensaje en español, con el código', () => {
    const html = renderToString(
      <ResultadoBanco
        carga={{
          tipo: 'fallida',
          codigo: 'ERROR_INTERNO',
          mensaje: 'Ocurrió un error inesperado.',
        }}
        alCambiarPagina={nada}
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('Ocurrió un error inesperado.');
    expect(html).toContain('ERROR_INTERNO');
  });

  it('sin resultados no muestra la paginación', () => {
    const html = renderToString(
      <ResultadoBanco
        carga={{
          tipo: 'lista',
          pagina: { preguntas: [], paginacion: { pagina: 1, porPagina: 20, total: 0 } },
        }}
        alCambiarPagina={nada}
      />,
    );

    expect(html).toContain('No hay preguntas que cumplan el filtro.');
    expect(html).not.toContain('Siguiente');
  });

  it('con preguntas muestra la tabla y la paginación', () => {
    const html = renderToString(
      <ResultadoBanco
        carga={{
          tipo: 'lista',
          pagina: { preguntas: [pregunta()], paginacion: { pagina: 1, porPagina: 20, total: 21 } },
        }}
        alCambiarPagina={nada}
      />,
    );

    expect(html).toContain('<table');
    expect(html).toContain('Página <!-- -->1<!-- --> de <!-- -->2');
  });
});

describe('filtros del banco (C02, HU-11 esc. 1)', () => {
  it('ofrece prueba, eje, contenido, habilidad, estado, origen y dificultad; los del temario esperan a la prueba', () => {
    const html = renderToString(
      <FiltrosBanco opciones={OPCIONES} filtros={{}} alCambiar={nada} alLimpiar={nada} />,
    );

    for (const etiqueta of [
      'Prueba',
      'Eje',
      'Contenido',
      'Habilidad',
      'Estado',
      'Origen',
      'Dificultad asignada',
    ]) {
      expect(html).toContain(`${etiqueta}<select`);
    }
    expect(html.match(/<select disabled=""/g)).toHaveLength(3);
    expect(html).toContain('>Importada<');
    expect(html).toContain('disabled="">Limpiar filtros');
  });

  it('con prueba y eje elegidos, se pueden elegir sus contenidos', () => {
    const html = renderToString(
      <FiltrosBanco
        opciones={OPCIONES}
        filtros={{ prueba: 2, eje: 11 }}
        alCambiar={nada}
        alLimpiar={nada}
      />,
    );

    expect(html).not.toContain('<select disabled=""');
    expect(html).toContain('>Ecuaciones<');
    expect(html).toContain('>Modelar<');
  });
});

describe('paginación (HU-11 esc. 3)', () => {
  it('en la primera página no hay anterior; muestra el tramo y el total', () => {
    const html = renderToString(
      <Paginacion
        paginacion={{ pagina: 1, porPagina: 20, total: 45 }}
        totalPaginas={3}
        alCambiar={nada}
      />,
    );

    expect(html).toContain('disabled="">Anterior');
    expect(html).not.toContain('disabled="">Siguiente');
    expect(html).toContain('Página <!-- -->1<!-- --> de <!-- -->3');
    expect(html).toContain('1<!-- -->–<!-- -->20<!-- --> de <!-- -->45');
  });

  it('en la última página no hay siguiente', () => {
    const html = renderToString(
      <Paginacion
        paginacion={{ pagina: 3, porPagina: 20, total: 45 }}
        totalPaginas={3}
        alCambiar={nada}
      />,
    );

    expect(html).not.toContain('disabled="">Anterior');
    expect(html).toContain('disabled="">Siguiente');
    expect(html).toContain('41<!-- -->–<!-- -->45');
  });
});
