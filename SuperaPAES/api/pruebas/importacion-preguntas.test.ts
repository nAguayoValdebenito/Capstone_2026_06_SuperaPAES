// Revisar una importación por HTTP (HU-13.1, CU-16 pasos 3 a 5, RF-G05, CP-10), sin PostgreSQL: el servicio real
// sobre el temario y los repositorios en memoria de edicion-de-prueba.ts. Lo que guarda la base (origen,
// borrador, auditoría) está en importacion-preguntas-bd.test.ts y la confirmación en
// importacion-confirmar.test.ts.
import { describe, expect, it } from 'vitest';
import { errorConFormato } from './ayudantes.js';
import { escenarioEdicion, problemas } from './edicion-de-prueba.js';
import {
  ARCHIVO_CP10,
  archivos,
  csvPreguntas,
  csvTextos,
  revisar,
} from './importacion-de-prueba.js';

describe('revisar una importación (CU-16 pasos 3 a 5, C04)', () => {
  it('CP-10: informa las filas por crear, omitidas y con error, con su motivo, sin guardar nada', async () => {
    const { app, repositorio, importaciones } = escenarioEdicion();

    const respuesta = await revisar(app, archivos(ARCHIVO_CP10));

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({
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
          motivos: ['El contenido «Trigonometría» no existe en el eje Álgebra.'],
        },
      ],
    });
    expect(repositorio.insertar).not.toHaveBeenCalled();
    expect(importaciones.insertar).not.toHaveBeenCalled();
  });

  it('revisa RN-08 y el temario de cada fila, con todos sus motivos', async () => {
    const { app } = escenarioEdicion();
    const archivo = csvPreguntas([
      { alternativa_e: '10' },
      { correcta: 'A, C' },
      { correcta: 'E' },
      { alternativa_b: '' },
      { prueba: 'Física' },
      {
        eje: '',
        habilidad: 'Volar',
        tipo: 'Suficiencia de datos',
        dificultad_sugerida: 'Imposible',
      },
      { enunciado: '', explicacion: '', imagen: 'grafico_77.png' },
    ]);

    const { body } = await revisar(app, archivos(archivo));

    const errores = body.data.errores as { motivos: string[] }[];
    expect(errores.map((e) => e.motivos)).toEqual([
      ['Competencia Matemática 1 lleva 4 alternativas.'],
      ['Marca dos alternativas como correctas.'],
      ['La alternativa correcta (E) no tiene texto.'],
      ['Falta el texto de la alternativa B.'],
      ['La prueba «Física» no existe.'],
      [
        'Falta el eje.',
        'La habilidad «Volar» no existe en el temario de Competencia Matemática 1.',
        'Competencia Matemática 1 no admite el tipo «Suficiencia de datos».',
        'La dificultad «Imposible» no existe.',
      ],
      [
        'Falta el enunciado.',
        'Falta la explicación de la respuesta correcta.',
        'La imagen grafico_77.png no se puede importar todavía: deja vacía la columna imagen.',
      ],
    ]);
    expect(body.data.porCrear).toBe(0);
  });

  it('acepta los nombres sin tildes ni mayúsculas, los códigos y la coma como separador', async () => {
    const { app } = escenarioEdicion();
    const archivo = csvPreguntas(
      [
        {
          prueba: 'm1',
          eje: 'ALGEBRA',
          habilidad: 'resolver  problemas',
          tipo: 'seleccion_multiple',
        },
      ],
      { separador: ',' },
    );

    const { body } = await revisar(app, archivos(archivo));

    expect(body.data).toMatchObject({ porCrear: 1, conError: 0 });
  });

  it('Competencia Lectora: la pregunta va con un texto del archivo de textos (CU-16 3.a)', async () => {
    const { app } = escenarioEdicion();
    const cl = {
      prueba: 'Competencia Lectora',
      eje: 'Localizar',
      contenido: 'Información',
      habilidad: 'Interpretar',
    };
    const preguntas = csvPreguntas([
      { ...cl, codigo_texto: 'T1' },
      { ...cl, codigo_texto: 't1' },
      { ...cl },
      { ...cl, codigo_texto: 'T9' },
      { ...cl, codigo_texto: 'T2' },
    ]);
    const textos = csvTextos([
      {
        codigo: 'T1',
        tipo_texto: 'Literario',
        titulo: 'El faro',
        contenido: 'Había una vez un faro.',
      },
      { codigo: 'T2', tipo_texto: 'Novela', titulo: 'Sin tipo', contenido: 'Texto.' },
      { codigo: 'T1', tipo_texto: 'literario', titulo: 'Repetido', contenido: 'Otro.' },
    ]);

    const { body } = await revisar(app, archivos(preguntas, textos));

    expect(body.data).toMatchObject({ porCrear: 2, conError: 3, textosPorCrear: 1 });
    expect(body.data.errores).toEqual([
      expect.objectContaining({
        fila: 4,
        motivos: ['En Competencia Lectora cada pregunta va con su texto de lectura.'],
      }),
      expect.objectContaining({
        fila: 5,
        motivos: ['El texto «T9» no viene en el archivo de textos.'],
      }),
      expect.objectContaining({
        fila: 6,
        motivos: ['El texto «T2» tiene errores (archivo de textos, fila 3).'],
      }),
      {
        archivo: 'textos',
        fila: 3,
        resumen: 'Sin tipo',
        motivos: ['El tipo de texto «Novela» no existe.'],
      },
      {
        archivo: 'textos',
        fila: 4,
        resumen: 'Repetido',
        motivos: ['El código «T1» ya está en la fila 2.'],
      },
    ]);
  });

  it.each([
    ['le falta una columna', 'prueba;eje\nM1;Álgebra\n', 'faltan las columnas «contenido»'],
    [
      'trae una columna que no es de la plantilla',
      csvPreguntas([{}]).replace('imagen', 'foto'),
      'la columna «foto» no es de la plantilla.',
    ],
    ['no tiene filas', csvPreguntas([]), 'no tiene filas después de la de las columnas.'],
    [
      'tiene comillas sin cerrar',
      csvPreguntas([{ enunciado: 'x' }]).replace(';x;', ';"x;'),
      'comillas',
    ],
    ['no está en UTF-8', csvPreguntas([{ eje: '\uFFFDlgebra' }]), 'no está en UTF-8'],
  ])(
    'CP-10: el archivo que %s se rechaza completo con una explicación (2.a)',
    async (_caso, archivo, motivo) => {
      const { app } = escenarioEdicion();

      const respuesta = await revisar(app, archivos(archivo));

      expect(respuesta.status).toBe(400);
      expect(respuesta.body).toMatchObject(errorConFormato('VALIDACION'));
      expect(respuesta.body.error.mensaje).toContain(
        'El archivo «preguntas.csv» no sigue la plantilla: ',
      );
      expect(respuesta.body.error.mensaje).toContain(motivo);
    },
  );

  it('los encabezados se leen sin tildes, mayúsculas ni espacios («Alternativa A»)', async () => {
    const { app } = escenarioEdicion();
    const archivo = csvPreguntas([{}])
      .replace('alternativa_a', 'Alternativa A')
      .replace('explicacion', 'Explicación');

    const { status, body } = await revisar(app, archivos(archivo));

    expect(status).toBe(200);
    expect(body.data.porCrear).toBe(1);
  });

  it('solo recibe archivos CSV', async () => {
    const { app } = escenarioEdicion();
    const cuerpo = { preguntas: { nombre: 'preguntas.xlsx', contenido: 'x' } };

    const respuesta = await revisar(app, cuerpo);

    expect(respuesta.status).toBe(400);
    expect(problemas(respuesta)).toEqual([
      'preguntas.nombre: El archivo de preguntas debe ser CSV (UTF-8).',
    ]);
  });
});
