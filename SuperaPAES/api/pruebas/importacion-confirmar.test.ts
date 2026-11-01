// Confirmar una importación por HTTP (HU-13.1, CU-16 pasos 6 y 7, RN-29, CP-10), sin PostgreSQL: la
// declaración del origen, lo que se crea y la auditoría. La revisión de cada fila está en
// importacion-preguntas.test.ts y lo que guarda la base en importacion-preguntas-bd.test.ts.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { tokenAdmin } from './ayudantes.js';
import { escenarioEdicion, problemas } from './edicion-de-prueba.js';
import {
  ARCHIVO_CP10,
  archivos,
  csvPreguntas,
  csvTextos,
  importar,
  PREGUNTA_M1,
  RUTA_IMPORTACIONES,
} from './importacion-de-prueba.js';

describe('importar (CU-16 pasos 6 y 7, RN-29)', () => {
  it('CP-10: sin la declaración del origen no importa nada (6.a)', async () => {
    const { app, repositorio, importaciones } = escenarioEdicion();

    const sinDeclarar = await importar(app, archivos(ARCHIVO_CP10));
    const declaraFalso = await importar(app, { ...archivos(ARCHIVO_CP10), declaraOrigen: false });

    for (const respuesta of [sinDeclarar, declaraFalso]) {
      expect(respuesta.status).toBe(400);
      expect(problemas(respuesta)).toEqual([
        'declaraOrigen: Declara que las preguntas son propias o tienen permiso de uso para importarlas (RN-29).',
      ]);
    }
    expect(importaciones.insertar).not.toHaveBeenCalled();
    expect(repositorio.insertar).not.toHaveBeenCalled();
  });

  it('CP-10: crea las válidas en la importación, con la dificultad solo sugerida, y la audita con su declaración', async () => {
    const { app, repositorio, importaciones, auditoria } = escenarioEdicion();

    const respuesta = await importar(app, { ...archivos(ARCHIVO_CP10), declaraOrigen: true });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toMatchObject({ id: 1, porCrear: 2, omitidas: 1, conError: 2 });
    expect(importaciones.insertar).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: '5',
        nombreArchivo: 'preguntas.csv',
        filasTotal: 5,
        filasCreadas: 2,
        filasConError: 2,
        errores: respuesta.body.data.errores,
      }),
      expect.anything(),
    );
    expect(repositorio.insertar).toHaveBeenCalledTimes(2);
    expect(repositorio.insertar).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ pruebaId: 3, dificultadSugerida: 'media', textoEstimuloId: null }),
      '5',
      expect.anything(),
      '1',
    );
    // Las alternativas de las dos preguntas (7 y 8) van juntas en una sola consulta; «*» es la correcta.
    expect(repositorio.insertarAlternativas).toHaveBeenCalledTimes(1);
    const [alternativas] = repositorio.insertarAlternativas.mock.calls[0] ?? [];
    expect(alternativas?.map((a) => `${a.preguntaId}${a.letra}${a.esCorrecta ? '*' : ''}`)).toEqual(
      ['7A', '7B*', '7C', '7D', '8A', '8B', '8C', '8D', '8E*'],
    );
    expect(alternativas?.at(-1)).toEqual({
      preguntaId: '8',
      letra: 'E',
      texto: '10',
      esCorrecta: true,
      explicacion: null,
    });
    expect(auditoria.registrarAuditoria).toHaveBeenCalledWith(
      {
        usuarioId: '5',
        accion: 'importar_preguntas',
        entidad: 'importacion',
        entidadId: '1',
        antes: null,
        despues: {
          archivo: 'preguntas.csv',
          archivoTextos: null,
          filasLeidas: 5,
          creadas: 2,
          omitidas: 1,
          conError: 2,
          textosCreados: 0,
          declaracionOrigen:
            'Las preguntas son propias o tienen permiso de uso y no provienen de los facsímiles del DEMRE ni de otro material protegido.',
        },
      },
      expect.anything(),
    );
  });

  it('crea los textos usados y pone cada pregunta en su orden dentro del texto', async () => {
    const { app, repositorio, textos } = escenarioEdicion();
    const cl = {
      prueba: 'CL',
      eje: 'Localizar',
      contenido: 'Información',
      habilidad: 'Interpretar',
      codigo_texto: 'T1',
    };
    const preguntas = csvPreguntas([cl, { ...cl, enunciado: 'Segunda' }]);
    const archivoTextos = csvTextos([
      {
        codigo: 'T1',
        tipo_texto: 'Literario',
        titulo: 'El faro',
        contenido: 'Había una vez un faro.',
      },
      { codigo: 'T2', tipo_texto: 'Literario', titulo: 'Sin preguntas', contenido: 'No se usa.' },
    ]);

    const respuesta = await importar(app, {
      ...archivos(preguntas, archivoTextos),
      declaraOrigen: true,
    });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.textosPorCrear).toBe(1);
    expect(textos.repositorio.insertar).toHaveBeenCalledTimes(1);
    expect(textos.repositorio.insertar).toHaveBeenCalledWith(
      {
        tipoTexto: 'literario',
        titulo: 'El faro',
        contenido: 'Había una vez un faro.',
        imagenUrl: null,
      },
      '5',
      expect.anything(),
    );
    const ordenes = repositorio.insertar.mock.calls.map(([datos]) => [
      datos.textoEstimuloId,
      datos.ordenEnTexto,
    ]);
    expect(ordenes).toEqual([
      [13, 1],
      [13, 2],
    ]);
  });

  it('sin ninguna fila válida no crea la importación', async () => {
    const { app, importaciones } = escenarioEdicion();
    const archivo = csvPreguntas([{ ...PREGUNTA_M1, correcta: '' }]);

    const respuesta = await importar(app, { ...archivos(archivo), declaraOrigen: true });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.mensaje).toBe(
      'El archivo no tiene preguntas válidas para importar.',
    );
    expect(importaciones.insertar).not.toHaveBeenCalled();
  });

  it('solo la usa el administrador', async () => {
    const { app } = escenarioEdicion();

    const respuesta = await request(app)
      .post(`${RUTA_IMPORTACIONES}/revision`)
      .set('Authorization', `Bearer ${await tokenAdmin('docente', '9')}`)
      .send(archivos(ARCHIVO_CP10));

    expect(respuesta.status).toBe(403);
  });
});
