// TEC-08 (DAS 4.5.5): lo que impide reintegrar. La simulación lo detecta y la aplicación se niega antes
// de escribir, con los ids (sin datos personales) y qué debe hacer la persona: una evaluación abierta en
// el destino que el origen cerró después de DESDE (caso 4), un abono cuya invitación el destino no tiene
// verificada (caso 5) y escrituras en el destino después de la recuperación. Una fila que viola una regla
// de la base hace fallar toda la transacción.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aplicarReintegracion, simularReintegracion } from '../db/reintegracion.js';
import { contarDatos } from '../db/copia-de-respaldo.js';
import { exigirBaseEnCi, MINUTO, urlBase } from './base-temporal.js';
import {
  crearAbono,
  crearEstudiante,
  crearInvitacionConBono,
  crearPractica,
} from './datos-contingencia.js';
import { type Escenario, filas, prepararEscenario } from './reintegracion-de-prueba.js';

const opciones = (e: Escenario) => ({ origen: e.origen.bd, destino: e.destino.bd, desde: e.desde });

exigirBaseEnCi();
describe.skipIf(!urlBase)('caso 4: evaluación abierta en el destino que el origen cerró', () => {
  let e: Escenario;
  let estudianteId = '';
  let abiertaId = '';

  beforeAll(async () => {
    e = await prepararEscenario('bloqueo_abierta', async (origen, preguntas) => {
      estudianteId = await crearEstudiante(origen.bd, 'abierta@ejemplo.cl');
      abiertaId = await crearPractica(origen.bd, {
        estudianteId,
        preguntas,
        letras: ['A', null, null, null, null],
        cierre: null,
      });
    });
    // Después de DESDE: responde otra pregunta, la práctica se abandona y empieza otra.
    await e.origen.bd.query(
      `UPDATE app.evaluacion_item i SET alternativa_id = a.id, respondida_en = now(), tipo_consumo_id = c.id
         FROM contenido.alternativa a, contenido.tipo_consumo c
        WHERE i.evaluacion_id = $1 AND i.orden = 2 AND a.pregunta_id = i.pregunta_id AND a.letra = 'B' AND c.codigo = 'cupo'`,
      [abiertaId],
    );
    await e.origen.bd.query("SELECT app.cerrar_evaluacion($1, 'abandonada')", [abiertaId]);
    await crearPractica(e.origen.bd, {
      estudianteId,
      preguntas: e.preguntas,
      letras: ['A', 'A', null, null, null],
      cierre: 'entregada',
    });
  }, 2 * MINUTO);

  afterAll(async () => {
    await e.cerrar();
  });

  it(
    'la simulación lo detecta, lista la respuesta que no se reintegra y aplicar no escribe nada',
    async () => {
      const informe = await simularReintegracion(opciones(e));
      expect(informe.bloqueos).toEqual([
        {
          motivo: 'evaluacion_abierta_en_destino',
          ids: { estudiante: estudianteId, evaluacion: abiertaId },
          accion: expect.stringContaining(
            `SELECT app.cerrar_evaluacion(${abiertaId}, 'abandonada')`,
          ),
        },
      ]);
      expect(informe.excluidas).toContainEqual({
        motivo: 'respuestas_de_evaluacion_anterior',
        ids: { estudiante: estudianteId, evaluacion: abiertaId, respuestas: '1' },
      });
      const antes = await filas(e.destino, 'evaluacion');
      await expect(aplicarReintegracion(opciones(e))).rejects.toThrow(
        'evaluacion_abierta_en_destino',
      );
      expect(await filas(e.destino, 'evaluacion')).toBe(antes);
    },
    MINUTO,
  );

  it(
    'al seguir la acción indicada, la reintegración se completa',
    async () => {
      await e.destino.bd.query("SELECT app.cerrar_evaluacion($1, 'abandonada')", [abiertaId]);
      expect((await simularReintegracion(opciones(e))).bloqueos).toEqual([]);
      const resultado = await aplicarReintegracion(opciones(e));
      expect(resultado.evaluacionesVerificadas).toBe(1);
      expect(resultado.pendientesDespues).toBe(0);
    },
    MINUTO,
  );
});

