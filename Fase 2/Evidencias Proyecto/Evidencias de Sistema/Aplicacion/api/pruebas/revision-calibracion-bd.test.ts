// Bandeja de calibración del docente contra PostgreSQL real (D04, HU-26.1, RN-15; ver base-temporal.ts).
// Con estadísticas escritas a mano: solo aparecen las publicadas con 30 o más intentos cuyo acierto sale
// del rango de su dificultad (los extremos cuentan dentro) y del área del docente. Confirmar y descartar
// guardan la decisión con la versión y la dificultad del momento y la dejan en la auditoría; la pregunta
// sale de la bandeja de ese docente, no de la de otro del área, que ve la confirmación. El administrador
// ve la confirmada (HU-26.2) hasta que la retira; después vuelve a borrador y entra a una nueva revisión.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Servicios } from '../app.js';
import { type BaseTemporal, exigirBaseEnCi, MINUTO, urlBase } from './base-temporal.js';
import { crearPreguntaPublicada } from './preguntas-de-prueba.js';
import { crearCuenta, prepararBaseDeRevision } from './revision-bd.js';

describe('calibración sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('bandeja de calibración con PostgreSQL (HU-26.1)', () => {
  let base: BaseTemporal;
  let servicios: Servicios;
  const docente = new Map<string, string>();
  const pregunta = new Map<string, string>();

  /** Una pregunta publicada con esos intentos y aciertos en sus estadísticas. */
  async function publicada(
    clave: string,
    [prueba, dificultad]: [string, 'facil' | 'media' | 'dificil'],
    [intentos, aciertos]: [number, number],
  ) {
    const { preguntaId } = await crearPreguntaPublicada(base.bd, { prueba, dificultad });
    await base.bd.query(
      `INSERT INTO app.estadistica_pregunta (pregunta_id, intentos, aciertos, tiempo_promedio_seg, actualizado_en)
       VALUES ($1, $2, $3, 45, now())`,
      [preguntaId, intentos, aciertos],
    );
    pregunta.set(clave, String(preguntaId));
  }

  const ids = async (correo: string) =>
    (await servicios.revision.listarCalibracion(docente.get(correo) ?? '')).map(
      (p) => p.preguntaId,
    );
  const de = (clave: string) => pregunta.get(clave) ?? '';

  beforeAll(async () => {
    ({ base, servicios } = await prepararBaseDeRevision('calibracion'));
    for (const [correo, areas] of [
      ['h1@prueba.cl', ['Historia']],
      ['h2@prueba.cl', ['Historia']],
      ['m1@prueba.cl', ['Matemática']],
    ] as const)
      docente.set(correo, await crearCuenta(base.bd, [correo, 'docente'], [...areas]));
    await publicada('facilBaja', ['HCS', 'facil'], [30, 6]); // 20 %: fuera
    await publicada('pocosIntentos', ['HCS', 'facil'], [29, 0]); // menos de 30
    await publicada('mediaEnElBorde', ['HCS', 'media'], [40, 28]); // 70 %: dentro
    await publicada('dificilAlta', ['HCS', 'dificil'], [30, 13]); // 43,3 %: fuera
    await publicada('matematica', ['M1', 'facil'], [30, 0]); // otra área
  }, MINUTO);
  afterAll(async () => {
    await base.cerrar();
  }, MINUTO);

  it('muestra solo las de 30 o más intentos fuera de su rango y de su área', async () => {
    expect(await ids('h1@prueba.cl')).toEqual([de('facilBaja'), de('dificilAlta')]);
    expect(await ids('m1@prueba.cl')).toEqual([de('matematica')]);

    const [fila] = await servicios.revision.listarCalibracion(docente.get('h1@prueba.cl') ?? '');
    expect(fila).toMatchObject({
      intentos: 30,
      aciertos: 6,
      porcentajeAcierto: 20,
      tiempoPromedioSeg: 45,
      dificultad: { codigo: 'facil', aciertoEsperadoMin: 70, aciertoEsperadoMax: 100 },
      confirmaciones: 0,
      descartes: 0,
    });
  });

  it('confirmar guarda la decisión, la audita y la saca solo de la bandeja de quien decidió', async () => {
    const h1 = docente.get('h1@prueba.cl') ?? '';
    await servicios.revision.decidirCalibracion(h1, de('facilBaja'), {
      dificultadCorresponde: false,
    });

    const { rows } = await base.bd.query<Record<string, unknown>>(
      `SELECT c.dificultad_corresponde AS corresponde, c.intentos, c.aciertos, d.codigo AS dificultad,
              c.version_pregunta = p.version AS "versionActual"
         FROM contenido.calibracion_pregunta c JOIN contenido.dificultad d ON d.id = c.dificultad_id
         JOIN contenido.pregunta p ON p.id = c.pregunta_id
        WHERE c.pregunta_id = $1 AND c.docente_id = $2`,
      [de('facilBaja'), h1],
    );
    expect(rows).toEqual([
      { corresponde: false, intentos: 30, aciertos: 6, dificultad: 'facil', versionActual: true },
    ]);
    const auditoria = await base.bd.query(
      `SELECT 1 FROM contenido.auditoria a JOIN contenido.accion_auditoria x ON x.id = a.accion_auditoria_id
        WHERE x.codigo = 'confirmar_calibracion' AND a.entidad_id = $1 AND a.usuario_id = $2`,
      [de('facilBaja'), h1],
    );
    expect(auditoria.rows).toHaveLength(1);
    expect(await ids('h1@prueba.cl')).toEqual([de('dificilAlta')]);
    const otra = await servicios.revision.listarCalibracion(docente.get('h2@prueba.cl') ?? '');
    expect(otra.find((p) => p.preguntaId === de('facilBaja'))).toMatchObject({ confirmaciones: 1 });
  });

  it('decidir de nuevo la misma pregunta da 409', async () => {
    await expect(
      servicios.revision.decidirCalibracion(docente.get('h1@prueba.cl') ?? '', de('facilBaja'), {
        dificultadCorresponde: true,
      }),
    ).rejects.toMatchObject({ estadoHttp: 409 });
  });

  it('un docente de otra área no puede decidir: 404', async () => {
    await expect(
      servicios.revision.decidirCalibracion(docente.get('m1@prueba.cl') ?? '', de('dificilAlta'), {
        dificultadCorresponde: false,
      }),
    ).rejects.toMatchObject({ estadoHttp: 404 });
  });

  it('descartar queda guardado como «la dificultad corresponde» y auditado', async () => {
    const h2 = docente.get('h2@prueba.cl') ?? '';
    await servicios.revision.decidirCalibracion(h2, de('dificilAlta'), {
      dificultadCorresponde: true,
    });

    const { rows } = await base.bd.query(
      `SELECT 1 FROM contenido.calibracion_pregunta c
         JOIN contenido.auditoria a ON a.entidad_id = c.pregunta_id::text AND a.usuario_id = c.docente_id
         JOIN contenido.accion_auditoria x ON x.id = a.accion_auditoria_id AND x.codigo = 'descartar_calibracion'
        WHERE c.pregunta_id = $1 AND c.docente_id = $2 AND c.dificultad_corresponde`,
      [de('dificilAlta'), h2],
    );
    expect(rows).toHaveLength(1);
    expect(await ids('h2@prueba.cl')).toEqual([de('facilBaja')]);
  });

  it('HU-26.2: el administrador ve la confirmada; al retirarla deja de estarlo y vuelve a revisión con dos docentes', async () => {
    const admin = await crearCuenta(base.bd, ['admin@prueba.cl', 'admin']);
    const id = de('facilBaja');

    const confirmadas = await servicios.revision.listarConfirmadas();
    expect(confirmadas).toEqual([
      expect.objectContaining({
        preguntaId: id,
        confirmaciones: 1,
        intentos: 30,
        porcentajeAcierto: 20,
      }),
    ]);

    await servicios.preguntas.cambiarEtapa(admin, id, 'retirar');
    expect(await servicios.revision.listarConfirmadas()).toEqual([]);
    const publicada = await base.bd.query(
      'SELECT 1 FROM contenido.v_preguntas_publicadas WHERE id = $1',
      [id],
    );
    expect(publicada.rows).toHaveLength(0);

    await servicios.preguntas.cambiarEtapa(admin, id, 'borrador');
    const envio = await servicios.revision.enviarARevision(admin, id);
    expect(envio.revisores).toHaveLength(2);
    const { rows } = await base.bd.query<{ estado: string }>(
      `SELECT e.codigo AS estado FROM contenido.pregunta p
         JOIN contenido.estado_pregunta e ON e.id = p.estado_pregunta_id WHERE p.id = $1`,
      [id],
    );
    expect(rows[0]?.estado).toBe('en_revision');
  });
});
