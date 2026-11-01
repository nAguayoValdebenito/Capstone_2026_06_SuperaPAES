// Cada fila del informe con todos sus motivos (HU-13.1, CU-16 paso 4), y los casos del archivo que no
// deben bloquear la importación: el archivo de textos vacío y la correcta escrita de otras formas.
// Sin PostgreSQL, como importacion-preguntas.test.ts.
import { describe, expect, it } from 'vitest';
import { escenarioEdicion } from './edicion-de-prueba.js';
import { archivos, csvPreguntas, csvTextos, revisar } from './importacion-de-prueba.js';

describe('cada fila con todos sus motivos y casos del archivo', () => {
  /** Los motivos de cada fila con error, en orden. */
  const motivosDe = (cuerpo: unknown) =>
    (cuerpo as { data: { errores: { motivos: string[] }[] } }).data.errores.map(
      (error) => error.motivos,
    );

  it('aunque falle la habilidad, revisa también las alternativas y el texto de lectura', async () => {
    const { app } = escenarioEdicion();
    const archivo = csvPreguntas([
      {
        prueba: 'Competencia Lectora',
        eje: 'Localizar',
        contenido: 'Información',
        habilidad: 'Inventar',
        alternativa_d: '',
      },
    ]);

    const { body } = await revisar(app, archivos(archivo));

    expect(motivosDe(body)).toEqual([
      [
        'La habilidad «Inventar» no existe en el temario de Competencia Lectora.',
        'Competencia Lectora lleva 4 alternativas.',
        'En Competencia Lectora cada pregunta va con su texto de lectura.',
      ],
    ]);
  });

  it('un texto sin contenido y con un título demasiado largo informa los dos motivos', async () => {
    const { app } = escenarioEdicion();
    const textos = csvTextos([
      { codigo: 'T1', tipo_texto: 'Literario', titulo: 'x'.repeat(201), contenido: '' },
    ]);

    const { body } = await revisar(app, archivos(csvPreguntas([{}]), textos));

    expect(motivosDe(body)).toEqual([
      ['El título puede tener hasta 200 caracteres.', 'Falta el contenido del texto.'],
    ]);
  });

  it('la correcta con un número no es una letra; «A y C» marca dos', async () => {
    const { app } = escenarioEdicion();
    const archivo = csvPreguntas([{ correcta: '2' }, { correcta: 'A y C' }, { correcta: ' b ' }]);

    const { body } = await revisar(app, archivos(archivo));

    expect(motivosDe(body)).toEqual([
      ['La correcta «2» no es una letra de la A a la E.'],
      ['Marca dos alternativas como correctas.'],
    ]);
    expect(body.data.porCrear).toBe(1);
  });

  it('el archivo de textos es opcional: con solo sus columnas no bloquea la importación', async () => {
    const { app } = escenarioEdicion();

    const respuesta = await revisar(app, archivos(csvPreguntas([{}]), csvTextos([])));

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({ porCrear: 1, conError: 0, textosPorCrear: 0 });
  });
});
