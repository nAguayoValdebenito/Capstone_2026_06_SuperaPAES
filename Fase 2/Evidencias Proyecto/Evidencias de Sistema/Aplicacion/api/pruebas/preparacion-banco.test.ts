// TEC-04: ejemplos propios. El banco entregado no forma parte del repositorio público.
import { mkdtemp, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ContenidoParaGenerar } from '../modulos/temario/index.js';
import { leerCsv } from '../modulos/preguntas/preguntas.csv.js';
import {
  huellaBanco,
  leerBanco,
  repararBanco,
  type OriginalBanco,
} from '../modulos/preguntas/preguntas.preparacion.lectura.js';
import { proponerClasificacionBanco } from '../modulos/preguntas/preguntas.preparacion.clasificacion.js';
import { ajustarAlternativasBanco } from '../modulos/preguntas/preguntas.preparacion.revision.js';
import { prepararBanco } from '../modulos/preguntas/index.js';
import { cargarBanco } from '../trabajos/preparacion-banco.archivos.js';
import { escenarioEdicion } from './edicion-de-prueba.js';
import { archivos, importar, revisar } from './importacion-de-prueba.js';

const ORIGINAL: OriginalBanco = {
  pregunta: 'Resuelve $2x = 8$; explica "tu resultado".\nUsa ecuaciones.',
  alternativas: ['1', '2', '3', '4', '5'],
  respuesta_correcta: 'D',
  explicacion_respuesta: 'Al dividir ambos lados por dos se obtiene cuatro.',
  habilidad_requerida: 'Resolver una ecuación lineal de primer grado.',
};
const CONTENIDO: ContenidoParaGenerar = {
  contenidoId: 110,
  nombre: 'Ecuaciones',
  descriptores: 'Ecuaciones lineales de primer grado.',
  activo: true,
  curso: null,
  eje: { id: 11, nombre: 'Álgebra' },
  prueba: {
    id: 2,
    codigo: 'M1',
    nombre: 'Competencia Matemática 1',
    opcionesMax: 4,
    requiereTexto: false,
    habilidades: [{ id: 30, codigo: 'RP', nombre: 'Resolver problemas', criterios: null }],
    tiposPregunta: ['seleccion_multiple'],
  },
};
function registro(original = ORIGINAL) {
  const r = leerBanco(JSON.stringify([original]), 'matematica/ejemplo.json')[0];
  if (!r) throw new Error('Falta el ejemplo.');
  return r;
}
const decision = (id: string) => ({
  id,
  estado: 'preparar' as const,
  motivo: 'Ecuación lineal revisada; se retira el distractor cinco.',
  contenidoId: 110,
  habilidad: 'RP',
  eliminarAlternativa: 'E' as const,
});

