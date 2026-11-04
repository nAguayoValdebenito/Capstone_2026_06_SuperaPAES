// A-01, RNF-04 y HU-58, contra PostgreSQL real con el pool de la API (10 conexiones): cada transacción usa
// una sola conexión. Si dentro de una transacción algo pidiera otra al pool, con más respuestas simultáneas
// que conexiones todas quedarían esperando una que nadie suelta y fallarían a los 3 s con un error 500.
import { describe, expect, it } from 'vitest';
import { exigirBaseEnCi, MINUTO, urlBase } from './base-temporal.js';
import { prepararRespuestas } from './respuestas-de-prueba.js';

const SIMULTANEAS = 15;

exigirBaseEnCi();
describe.skipIf(!urlBase)('respuestas simultáneas sobre el pool (A-01)', () => {
  const r = prepararRespuestas('pool');
  const { base, entorno } = r;

  it(
    'más respuestas a la vez que conexiones del pool terminan todas bien',
    async () => {
      await base.publicar(5, { prueba: 'M1', dificultad: 'media' });
      const estudiantes = [];
      for (let i = 0; i < SIMULTANEAS; i++) {
        const { token, id } = await base.sesion(`pool${String(i)}@ejemplo.cl`);
        const pregunta = await r.practicaConPregunta(token);
        const alternativaId = await r.alternativa(pregunta.itemId, 'A');
        estudiantes.push({ id, token, pregunta, alternativaId });
      }

      const respuestas = await Promise.all(
        estudiantes.map(({ token, pregunta, alternativaId }) =>
          r.responderHttp(token, pregunta, { alternativaId }),
        ),
      );

      expect(respuestas.map((respuesta) => respuesta.status)).toEqual(
        Array.from({ length: SIMULTANEAS }, () => 200),
      );
      const { rows } = await entorno.bd.query<{ usadas: number }>(
        'SELECT usadas FROM app.cupo_diario WHERE estudiante_id = ANY($1::bigint[])',
        [estudiantes.map(({ id }) => id)],
      );
      expect(rows.map((fila) => fila.usadas)).toEqual(Array.from({ length: SIMULTANEAS }, () => 1));
    },
    MINUTO,
  );
});
