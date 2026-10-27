// Banco de preguntas contra PostgreSQL real (ver base-temporal.ts): las consultas de preguntas y de
// temario, los filtros de HU-11 y CP-08, el origen deducido del lote o de la importación y la
// paginación. Las preguntas entran como borrador (la base lo exige) y cambian de estado con las
// transiciones permitidas, como en el uso real.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ejecutarEnTransaccion } from '../db/transaccion.js';
import { crearPreguntasServicio } from '../modulos/preguntas/index.js';
import type { FiltrosBanco } from '../modulos/preguntas/preguntas.validadores.js';
import { crearTemarioServicio } from '../modulos/temario/index.js';
import {
  type BaseTemporal,
  crearBaseTemporal,
  exigirBaseEnCi,
  MINUTO,
  urlBase,
} from './base-temporal.js';
import {
  cambiarEstado,
  crearPregunta,
  crearTemario,
  enviarARevision,
  type Ids,
  uno,
} from './banco-de-prueba.js';

describe('banco de preguntas sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('banco de preguntas con PostgreSQL (HU-11, CP-08)', () => {
  let base: BaseTemporal;
  let ids: Ids & { habilidadA2: number };
  let banco: ReturnType<typeof crearPreguntasServicio>;
  const ia: number[] = [];
  const importadas: number[] = [];

  const filtrar = (cambios: Partial<FiltrosBanco> = {}) =>
    banco.listarBanco({ pagina: 1, porPagina: 20, ...cambios });

  beforeAll(async () => {
    base = await crearBaseTemporal('banco');
    const { bd } = base;
    const temario = await crearTemario(bd);
    ids = temario;
    const usuario = await uno(
      bd,
      `INSERT INTO contenido.usuario_interno (nombre, correo, hash_contrasena, rol_id, creado_en)
       SELECT 'Admin', 'admin@banco.cl', 'x', id, now() FROM contenido.rol WHERE codigo = 'admin' RETURNING id`,
    );
    const lote = await uno(
      bd,
      `INSERT INTO contenido.lote_generacion (contenido_id, solicitante_id, tipo_pregunta_id, cantidad,
         modelo, version_instrucciones, estado_lote_id, creado_en)
       SELECT $1, $2, t.id, 2, 'simulado', '1', e.id, now()
         FROM contenido.tipo_pregunta t, contenido.estado_lote e
        WHERE t.codigo = 'seleccion_multiple' AND e.codigo = 'completado' RETURNING id`,
      [temario.contenidoA2, usuario],
    );
    const importacion = await uno(
      bd,
      `INSERT INTO contenido.importacion (usuario_id, nombre_archivo, filas_total, filas_creadas,
         filas_con_error, creado_en)
       VALUES ($1, 'banco.xlsx', 3, 3, 0, now()) RETURNING id`,
      [usuario],
    );
    const enA = { pruebaId: temario.pruebaA, habilidadId: temario.habilidadA };
    // 22 manuales en la prueba A (repartidas en sus tres contenidos), 2 de IA y 3 importadas.
    const contenidosA = [temario.contenidoA1a, temario.contenidoA1b, temario.contenidoA2];
    for (let i = 0; i < 22; i++) {
      const contenidoId = contenidosA[i % 3] ?? temario.contenidoA2;
      await crearPregunta(bd, { ...enA, contenidoId, enunciado: `Manual ${String(i + 1)}` });
    }
    // Las 2 de IA son de la habilidad Modelar; el resto de la prueba A, de Resolver.
    for (let i = 0; i < 2; i++) {
      const datos = {
        ...enA,
        habilidadId: temario.habilidadA2,
        contenidoId: temario.contenidoA2,
        loteId: lote,
      };
      ia.push(await crearPregunta(bd, { ...datos, enunciado: `IA ${String(i + 1)}` }));
    }
    for (let i = 0; i < 3; i++) {
      const datos = { pruebaId: temario.pruebaB, contenidoId: temario.contenidoB };
      importadas.push(
        await crearPregunta(bd, {
          ...datos,
          habilidadId: temario.habilidadB,
          importacionId: importacion,
          enunciado: `Importada ${String(i + 1)}`,
        }),
      );
    }
    // Una de IA en revisión con dificultad asignada media; una importada en revisión y luego observada.
    const [primeraIa] = ia;
    const [primeraImportada] = importadas;
    if (primeraIa === undefined || primeraImportada === undefined) throw new Error('Sin preguntas');
    await enviarARevision(bd, primeraIa);
    await bd.query(
      `UPDATE contenido.pregunta SET dificultad_asignada_id = (SELECT id FROM contenido.dificultad WHERE codigo = 'media'),
              posible_ambigua = true
        WHERE id = $1`,
      [primeraIa],
    );
    await enviarARevision(bd, primeraImportada);
    await cambiarEstado(bd, primeraImportada, 'observada');

    banco = crearPreguntasServicio({
      bd,
      unidadDeTrabajo: { enTransaccion: (trabajo) => ejecutarEnTransaccion(bd, trabajo) },
      temario: crearTemarioServicio({
        bd,
        unidadDeTrabajo: { enTransaccion: (trabajo) => ejecutarEnTransaccion(bd, trabajo) },
      }),
      // El banco solo lee: no registra auditoría.
      administracion: { registrarAuditoria: () => Promise.resolve() },
    });
  }, MINUTO);

  afterAll(() => base.cerrar(), MINUTO);

  it('sin filtros cuenta las 27 y entrega la primera página de 20, la más reciente primero', async () => {
    const { preguntas, paginacion } = await filtrar();

    expect(paginacion).toEqual({ pagina: 1, porPagina: 20, total: 27 });
    expect(preguntas).toHaveLength(20);
    const fechas = preguntas.map((p) => p.actualizadoEn);
    expect([...fechas].sort().reverse()).toEqual(fechas);
  });

  it('la página 2 trae las 7 restantes, sin repetir ninguna (esc. 3, CP-08 paso 4)', async () => {
    const primera = await filtrar();
    const segunda = await filtrar({ pagina: 2 });

    expect(segunda.preguntas).toHaveLength(7);
    expect(segunda.paginacion.total).toBe(27);
    const todas = [...primera.preguntas, ...segunda.preguntas].map((p) => p.id);
    expect(new Set(todas).size).toBe(27);
  });

  it('una página después de la última viene vacía pero con el total', async () => {
    expect(await filtrar({ pagina: 5 })).toEqual({
      preguntas: [],
      paginacion: { pagina: 5, porPagina: 20, total: 27 },
    });
  });

  it('filtra por prueba, por eje (todos sus contenidos) y por contenido (CP-08 paso 2)', async () => {
    expect((await filtrar({ prueba: ids.pruebaB })).paginacion.total).toBe(3);
    // Eje A1: Enteros y Potencias, 8 + 7 de las 22 manuales.
    expect((await filtrar({ eje: ids.ejeA1 })).paginacion.total).toBe(15);
    // Ecuaciones: 7 manuales y las 2 de IA.
    const ecuaciones = await filtrar({ prueba: ids.pruebaA, contenido: ids.contenidoA2 });
    expect(ecuaciones.paginacion.total).toBe(9);
    expect(ecuaciones.preguntas.every((p) => p.contenido.nombre === 'Ecuaciones')).toBe(true);
    expect(ecuaciones.preguntas[0]).toMatchObject({
      prueba: { id: ids.pruebaA, codigo: 'TA', nombre: 'Prueba TA' },
      eje: { id: ids.ejeA2, nombre: 'Álgebra' },
    });
  });

  it('deduce el origen del lote o de la importación y filtra por él (CP-08 paso 3)', async () => {
    const porOrigen = async (origen: 'manual' | 'importacion' | 'ia') =>
      (await filtrar({ origen, porPagina: 100 })).preguntas;

    expect((await porOrigen('manual')).length).toBe(22);
    expect((await porOrigen('ia')).map((p) => Number(p.id)).sort()).toEqual([...ia].sort());
    expect((await porOrigen('importacion')).map((p) => Number(p.id)).sort()).toEqual(
      [...importadas].sort(),
    );
    expect((await porOrigen('ia')).every((p) => p.origen === 'ia')).toBe(true);
  });

  it('muestra el estado de cada pregunta y filtra por estado (esc. 2, CP-08 paso 3)', async () => {
    const enRevision = await filtrar({ estado: 'en_revision' });
    const observadas = await filtrar({ estado: 'observada' });
    const borradores = await filtrar({ estado: 'borrador' });

    expect(enRevision.preguntas.map((p) => p.estado)).toEqual([
      { codigo: 'en_revision', nombre: 'En revisión' },
    ]);
    expect(observadas.preguntas.map((p) => p.origen)).toEqual(['importacion']);
    expect(borradores.paginacion.total).toBe(25);
  });

  it('filtra por la dificultad asignada por los docentes (RF-G01)', async () => {
    const medias = await filtrar({ dificultad: 'media' });

    expect(medias.preguntas).toHaveLength(1);
    expect(medias.preguntas[0]).toMatchObject({
      origen: 'ia',
      dificultadAsignada: { codigo: 'media', nombre: 'Media' },
    });
  });

  it('filtra por habilidad (filtro de C02)', async () => {
    const modelar = await filtrar({ prueba: ids.pruebaA, habilidad: ids.habilidadA2 });

    expect(modelar.paginacion.total).toBe(2);
    expect(modelar.preguntas.every((p) => p.origen === 'ia')).toBe(true);
  });

  it('marca la pregunta posiblemente confusa (C02)', async () => {
    const { preguntas } = await filtrar({ porPagina: 100 });

    expect(preguntas.filter((p) => p.posibleAmbigua).map((p) => p.dificultadAsignada)).toEqual([
      { codigo: 'media', nombre: 'Media' },
    ]);
  });

  it('combina filtros: prueba A, origen IA y estado borrador', async () => {
    const { preguntas } = await filtrar({ prueba: ids.pruebaA, origen: 'ia', estado: 'borrador' });

    expect(preguntas.map((p) => p.resumen)).toEqual(['IA 2']);
  });

  it('las opciones de los filtros traen el temario real y las listas del modelo', async () => {
    const filtros = await banco.filtrosDelBanco();

    const pruebaA = filtros.pruebas.find((p) => p.id === ids.pruebaA);
    expect(pruebaA?.ejes.map((e) => [e.nombre, e.contenidos.map((c) => c.nombre)])).toEqual([
      ['Números', ['Enteros', 'Potencias']],
      ['Álgebra', ['Ecuaciones']],
    ]);
    expect(pruebaA?.habilidades.map((h) => h.nombre)).toEqual(['Modelar', 'Resolver']);
    expect(filtros.estados.map((e) => e.codigo)).toEqual([
      'borrador',
      'en_revision',
      'observada',
      'en_desempate',
      'aprobada',
      'rechazada',
      'publicada',
      'retirada',
    ]);
    expect(filtros.dificultades.map((d) => d.codigo)).toEqual(['facil', 'media', 'dificil']);
  });
});
