// Pantalla de importación (C04, HU-13.2, CP-10): los archivos y las columnas de la plantilla, el informe
// con sus cuatro contadores, las filas con error y sus motivos, y la declaración del origen (RN-29) que
// habilita la confirmación. El banco ofrece importar y muestra el aviso al volver.
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Importacion, RevisionImportacion } from '../../estado/importacion';
import type { InformeImportacion } from '../../tipos';
import { PaginaBanco } from '../banco/PaginaBanco';
import { ContenidoImportacion } from './PaginaImportar';

const sinAccion = () => undefined;

/** Informe de CP-10: dos por crear, una omitida, una sin correcta y una fuera del temario. */
const INFORME_CP10: InformeImportacion = {
  filasLeidas: 5,
  porCrear: 2,
  omitidas: 1,
  conError: 2,
  textosPorCrear: 0,
  errores: [
    {
      archivo: 'preguntas',
      fila: 4,
      resumen: 'Sin correcta',
      motivos: ['No indica la alternativa correcta.'],
    },
    {
      archivo: 'preguntas',
      fila: 5,
      resumen: 'Fuera del temario',
      motivos: [
        'El contenido «Trigonometría» no existe en el eje Álgebra.',
        'Falta la explicación de la respuesta correcta.',
      ],
    },
  ],
};

const lista = (informe: InformeImportacion = INFORME_CP10): RevisionImportacion => ({
  tipo: 'lista',
  informe,
  archivos: { preguntas: { nombre: 'preguntas.csv', contenido: '' }, textos: null },
});

function dibujar(cambios: Partial<Importacion> = {}) {
  const importacion: Importacion = {
    nombres: { preguntas: 'preguntas.csv', textos: null },
    revision: lista(),
    declara: false,
    enviando: false,
    error: null,
    cambiarArchivo: sinAccion,
    cambiarDeclaracion: sinAccion,
    confirmar: sinAccion,
    ...cambios,
  };
  return renderToString(
    <MemoryRouter>
      <ContenidoImportacion importacion={importacion} />
    </MemoryRouter>,
  );
}

/** El botón de confirmar, con sus atributos. */
const botonConfirmar = (html: string) =>
  /<button type="submit"[^>]*>(Confirmar importación|Importando…)<\/button>/.exec(html)?.[0] ?? '';

describe('C04 · importar preguntas (HU-13.2)', () => {
  it('pide el CSV de preguntas y el de textos, con las columnas de la plantilla y vuelta al banco', () => {
    const html = dibujar({
      revision: { tipo: 'sin_archivo' },
      nombres: { preguntas: null, textos: null },
    });

    expect(html).toContain('Importar preguntas');
    expect(html).toContain('Preguntas (CSV UTF-8, una fila por pregunta)');
    expect(html).toContain('Textos de lectura (CSV UTF-8, opcional)');
    expect(html).toMatch(
      /<input id="archivo-preguntas" class="importar__entrada" type="file" accept=".csv,text\/csv" aria-labelledby="archivo-preguntas-titulo"/,
    );
    expect(html).toContain('<label for="archivo-preguntas" class="boton">Elegir archivo</label>');
    expect(html).toContain('Ningún archivo elegido.');
    expect(html).toContain('prueba, eje, contenido, habilidad, tipo, enunciado, codigo_texto');
    expect(html).toContain('codigo, tipo_texto, titulo, contenido');
    expect(html).toContain('href="/banco"');
    expect(html).not.toContain('Confirmar importación');
  });

  it('CP-10: muestra los contadores y cada fila con error con todos sus motivos', () => {
    const html = dibujar();

    for (const [nombre, valor] of [
      ['Filas leídas', 5],
      ['Por crear', 2],
      ['Omitidas', 1],
      ['Con error', 2],
    ] as const) {
      expect(html).toContain(`<dt>${nombre}</dt><dd>${String(valor)}</dd>`);
    }
    expect(html).toContain('<caption>Filas con errores</caption>');
    expect(html).toContain(
      '<td>4</td><td>Sin correcta</td><td>No indica la alternativa correcta.</td>',
    );
    expect(html).toContain('<li>El contenido «Trigonometría» no existe en el eje Álgebra.</li>');
    expect(html).toContain('<li>Falta la explicación de la respuesta correcta.</li>');
    expect(html).toContain('Se crean 2 borradores con origen importación.');
  });

  it('RN-29: sin la declaración del origen no se puede confirmar', () => {
    const html = dibujar();

    expect(html).toContain(
      'no provienen de los facsímiles del DEMRE ni de otro material protegido',
    );
    expect(botonConfirmar(html)).toContain('disabled');
    expect(botonConfirmar(dibujar({ declara: true }))).not.toContain('disabled');
  });

  it('no se confirma un archivo sin preguntas válidas, ni dos veces', () => {
    const sinValidas = dibujar({
      declara: true,
      revision: lista({ ...INFORME_CP10, porCrear: 0 }),
    });
    expect(sinValidas).toContain('El archivo no tiene preguntas válidas para importar.');
    expect(botonConfirmar(sinValidas)).toContain('disabled');

    const enviando = dibujar({ declara: true, enviando: true });
    expect(botonConfirmar(enviando)).toContain('Importando…');
    expect(botonConfirmar(enviando)).toContain('disabled');
  });

  it('cuenta los textos de lectura que se crean', () => {
    const html = dibujar({ revision: lista({ ...INFORME_CP10, porCrear: 1, textosPorCrear: 1 }) });

    expect(html).toContain('Se crea 1 borrador con origen importación y 1 texto de lectura.');
  });

  it('CP-10: un archivo que no sigue la plantilla muestra la explicación, sin informe', () => {
    const mensaje =
      'El archivo «preguntas.csv» no sigue la plantilla: faltan las columnas «correcta».';
    const html = dibujar({ revision: { tipo: 'rechazada', codigo: 'VALIDACION', mensaje } });

    expect(html).toContain(mensaje);
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('Filas leídas');
  });

  it('muestra el error de la API al confirmar y el archivo de textos elegido con su opción de quitar', () => {
    const html = dibujar({
      error: 'El archivo no tiene preguntas válidas para importar.',
      nombres: { preguntas: 'preguntas.csv', textos: 'textos.csv' },
    });

    expect(html).toContain('Elegido: <strong>textos.csv</strong>');
    expect(html).toContain('<label for="archivo-textos" class="boton">Cambiar archivo</label>');
    expect(html).toContain('Quitar</button>');
    expect(html).toMatch(/aviso--error" role="alert">El archivo no tiene preguntas válidas/);
  });

  it('escapa los textos que vienen del archivo', () => {
    const html = dibujar({
      revision: lista({
        ...INFORME_CP10,
        errores: [
          { archivo: 'textos', fila: 2, resumen: '<img src=x onerror=alert(1)>', motivos: ['x'] },
        ],
      }),
    });

    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('banco (C02) e importación', () => {
  const banco = (estado?: unknown) =>
    renderToString(
      <MemoryRouter initialEntries={[{ pathname: '/banco', state: estado }]}>
        <PaginaBanco />
      </MemoryRouter>,
    );

  it('ofrece importar un archivo junto a crear una pregunta', () => {
    expect(banco()).toMatch(/<a class="boton" href="\/banco\/importar"[^>]*>Importar archivo<\/a>/);
  });

  it('al volver de importar muestra cuántas quedaron como borrador', () => {
    const html = banco({ aviso: 'Se importaron 2 preguntas como borrador.' });

    expect(html).toMatch(/role="status">Se importaron 2 preguntas como borrador\.<\/p>/);
  });
});
