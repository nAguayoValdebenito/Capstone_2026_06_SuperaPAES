// TEC-08 y CP-59 (DAS 4.5.5, «Reintegrar lo ocurrido después del momento de recuperación»): desde el
// origen (la rama _old) se copian a la base recuperada, en una sola transacción, las cuentas nuevas con su
// consentimiento, las invitaciones, las evaluaciones sin tiempo con sus respuestas (cerradas con
// cerrar_evaluacion), los movimientos de bono y los avisos de las tiendas. Quedan fuera, y se listan, las
// evaluaciones con tiempo y los avisos cuya suscripción o pago no existe en el destino.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  aplicarReintegracion,
  type InformeReintegracion,
  simularReintegracion,
} from '../db/reintegracion.js';
import { contarDatos } from '../db/copia-de-respaldo.js';
import { exigirBaseEnCi, MINUTO, urlBase } from './base-temporal.js';
import {
  crearAviso,
  crearConsumos,
  crearDiagnosticoAbierto,
  crearEstudiante,
  crearInvitacionConBono,
  crearPractica,
  crearSuscripcion,
} from './datos-contingencia.js';
import { type Escenario, filas, prepararEscenario } from './reintegracion-de-prueba.js';

function pendientesPorTabla(informe: InformeReintegracion): Record<string, number> {
  return Object.fromEntries(informe.tablas.map((t) => [t.tabla, t.pendientes]));
}