describe('reparación y clasificación del banco (TEC-04)', () => {
  it('repara únicamente un fragmento revisado, manteniendo todos los registros y su texto', () => {
    const correcto = JSON.stringify([{ ...ORIGINAL, pregunta: 'Dijo "hola".' }, ORIGINAL]);
    const danado = correcto.replace('\\"hola\\"', '"hola"');
    const cambio = {
      archivo: 'ejemplo.json',
      sha256: huellaBanco(danado),
      antes: '"hola"',
      despues: '\\"hola\\"',
      motivo: 'Escapar comillas.',
    };
    expect(() => leerBanco(danado, 'ejemplo.json')).toThrow();
    const reparado = repararBanco(danado, [cambio]);
    expect(reparado).toBe(correcto);
    expect(leerBanco(reparado, 'ejemplo.json')).toHaveLength(2);
    expect(() => repararBanco(danado + ' ', [cambio])).toThrow('cambió');
    expect(() => repararBanco(danado, [{ ...cambio, antes: 'inexistente' }])).toThrow('único');
  });

  it('detecta claves duplicadas incluso si tienen valores iguales; las excluye de la exportación', () => {
    const texto = JSON.stringify([ORIGINAL]).replace(
      '"respuesta_correcta":"D"',
      '"respuesta_correcta":"A","respuesta_correcta":"D"',
    );
    const registros = leerBanco(texto, 'ejemplo.json');
    const r = registros[0];
    expect(r?.clavesDuplicadas).toEqual(['respuesta_correcta']);
    const resultado = prepararBanco(registros, [CONTENIDO], [decision(r?.id ?? '')]);
    expect(resultado.resumen).toMatchObject({ preparadas: 0, pendientes: 1 });
    expect(resultado.revision[0]?.motivos.join(' ')).toContain('Claves duplicadas');
  });

  it('no confunde comillas o llaves en un enunciado con claves u objetos JSON', () => {
    const r = registro({ ...ORIGINAL, pregunta: 'Texto { } "respuesta_correcta": "A". Texto { }' });
    expect(r.clavesDuplicadas).toEqual([]);
  });

  it('propone solo contenidos activos, conserva evidencia y no aprueba por puntaje', () => {
    const candidatos = proponerClasificacionBanco(ORIGINAL, [
      { ...CONTENIDO, activo: false },
      CONTENIDO,
    ]);
    expect(candidatos).toHaveLength(1);
    expect(candidatos[0]).toMatchObject({ contenidoId: 110, prueba: 'M1' });
    expect(candidatos[0]?.coincidencias).toContain('ecuacion');
    expect(prepararBanco([registro()], [CONTENIDO], []).resumen.preparadas).toBe(0);
    expect(
      proponerClasificacionBanco({ ...ORIGINAL, pregunta: 'ZZZZ', habilidad_requerida: '' }, [
        CONTENIDO,
      ]),
    ).toEqual([]);
  });

  it.each(['A', 'B', 'C', 'D'])('conserva la correcta E al retirar el distractor %s', (letra) => {
    const original = { ...ORIGINAL, respuesta_correcta: 'E' };
    const ajustado = ajustarAlternativasBanco(original, letra);
    expect(ajustado.alternativas).toHaveLength(4);
    expect(ajustado.respuesta_correcta).toBe('D');
    expect(ajustado.alternativas[3]).toBe('5');
    expect(original.alternativas).toHaveLength(5);
  });

  it('no retira la correcta ni deja explicaciones con letras desactualizadas', () => {
    expect(() => ajustarAlternativasBanco(ORIGINAL, 'D')).toThrow('distractor');
    expect(() =>
      ajustarAlternativasBanco(
        { ...ORIGINAL, explicacion_respuesta: 'La opción D es cuatro.' },
        'A',
      ),
    ).toThrow('letras');
  });

  it('pone en revisión alternativas repetidas, correctas inexistentes y enunciados duplicados', () => {
    for (const original of [
      { ...ORIGINAL, alternativas: ['1', '1', '3', '4', '5'] },
      { ...ORIGINAL, alternativas: ['1/2', '0,5', '3', '4', '5'] },
      { ...ORIGINAL, respuesta_correcta: 'Z' },
      { ...ORIGINAL, alternativas: ['1', '2', '3'] },
    ]) {
      const r = registro(original);
      expect(prepararBanco([r], [CONTENIDO], [decision(r.id)]).resumen.preparadas).toBe(0);
    }
    const r1 = registro();
    const r2 = { ...r1, id: 'otra', archivo: 'otro.json' };
    expect(prepararBanco([r1, r2], [CONTENIDO], [decision(r1.id)]).resumen.preparadas).toBe(0);
  });

  it('no admite decisiones de otro banco, habilidades ajenas ni CL sin texto', () => {
    const r = registro();
    expect(() => prepararBanco([r], [CONTENIDO], [decision('desconocido')])).toThrow(
      'no corresponden',
    );
    expect(() => prepararBanco([r], [CONTENIDO], [decision(r.id), decision(r.id)])).toThrow(
      'duplicadas',
    );
    expect(
      prepararBanco([r], [CONTENIDO], [{ ...decision(r.id), habilidad: 'inventada' }]).resumen
        .preparadas,
    ).toBe(0);
    const cl = { ...CONTENIDO, prueba: { ...CONTENIDO.prueba, codigo: 'CL', requiereTexto: true } };
    expect(prepararBanco([r], [cl], [decision(r.id)]).revision[0]?.motivos.join(' ')).toContain(
      'texto de lectura',
    );
  });

  it('mantiene todas las columnas en la planilla con cuatro alternativas y no modifica originales', async () => {
    const carpeta = await mkdtemp(path.join(os.tmpdir(), 'supera-preparacion-'));
    try {
      const entrada = path.join(carpeta, 'originales');
      await mkdir(entrada);
      const original = JSON.stringify([{ ...ORIGINAL, alternativas: ['1', '2', '3', '4'] }]);
      await writeFile(path.join(entrada, 'ejemplo.json'), original);
      const banco = await cargarBanco(entrada, path.join(carpeta, 'salida'));
      expect(await readFile(path.join(entrada, 'ejemplo.json'), 'utf8')).toBe(original);
      expect(banco.inventario[0]).toMatchObject({ registros: 1, sha256: huellaBanco(original) });
      const resultado = prepararBanco(banco.registros, [CONTENIDO], []);
      const filas = leerCsv(resultado.planilla);
      if (!filas) throw new Error('CSV de revisión inválido.');
      expect(filas[1]).toHaveLength(filas[0]?.length ?? 0);
      expect(filas[1]?.[12]).toBe('');
      expect(filas[1]?.[13]).toBe('D');
      await expect(cargarBanco(entrada, path.join(carpeta, 'salida'))).rejects.toThrow('EEXIST');
    } finally {
      await rm(carpeta, { recursive: true, force: true });
    }
  });

  it('CP-10: el CSV preparado pasa la revisión existente y sigue exigiendo origen RN-29', async () => {
    const r = registro();
    const resultado = prepararBanco([r], [CONTENIDO], [decision(r.id)]);
    expect(resultado.resumen).toMatchObject({
      preparadas: 1,
      pendientes: 0,
      ajustesAlternativas: 1,
    });
    const { app, repositorio } = escenarioEdicion();
    const cuerpo = archivos(resultado.importacion);
    const respuesta = await revisar(app, cuerpo);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({ porCrear: 1, conError: 0 });
    expect((await importar(app, cuerpo)).status).toBe(400);
    expect(repositorio.insertar).not.toHaveBeenCalled();
    expect((await importar(app, { ...cuerpo, declaraOrigen: true })).status).toBe(201);
    expect(repositorio.insertar).toHaveBeenCalledWith(
      expect.objectContaining({
        enunciado: ORIGINAL.pregunta,
        alternativas: expect.arrayContaining([
          expect.objectContaining({ letra: 'D', texto: '4', esCorrecta: true }),
        ]),
      }),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
    expect(leerCsv(resultado.importacion)?.[1]?.[5]).toBe(ORIGINAL.pregunta);
  });
});
