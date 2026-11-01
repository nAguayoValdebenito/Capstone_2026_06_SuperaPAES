// Importar preguntas contra PostgreSQL real (HU-13.1, CU-16, CP-10, ver base-temporal.ts): con el
// temario de las semillas, las filas válidas quedan como borrador con origen importación, la dificultad
// solo sugerida, su historial y la importación con su informe y su auditoría; un archivo que no sigue
// la plantilla no deja nada guardado. Los casos de cada fila sin base están en
// importacion-preguntas.test.ts.
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearServicios, type Servicios } from '../app.js';
import { ejecutarEnTransaccion } from '../db/transaccion.js';
import { ejecutarSemillas } from '../db/semillas.js';
import type { PruebaTemario } from '../modulos/temario/index.js';
import { crearDependenciasDePrueba } from './ayudantes.js';
import { uno } from './banco-de-prueba.js';
import {
  type BaseTemporal,
  crearBaseTemporal,
  exigirBaseEnCi,
  MINUTO,
  urlBase,
} from './base-temporal.js';
import { archivos, csvPreguntas, csvTextos } from './importacion-de-prueba.js';

describe('importar preguntas sin base de datos', () => {
  exigirBaseEnCi();
});

/** La prueba, su primer eje con su primer contenido y su primera habilidad, por nombre (CU-16 paso 3). */
function ubicacion(pruebas: readonly PruebaTemario[], codigo: string) {
  const prueba = pruebas.find((candidata) => candidata.codigo === codigo);
  const eje = prueba?.ejes.find((candidato) => candidato.contenidos.length > 0);
  if (!prueba || !eje) throw new Error(`Falta el temario de ${codigo}.`);
  return {
    prueba: prueba.nombre,
    eje: eje.nombre,
    contenido: eje.contenidos[0]?.nombre ?? '',
    habilidad: prueba.habilidades[0]?.nombre ?? '',
    tipo: 'Selección múltiple',
  };
}

