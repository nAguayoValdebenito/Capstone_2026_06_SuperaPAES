// TEC-07: la semilla de preguntas de ejemplo (npm run semilla-demo -w api) es solo de desarrollo. Carga una
// pregunta publicada por cada prueba, claramente marcada como ejemplo, sin material del DEMRE (RN-29), pasando
// por las reglas y los triggers de la base. Es idempotente, se niega con NODE_ENV=production y ningún
// script de Docker ni de despliegue la ejecuta.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ejecutarSemillas } from '../db/semillas.js';
import { ErrorSemillaDemo, MARCA_EJEMPLO, sembrarPreguntasDeEjemplo } from '../db/semilla-demo.js';
import {
  type BaseTemporal,
  crearBaseTemporal,
  exigirBaseEnCi,
  MINUTO,
  urlBase,
} from './base-temporal.js';

const RAIZ = path.join(import.meta.dirname, '../..');
const PRUEBAS = ['CL', 'M1', 'M2', 'HCS', 'CIE'];

describe('semilla de ejemplo: solo desarrollo', () => {
  it('se niega con NODE_ENV=production sin tocar la base', async () => {
    const sinBase = { query: () => Promise.reject(new Error('no debe consultar')) };
    await expect(sembrarPreguntasDeEjemplo(sinBase, 'production')).rejects.toThrow(
      ErrorSemillaDemo,
    );
    await expect(sembrarPreguntasDeEjemplo(sinBase, 'production')).rejects.toThrow(
      /NODE_ENV=production/,
    );
  });

  it('ningún script de Docker ni de despliegue la ejecuta', () => {
    const archivos = [
      'api/Dockerfile',
      'docker-compose.yml',
      'consola/Dockerfile',
      '../.github/workflows/ci.yml',
      ...readdirSync(path.join(RAIZ, '../.github/workflows')).map(
        (f) => `../.github/workflows/${f}`,
      ),
      'render.yaml',
    ];
    for (const archivo of new Set(archivos)) {
      const ruta = path.join(RAIZ, archivo);
      if (!existsSync(ruta)) continue;
      expect(readFileSync(ruta, 'utf8'), archivo).not.toMatch(/semilla-demo|semilla_demo/);
    }
    const { scripts } = JSON.parse(readFileSync(path.join(RAIZ, 'api/package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    for (const [nombre, comando] of Object.entries(scripts)) {
      if (nombre !== 'semilla-demo') expect(comando, nombre).not.toMatch(/semilla-demo/);
    }
    expect(scripts['migrar:produccion']).toBe(
      'node dist/db/scripts/migrar.js && node dist/db/scripts/semillas.js',
    );
  });
});

exigirBaseEnCi();
describe.skipIf(!urlBase)('semilla de ejemplo con PostgreSQL', () => {
  let base: BaseTemporal;

  beforeAll(async () => {
    base = await crearBaseTemporal('semilla_demo');
    await ejecutarSemillas(base.bd, path.join(import.meta.dirname, '../db/semillas'));
  }, MINUTO);

  afterAll(async () => {
    await base.cerrar();
  });

  it(
    'se niega si falta el temario',
    async () => {
      const vacia = await crearBaseTemporal('semilla_demo_vacia');
      try {
        await expect(sembrarPreguntasDeEjemplo(vacia.bd, 'development')).rejects.toThrow(/temario/);
      } finally {
        await vacia.cerrar();
      }
    },
    MINUTO,
  );

  it(
    'publica una pregunta de ejemplo por prueba, con las reglas de la base activas',
    async () => {
      const resultado = await sembrarPreguntasDeEjemplo(base.bd, 'development');
      expect(resultado.creadas.sort()).toEqual([...PRUEBAS].sort());

      const { rows } = await base.bd.query<{
        prueba: string;
        enunciado: string;
        estado: string;
        dificultad: string | null;
        habilidad: number;
        contenido: number;
        alternativas: number;
        correctas: number;
        texto: string | null;
      }>(
        `SELECT pr.codigo AS prueba, p.enunciado, e.codigo AS estado, d.codigo AS dificultad,
              p.habilidad_id AS habilidad, p.contenido_id AS contenido, t.contenido AS texto,
              (SELECT count(*)::int FROM contenido.alternativa a WHERE a.pregunta_id = p.id) AS alternativas,
              (SELECT count(*)::int FROM contenido.alternativa a WHERE a.pregunta_id = p.id AND a.es_correcta) AS correctas
         FROM contenido.pregunta p
         JOIN contenido.prueba pr ON pr.id = p.prueba_id
         JOIN contenido.estado_pregunta e ON e.id = p.estado_pregunta_id
         LEFT JOIN contenido.dificultad d ON d.id = p.dificultad_asignada_id
         LEFT JOIN contenido.texto_estimulo t ON t.id = p.texto_estimulo_id
        ORDER BY pr.codigo`,
      );

      expect(rows.map((f) => f.prueba).sort()).toEqual([...PRUEBAS].sort());
      for (const fila of rows) {
        expect(fila.estado, fila.prueba).toBe('publicada');
        expect(fila.dificultad, fila.prueba).not.toBeNull();
        expect(fila.alternativas, fila.prueba).toBe(4);
        expect(fila.correctas, fila.prueba).toBe(1);
        // [EJEMPLO] aparece visible al principio del enunciado.
        expect(fila.enunciado.startsWith(MARCA_EJEMPLO), fila.prueba).toBe(true);
      }
      // Competencia Lectora va ligada a su texto, también marcado como ejemplo.
      const lectora = rows.find((f) => f.prueba === 'CL');
      expect(lectora?.texto).toContain(MARCA_EJEMPLO);
      expect(rows.filter((f) => f.texto !== null)).toHaveLength(1);
    },
    MINUTO,
  );

  it('las preguntas quedan disponibles para practicar (v_preguntas_publicadas)', async () => {
    const { rows } = await base.bd.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM contenido.v_preguntas_publicadas',
    );
    expect(rows[0]?.n).toBe(PRUEBAS.length);
  });

  it(
    'es idempotente: volver a ejecutarla no duplica nada',
    async () => {
      const segunda = await sembrarPreguntasDeEjemplo(base.bd, 'development');
      expect(segunda.creadas).toEqual([]);
      const { rows } = await base.bd.query<{
        preguntas: number;
        textos: number;
        alternativas: number;
      }>(
        `SELECT (SELECT count(*)::int FROM contenido.pregunta) AS preguntas,
              (SELECT count(*)::int FROM contenido.texto_estimulo) AS textos,
              (SELECT count(*)::int FROM contenido.alternativa) AS alternativas`,
      );
      expect(rows[0]).toEqual({ preguntas: 5, textos: 1, alternativas: 20 });
    },
    MINUTO,
  );

  it(
    'completa solo lo que falta si se borró una pregunta de ejemplo',
    async () => {
      await base.bd.query(
        `UPDATE contenido.pregunta SET estado_pregunta_id = e.id
         FROM contenido.estado_pregunta e, contenido.prueba pr
        WHERE e.codigo = 'retirada' AND pr.id = pregunta.prueba_id AND pr.codigo = 'M2'`,
      );
      const tercera = await sembrarPreguntasDeEjemplo(base.bd, 'development');
      // La retirada sigue existiendo (no se borra): no se vuelve a crear.
      expect(tercera.creadas).toEqual([]);
    },
    MINUTO,
  );
});
