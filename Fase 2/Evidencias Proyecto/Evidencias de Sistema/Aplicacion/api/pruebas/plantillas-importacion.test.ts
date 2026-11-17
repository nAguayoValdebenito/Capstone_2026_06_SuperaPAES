// HU-13.3, CU-16 y CP-10: descargar, completar y volver a subir las plantillas reales.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { leerCsv } from '../modulos/preguntas/preguntas.csv.js';
import type { ArchivoCsv } from '../modulos/preguntas/preguntas.validadores.js';
import { errorConFormato, tokenAdmin, tokenApp } from './ayudantes.js';
import { comoAdmin, escenarioEdicion } from './edicion-de-prueba.js';
import { csvPreguntas, csvTextos, importar, revisar } from './importacion-de-prueba.js';

const RUTA = '/api/v1/admin/preguntas/importaciones/plantillas';
type Plantillas = Record<'preguntas' | 'textos', ArchivoCsv>;

/** El administrador conserva la cabecera descargada y agrega sus filas. */
function completar(plantilla: ArchivoCsv, ejemplo: string): ArchivoCsv {
  return {
    ...plantilla,
    contenido: plantilla.contenido + ejemplo.slice(ejemplo.indexOf('\r\n') + 2),
  };
}

describe('plantillas CSV de importación (HU-13.3)', () => {
  it('CU-16 paso 1: entrega las columnas completas en UTF-8, sin material de terceros ni escrituras', async () => {
    const { app, repositorio, importaciones, auditoria } = escenarioEdicion();
    const respuesta = await request(app)
      .get(RUTA)
      .set(await comoAdmin());
    const plantillas = respuesta.body.data as Plantillas;

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ data: plantillas, error: null, meta: null });
    expect(plantillas.preguntas.nombre).toBe('plantilla_preguntas.csv');
    expect(plantillas.textos.nombre).toBe('plantilla_textos.csv');
    expect(leerCsv(plantillas.preguntas.contenido)).toEqual([
      [
        'prueba',
        'eje',
        'contenido',
        'habilidad',
        'tipo',
        'enunciado',
        'codigo_texto',
        'alternativa_a',
        'alternativa_b',
        'alternativa_c',
        'alternativa_d',
        'alternativa_e',
        'correcta',
        'explicacion',
        'dificultad_sugerida',
        'imagen',
      ],
    ]);
    expect(leerCsv(plantillas.textos.contenido)).toEqual([
      ['codigo', 'tipo_texto', 'titulo', 'contenido'],
    ]);
    for (const archivo of Object.values(plantillas)) {
      expect(archivo.contenido.startsWith('\uFEFF')).toBe(true);
      expect(archivo.contenido.endsWith('\r\n')).toBe(true);
    }
    expect(repositorio.insertar).not.toHaveBeenCalled();
    expect(importaciones.insertar).not.toHaveBeenCalled();
    expect(auditoria.registrarAuditoria).not.toHaveBeenCalled();
  });

  it('CP-10: la plantilla completada conserva LaTeX y comillas, valida filas y exige declarar el origen', async () => {
    const { app, repositorio, auditoria } = escenarioEdicion();
    const descarga = await request(app)
      .get(RUTA)
      .set(await comoAdmin());
    const plantillas = descarga.body.data as Plantillas;
    const enunciado = 'Si $2x + 3 = 11$, ¿cuánto vale $x$?\nExplica "el resultado"; usa álgebra.';
    const preguntas = completar(
      plantillas.preguntas,
      csvPreguntas([{ enunciado }, { correcta: '' }, { contenido: 'Fuera del temario' }]),
    );
    const archivos = { preguntas, textos: null };
    const revision = await revisar(app, archivos);
    expect(revision.status).toBe(200);
    expect(revision.body.data).toMatchObject({ porCrear: 1, conError: 2 });
    expect(revision.body.data.errores).toEqual([
      expect.objectContaining({ fila: 3, motivos: ['No indica la alternativa correcta.'] }),
      expect.objectContaining({ fila: 4, motivos: [expect.stringContaining('no existe')] }),
    ]);
    expect((await importar(app, archivos)).status).toBe(400);
    expect(repositorio.insertar).not.toHaveBeenCalled();
    const importacion = await importar(app, { ...archivos, declaraOrigen: true });
    expect(importacion.status).toBe(201);
    expect(repositorio.insertar).toHaveBeenCalledWith(
      expect.objectContaining({ enunciado, dificultadSugerida: 'media' }),
      '5',
      expect.anything(),
      expect.any(String),
    );
    expect(auditoria.registrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: '5', accion: 'importar_preguntas' }),
      expect.anything(),
    );
  });

  it('CP-10: las dos plantillas permiten enlazar una pregunta de Lectora con su texto', async () => {
    const { app, textos, repositorio } = escenarioEdicion();
    const descarga = await request(app)
      .get(RUTA)
      .set(await comoAdmin());
    const plantillas = descarga.body.data as Plantillas;
    const preguntas = completar(
      plantillas.preguntas,
      csvPreguntas([
        {
          prueba: 'CL',
          eje: 'Localizar',
          contenido: 'Información',
          habilidad: 'Interpretar',
          codigo_texto: 'T1',
        },
      ]),
    );
    const archivoTextos = completar(
      plantillas.textos,
      csvTextos([
        {
          codigo: 'T1',
          tipo_texto: 'Literario',
          titulo: 'El faro',
          contenido: 'El faro iluminó la costa.',
        },
      ]),
    );
    const respuesta = await importar(app, {
      preguntas,
      textos: archivoTextos,
      declaraOrigen: true,
    });
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toMatchObject({ porCrear: 1, conError: 0, textosPorCrear: 1 });
    expect(textos.repositorio.insertar).toHaveBeenCalledTimes(1);
    expect(repositorio.insertar).toHaveBeenCalledWith(
      expect.objectContaining({ textoEstimuloId: 13, ordenEnTexto: 1 }),
      '5',
      expect.anything(),
      expect.any(String),
    );
  });

  it('solo el administrador puede descargar: rechaza al docente y al token de la app', async () => {
    const { app } = escenarioEdicion();
    for (const [token, estado, codigo] of [
      [await tokenAdmin('docente'), 403, 'SIN_PERMISO'],
      [await tokenApp(), 401, 'NO_AUTENTICADO'],
    ] as const) {
      const respuesta = await request(app).get(RUTA).auth(token, { type: 'bearer' });
      expect(respuesta.status).toBe(estado);
      expect(respuesta.body).toMatchObject(errorConFormato(codigo));
    }
    expect((await request(app).get(RUTA)).status).toBe(401);
  });
});