exigirBaseEnCi();
describe.skipIf(!urlBase)('reintegración después de una recuperación (CP-59)', () => {
  let e: Escenario;
  let antiguaId = '';
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    e = await prepararEscenario('reintegrar', async (origen, preguntas) => {
      antiguaId = await crearEstudiante(origen.bd, 'antigua@ejemplo.cl');
      await crearPractica(origen.bd, {
        estudianteId: antiguaId,
        preguntas,
        letras: ['A', 'A', 'A', 'B', 'B'],
        cierre: 'entregada',
      });
      ids['suscripcionAntigua'] = await crearSuscripcion(origen.bd, antiguaId);
    });
    const { bd } = e.origen;
    // Paso 2 de CP-59: después del momento de recuperación, una cuenta nueva que responde una práctica.
    ids['nueva'] = await crearEstudiante(bd, 'nueva@ejemplo.cl');
    ids['invitacion'] = await crearInvitacionConBono(bd, antiguaId, ids['nueva']);
    ids['entregada'] = await crearPractica(bd, {
      estudianteId: ids['nueva'],
      preguntas: e.preguntas,
      letras: ['A', 'B', 'A', null, 'B'],
      cierre: 'entregada',
    });
    ids['abierta'] = await crearPractica(bd, {
      estudianteId: ids['nueva'],
      preguntas: e.preguntas,
      letras: ['B', 'A', null, null, null],
      cierre: null,
    });
    // La estudiante antigua gasta dos preguntas extra del bono que recibió por invitar.
    ids['conBono'] = await crearPractica(bd, {
      estudianteId: antiguaId,
      preguntas: e.preguntas,
      letras: ['A', 'B', null, null, null],
      cierre: 'abandonada',
      consumo: 'bono',
    });
    await crearConsumos(bd, antiguaId, ids['conBono']);
    // Fuera de la reintegración: una evaluación con tiempo y un aviso de una suscripción nueva.
    const otra = await crearEstudiante(bd, 'otra@ejemplo.cl');
    ids['diagnostico'] = await crearDiagnosticoAbierto(bd, otra);
    ids['avisoHuerfano'] = await crearAviso(bd, 'gp-huerfano', await crearSuscripcion(bd, otra));
    ids['avisoAntiguo'] = await crearAviso(bd, 'gp-antiguo', ids['suscripcionAntigua'] ?? null);
    ids['avisoSuelto'] = await crearAviso(bd, 'gp-suelto', null);
  }, 2 * MINUTO);

  afterAll(async () => {
    await e.cerrar();
  });

  const opciones = () => ({ origen: e.origen.bd, destino: e.destino.bd, desde: e.desde });

  it(
    'la simulación informa lo que copiaría y lo que queda fuera, sin escribir nada',
    async () => {
      const antes = await contarDatos(e.destino.bd);
      const informe = await simularReintegracion(opciones());
      expect(informe.bloqueos).toEqual([]);
      expect(pendientesPorTabla(informe)).toEqual({
        estudiante: 2,
        consentimiento: 2,
        invitacion: 1,
        evaluacion: 3,
        evaluacion_item: 15,
        movimiento_bono: 3,
        evento_pasarela: 2,
      });
      expect(informe.pendientes).toBe(28);
      expect(informe.excluidas).toEqual(
        expect.arrayContaining([
          {
            motivo: 'evaluacion_con_tiempo',
            ids: expect.objectContaining({ evaluacion: ids['diagnostico'] }),
          },
          {
            motivo: 'aviso_sin_suscripcion_o_pago',
            ids: expect.objectContaining({ aviso: ids['avisoHuerfano'] }),
          },
        ]),
      );
      expect(await contarDatos(e.destino.bd)).toEqual(antes);
    },
    MINUTO,
  );

  it(
    'aplica en una transacción, verifica los resultados y no deja nada pendiente ni duplicado',
    async () => {
      const resultado = await aplicarReintegracion(opciones());
      expect(resultado.evaluacionesVerificadas).toBe(2);
      expect(resultado.pendientesDespues).toBe(0);

      const origen = await contarDatos(e.origen.bd);
      const destino = await contarDatos(e.destino.bd);
      // Todo lo del origen, menos el diagnóstico con tiempo y la suscripción nueva (que revisa la tienda).
      expect(destino).toEqual({
        ...origen,
        evaluaciones: origen.evaluaciones - 1,
        suscripciones: origen.suscripciones - 1,
      });

      const { rows } = await e.destino.bd.query<{
        estado: string;
        correctas: number;
        omitidas: number;
      }>(
        `SELECT s.codigo AS estado, r.correctas, r.omitidas FROM app.evaluacion ev
         JOIN contenido.estado_evaluacion s ON s.id = ev.estado_evaluacion_id
         LEFT JOIN app.resultado_evaluacion r ON r.evaluacion_id = ev.id WHERE ev.id = ANY($1::bigint[]) ORDER BY ev.id`,
        [[ids['entregada'], ids['abierta']]],
      );
      expect(rows).toEqual([
        { estado: 'entregada', correctas: 2, omitidas: 0 },
        { estado: 'en_curso', correctas: null, omitidas: null },
      ]);

      // Las secuencias avanzaron: la API puede crear filas nuevas sin chocar con las copiadas.
      for (const tabla of [
        'estudiante',
        'invitacion',
        'evaluacion',
        'evaluacion_item',
        'movimiento_bono',
      ]) {
        const { rows: secuencia } = await e.destino.bd.query<{ ultimo: string; maximo: string }>(
          `SELECT pg_sequence_last_value(pg_get_serial_sequence($1, 'id')::regclass)::text AS ultimo,
                (SELECT max(id)::text FROM app.${tabla}) AS maximo`,
          [`app.${tabla}`],
        );
        expect(BigInt(secuencia[0]?.ultimo ?? 0)).toBeGreaterThanOrEqual(
          BigInt(secuencia[0]?.maximo ?? 0),
        );
      }
    },
    MINUTO,
  );

  it(
    'una segunda simulación informa cero pendientes y volver a aplicar no duplica',
    async () => {
      const antes = await filas(e.destino, 'evaluacion_item');
      expect((await simularReintegracion(opciones())).pendientes).toBe(0);
      const resultado = await aplicarReintegracion(opciones());
      expect(resultado.informe.pendientes).toBe(0);
      expect(await filas(e.destino, 'evaluacion_item')).toBe(antes);
    },
    MINUTO,
  );
});
