// C09 (HU-64.1, RN-09, RN-25): las listas de opciones contra PostgreSQL real, con el modelo 11.0 y sus
// semillas. Comprueba la mezcla global y las sugerencias de cada área que deja la semilla 002.
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ejecutarSemillas } from '../db/semillas.js';
import { crearTemarioListasRepositorio } from '../modulos/temario/temario.listas.repositorio.js';
import {
  type BaseTemporal,
  crearBaseTemporal,
  exigirBaseEnCi,
  MINUTO,
  urlBase,
} from './base-temporal.js';

exigirBaseEnCi();
describe.skipIf(!urlBase)('listas de opciones con PostgreSQL (HU-64.1)', () => {
  let base: BaseTemporal;

  beforeAll(async () => {
    base = await crearBaseTemporal('listas_opciones');
    await ejecutarSemillas(base.bd, path.join(import.meta.dirname, '../db/semillas'));
  }, MINUTO);

  afterAll(async () => {
    await base.cerrar();
  });

  it('las dificultades traen la mezcla 30/45/25 con sus rangos, en orden', async () => {
    const dificultades = await crearTemarioListasRepositorio(base.bd).dificultades();
    expect(dificultades).toEqual([
      { codigo: 'facil', nombre: 'Fácil', minimo: 25, objetivo: 30, maximo: 35 },
      { codigo: 'media', nombre: 'Media', minimo: 40, objetivo: 45, maximo: 50 },
      { codigo: 'dificil', nombre: 'Difícil', minimo: 20, objetivo: 25, maximo: 30 },
    ]);
  });

  it('las nueve áreas traen sus pruebas y su electivo, e incluyen las desactivadas', async () => {
    await base.bd.query(
      "UPDATE contenido.area_carrera SET activo = false WHERE codigo = 'educacion'",
    );
    const areas = await crearTemarioListasRepositorio(base.bd).areasCarrera();
    expect(areas).toHaveLength(9);
    const area = (codigo: string) => areas.find((a) => a.codigo === codigo);
    expect(area('salud')).toMatchObject({ activa: true, electivo: 'Biología' });
    expect(area('salud')?.pruebas.map((p) => p.codigo)).toEqual(['CL', 'M1', 'CIE']);
    expect(area('ingenieria_tecnologia')?.electivo).toBe('Física');
    expect(area('ciencias_naturales')?.electivo).toBeNull();
    expect(area('educacion')?.activa).toBe(false);
  });

  it('los tipos de evaluación traen su modo de armado y su comportamiento', async () => {
    const tipos = await crearTemarioListasRepositorio(base.bd).tiposEvaluacion();
    // El modelo los inserta con un JOIN, así que el id no sigue el orden del VALUES.
    expect(tipos.map((t) => t.codigo).sort()).toEqual([
      'diagnostico',
      'ensayo',
      'mini_ensayo',
      'practica',
      'repaso',
    ]);
    expect(tipos.find((t) => t.codigo === 'ensayo')).toMatchObject({
      conTiempo: true,
      entregaPuntaje: true,
      consumeCupo: false,
      modoArmado: 'Sorteo según la estructura de la prueba',
    });
    expect(tipos.find((t) => t.codigo === 'practica')).toMatchObject({
      correccionInmediata: true,
      consumeCupo: true,
    });
  });

  it('motivos de aviso, tipos de pregunta y tipos de texto vienen con su código', async () => {
    const repositorio = crearTemarioListasRepositorio(base.bd);
    const codigos = async (lista: 'motivosAviso' | 'tiposPregunta' | 'tiposTexto') =>
      (await repositorio.opciones(lista)).map((o) => o.codigo);
    expect(await codigos('motivosAviso')).toEqual([
      'enunciado',
      'alternativas',
      'respuesta',
      'explicacion',
      'otro',
    ]);
    expect(await codigos('tiposPregunta')).toEqual(['seleccion_multiple', 'suficiencia_datos']);
    expect(await codigos('tiposTexto')).toEqual([
      'literario',
      'no_literario',
      'tabla',
      'grafico',
      'imagen',
    ]);
  });
});