describe.skipIf(!urlBase)('importar preguntas con PostgreSQL (HU-13.1, CP-10)', () => {
  let base: BaseTemporal;
  let servicios: Servicios;
  let pruebas: PruebaTemario[] = [];
  let adminId = '';

  const contar = async (tabla: string) =>
    Number((await base.bd.query(`SELECT count(*) AS n FROM contenido.${tabla}`)).rows[0]?.n);

  beforeAll(async () => {
    base = await crearBaseTemporal('importacion');
    const { bd } = base;
    await ejecutarSemillas(bd, path.join(import.meta.dirname, '../db/semillas'));
    adminId = String(
      await uno(
        bd,
        `INSERT INTO contenido.usuario_interno (nombre, correo, hash_contrasena, rol_id, creado_en)
         SELECT 'Admin', 'admin@importacion.cl', 'x', id, now() FROM contenido.rol WHERE codigo = 'admin'
         RETURNING id`,
      ),
    );
    servicios = crearServicios(
      crearDependenciasDePrueba({
        bd,
        unidadDeTrabajo: { enTransaccion: (trabajo) => ejecutarEnTransaccion(bd, trabajo) },
      }),
    );
    pruebas = await servicios.temario.listarTemario();
  }, MINUTO);

  afterAll(() => base.cerrar(), MINUTO);

  it('CP-10: un archivo que no sigue la plantilla se rechaza completo y no deja nada guardado', async () => {
    const antes = [await contar('pregunta'), await contar('importacion')];
    const sinColumnas = archivos('prueba;eje\nM1;Álgebra\n');

    await expect(
      servicios.preguntas.importarPreguntas(adminId, { ...sinColumnas, declaraOrigen: true }),
    ).rejects.toThrow('no sigue la plantilla');

    expect([await contar('pregunta'), await contar('importacion')]).toEqual(antes);
  });

  it('CP-10: crea las válidas como borrador de la importación, con su informe, su historial y su auditoría', async () => {
    const m1 = ubicacion(pruebas, 'M1');
    const cl = { ...ubicacion(pruebas, 'CL'), codigo_texto: 'T1' };
    const preguntas = csvPreguntas(
      [
        { dificultad_sugerida: 'Difícil' },
        { ...cl, enunciado: 'Primera del texto' },
        null,
        { correcta: '', enunciado: 'Sin correcta' },
        { contenido: 'Contenido que no existe', enunciado: 'Fuera del temario' },
        { ...cl, enunciado: 'Segunda del texto' },
      ],
      { base: { ...csvBase(), ...m1 } },
    );
    const textos = csvTextos([
      { codigo: 'T1', tipo_texto: 'No literario', titulo: 'Las aves', contenido: 'Cada otoño…' },
    ]);

    const hecha = await servicios.preguntas.importarPreguntas(adminId, {
      ...archivos(preguntas, textos),
      declaraOrigen: true,
    });

    expect(hecha).toMatchObject({ filasLeidas: 6, porCrear: 3, omitidas: 1, conError: 2 });
    const { rows: creadas } = await base.bd.query(
      `SELECT p.enunciado, e.codigo AS estado, d.codigo AS sugerida, p.dificultad_asignada_id AS asignada,
              p.autor_id::text AS autor, p.orden_en_texto AS orden, t.titulo AS texto, t.creado_por::text AS "autorTexto"
         FROM contenido.pregunta p
         JOIN contenido.estado_pregunta e ON e.id = p.estado_pregunta_id
         LEFT JOIN contenido.dificultad d ON d.id = p.dificultad_sugerida_id
         LEFT JOIN contenido.texto_estimulo t ON t.id = p.texto_estimulo_id
        WHERE p.importacion_id = $1
        ORDER BY p.id`,
      [hecha.id],
    );
    expect(creadas).toEqual([
      expect.objectContaining({
        estado: 'borrador',
        sugerida: 'dificil',
        asignada: null,
        texto: null,
      }),
      expect.objectContaining({ enunciado: 'Primera del texto', orden: 1, texto: 'Las aves' }),
      expect.objectContaining({ enunciado: 'Segunda del texto', orden: 2, texto: 'Las aves' }),
    ]);
    for (const creada of creadas) expect(creada).toMatchObject({ autor: adminId });
    expect(creadas[1]).toMatchObject({ autorTexto: adminId });

    // El banco las muestra con origen importación (HU-11).
    const banco = await servicios.preguntas.listarBanco({
      origen: 'importacion',
      pagina: 1,
      porPagina: 20,
    });
    expect(banco.preguntas.map((p) => [p.origen, p.estado.codigo])).toEqual([
      ['importacion', 'borrador'],
      ['importacion', 'borrador'],
      ['importacion', 'borrador'],
    ]);

    const { rows: importacion } = await base.bd.query(
      `SELECT usuario_id::text AS usuario, nombre_archivo, filas_total, filas_creadas, filas_con_error,
              jsonb_array_length(errores) AS errores
         FROM contenido.importacion WHERE id = $1`,
      [hecha.id],
    );
    expect(importacion).toEqual([
      {
        usuario: adminId,
        nombre_archivo: 'preguntas.csv',
        filas_total: 6,
        filas_creadas: 3,
        filas_con_error: 2,
        errores: 2,
      },
    ]);

    const { rows: historial } = await base.bd.query(
      `SELECT DISTINCT h.desde_id, e.codigo AS hacia, h.usuario_id::text AS usuario
         FROM contenido.historial_estado_pregunta h
         JOIN contenido.estado_pregunta e ON e.id = h.hacia_id
         JOIN contenido.pregunta p ON p.id = h.pregunta_id
        WHERE p.importacion_id = $1`,
      [hecha.id],
    );
    expect(historial).toEqual([{ desde_id: null, hacia: 'borrador', usuario: adminId }]);

    const { rows: auditoria } = await base.bd.query(
      `SELECT a.usuario_id::text AS usuario, a.entidad, a.entidad_id AS id, a.despues
         FROM contenido.auditoria a
         JOIN contenido.accion_auditoria x ON x.id = a.accion_auditoria_id
        WHERE x.codigo = 'importar_preguntas'`,
    );
    expect(auditoria).toEqual([
      {
        usuario: adminId,
        entidad: 'importacion',
        id: hecha.id,
        despues: expect.objectContaining({
          archivo: 'preguntas.csv',
          archivoTextos: 'textos.csv',
          creadas: 3,
          conError: 2,
          declaracionOrigen: expect.stringContaining('no provienen de los facsímiles del DEMRE'),
        }),
      },
    ]);
  });
});

/** Las celdas de la pregunta base que no dependen del temario. */
function csvBase() {
  return {
    enunciado: 'Si $2x + 3 = 11$, ¿cuánto vale $x$?',
    alternativa_a: '2',
    alternativa_b: '4',
    alternativa_c: '6',
    alternativa_d: '8',
    correcta: 'B',
    explicacion: 'Se despeja: $x = 4$.',
  };
}