describe.skipIf(!urlBase)(
  'caso 5: abono de una invitación que el destino no tiene verificada',
  () => {
    let e: Escenario;
    let invitacionId = '';

    beforeAll(async () => {
      e = await prepararEscenario('bloqueo_invitacion', async (origen) => {
        const invitante = await crearEstudiante(origen.bd, 'invitante@ejemplo.cl');
        const invitado = await crearEstudiante(origen.bd, 'invitado@ejemplo.cl');
        invitacionId = await crearInvitacionConBono(origen.bd, invitante, invitado, false);
      });
      // Después de DESDE el invitado verifica su correo y quien invitó recibe el abono.
      await e.origen.bd.query(
        'UPDATE app.invitacion SET verificado_en = now(), bono_entregado = true WHERE id = $1',
        [invitacionId],
      );
      const { rows } = await e.origen.bd.query<{ invitante: string }>(
        'SELECT invitante_id::text AS invitante FROM app.invitacion WHERE id = $1',
        [invitacionId],
      );
      await crearAbono(e.origen.bd, rows[0]?.invitante ?? '', invitacionId);
    }, 2 * MINUTO);

    afterAll(async () => {
      await e.cerrar();
    });

    it(
      'la simulación lo detecta y aplicar se niega antes de escribir',
      async () => {
        const informe = await simularReintegracion(opciones(e));
        expect(informe.bloqueos).toEqual([
          {
            motivo: 'invitacion_sin_verificar_en_destino',
            ids: { invitacion: invitacionId, movimiento: expect.any(String) as string },
            accion: expect.stringContaining('verificado_en'),
          },
        ]);
        await expect(aplicarReintegracion(opciones(e))).rejects.toThrow(
          'invitacion_sin_verificar_en_destino',
        );
        expect(await filas(e.destino, 'movimiento_bono')).toBe(0);
      },
      MINUTO,
    );
  },
);

describe.skipIf(!urlBase)('escrituras en el destino y filas inconsistentes', () => {
  let e: Escenario;

  beforeAll(async () => {
    e = await prepararEscenario('bloqueo_escritura', async () => {});
    await crearEstudiante(e.origen.bd, 'nueva@ejemplo.cl');
    await crearEstudiante(e.origen.bd, 'segunda@ejemplo.cl');
  }, 2 * MINUTO);

  afterAll(async () => {
    await e.cerrar();
  });

  it(
    'una fila que viola una restricción hace fallar toda la transacción',
    async () => {
      // Una cuenta anterior a DESDE en el destino (con un id que el origen no usa) y el mismo correo que
      // la segunda cuenta nueva: la base rechaza la copia de esa cuenta.
      await e.destino.bd.query(
        `INSERT INTO app.estudiante (id, nombre, correo, hash_contrasena, codigo_invitacion, creado_en)
       VALUES (900000, 'Repetida', 'SEGUNDA@ejemplo.cl', 'x', 'ZZZZZZ', $1::timestamptz - INTERVAL '1 hour')`,
        [e.desde],
      );
      const antes = await contarDatos(e.destino.bd);
      expect((await simularReintegracion(opciones(e))).bloqueos).toEqual([]);
      await expect(aplicarReintegracion(opciones(e))).rejects.toThrow(
        /app\.estudiante id \d+: .*ux_estudiante_correo/,
      );
      // Nada quedó copiado: ni la primera cuenta nueva ni ningún consentimiento.
      expect(await contarDatos(e.destino.bd)).toEqual(antes);
      expect(await filas(e.destino, 'consentimiento')).toBe(0);
    },
    MINUTO,
  );

  it(
    'se niega si la API escribió en el destino después de la recuperación',
    async () => {
      // La API sigue activa: crea una cuenta que toma el mismo id que una cuenta del origen.
      await crearEstudiante(e.destino.bd, 'escrita-despues@ejemplo.cl');
      const informe = await simularReintegracion(opciones(e));
      expect(informe.bloqueos.map((b) => b.motivo)).toEqual(
        expect.arrayContaining(['fila_distinta_en_destino', 'escritura_posterior_en_destino']),
      );
      const bloqueo = informe.bloqueos.find((b) => b.motivo === 'escritura_posterior_en_destino');
      expect(bloqueo?.accion).toContain('Render');
      await expect(aplicarReintegracion(opciones(e))).rejects.toThrow(
        'escritura_posterior_en_destino',
      );
    },
    MINUTO,
  );
});
