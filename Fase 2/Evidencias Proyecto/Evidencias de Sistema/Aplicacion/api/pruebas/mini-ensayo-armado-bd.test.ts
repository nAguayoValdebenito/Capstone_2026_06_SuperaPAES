import { describe, expect, it } from 'vitest';
import { prepararMini } from './mini-ensayo-base.js';
import { crearPreguntaPublicada, crearTextoDePrueba } from './preguntas-de-prueba.js';

describe.skipIf(!process.env['DATABASE_URL_PRUEBAS'])(
  'armado por estructura y curso (HU-40.1)',
  () => {
    const m = prepararMini('mini_armado');
    const { base, entorno } = m;

    it('Lectora entrega dos textos completos con sus preguntas ordenadas y cuotas por habilidad', async () => {
      const { rows: habilidades } = await entorno.bd.query<{ id: number }>(
        'SELECT id FROM contenido.habilidad WHERE prueba_id=$1 ORDER BY id',
        [base.lectoraId],
      );
      const textos = [];
      for (let t = 0; t < 2; t++) {
        const textoId = await crearTextoDePrueba(entorno.bd);
        textos.push(textoId);
        const dificultades =
          t === 0
            ? ([
                'facil',
                'facil',
                'media',
                'media',
                'media',
                'media',
                'dificil',
                'dificil',
                'dificil',
              ] as const)
            : ([
                'facil',
                'facil',
                'facil',
                'media',
                'media',
                'media',
                'media',
                'dificil',
                'dificil',
              ] as const);
        for (let i = 0; i < 9; i++)
          await crearPreguntaPublicada(entorno.bd, {
            prueba: 'CL',
            dificultad: dificultades[i]!,
            textoId,
            ordenEnTexto: i + 1,
            habilidadId: habilidades[i % 3]!.id,
          });
      }
      const { token } = await base.sesion(undefined, [base.lectoraId], 2020);
      const r = await m.iniciar(token, base.lectoraId);
      expect(r.status).toBe(201);
      expect(r.body.data.preguntas).toHaveLength(18);
      const { rows } = await entorno.bd.query<{ texto: string; orden: number }>(
        `SELECT v.copia->>'texto_estimulo_id' AS texto,p.orden_en_texto AS orden
       FROM app.evaluacion_item i JOIN contenido.pregunta_version v ON (v.pregunta_id,v.version)=(i.pregunta_id,i.version_pregunta)
       JOIN contenido.pregunta p ON p.id=i.pregunta_id
       WHERE i.evaluacion_id=$1 ORDER BY i.orden`,
        [r.body.data.id],
      );
      for (const texto of textos)
        expect(rows.filter((p) => p.texto === texto).map((p) => p.orden)).toEqual([
          1, 2, 3, 4, 5, 6, 7, 8, 9,
        ]);
    });

    it('Ciencias requiere electivo y arma 18 comunes más 9 del electivo, sin repetir preguntas', async () => {
      const contenidos = await m.banco('CIE', 9);
      const {
        rows: [prueba],
      } = await entorno.bd.query<{ id: number }>(
        "SELECT id FROM contenido.prueba WHERE codigo='CIE'",
      );
      const { token, id } = await base.sesion(undefined, [prueba!.id], 2020);
      const falta = await m.iniciar(token, prueba!.id);
      expect(falta.status).toBe(400);
      expect(falta.body.error.detalles[0].motivo).toBe('electivo_requerido');
      await entorno.bd.query(
        'UPDATE app.estudiante_prueba SET electivo_area_id=$2 WHERE estudiante_id=$1 AND prueba_id=$3',
        [id, contenidos[0]!.areaId, prueba!.id],
      );
      const r = await m.iniciar(token, prueba!.id);
      expect(r.status).toBe(201);
      expect(r.body.data).toMatchObject({ cantidad: 27, duracionMin: 54 });
      const { rows } = await entorno.bd.query<{ area: number; total: number }>(
        `SELECT c.area_id AS area,count(*)::int AS total FROM app.evaluacion_item i
       JOIN contenido.pregunta_version v ON (v.pregunta_id,v.version)=(i.pregunta_id,i.version_pregunta)
       JOIN contenido.contenido_tematico c ON c.id=v.contenido_id WHERE i.evaluacion_id=$1 GROUP BY c.area_id`,
        [r.body.data.id],
      );
      expect(rows.find((c) => c.area === contenidos[0]!.areaId)?.total).toBe(15);
      expect(rows.filter((c) => c.area !== contenidos[0]!.areaId).map((c) => c.total)).toEqual([
        6, 6,
      ]);
    });

    it('omite un eje todavía no enseñado y redistribuye 22 entre los restantes por cuotas', async () => {
      const {
        rows: [omitido],
      } = await entorno.bd.query<{ id: number }>(
        'SELECT id FROM contenido.eje_tematico WHERE prueba_id=$1 ORDER BY orden DESC LIMIT 1',
        [base.pruebaId],
      );
      await entorno.bd.query(
        `UPDATE contenido.contenido_tematico SET nivel_escolar_id=(SELECT id FROM contenido.nivel_escolar WHERE anios_para_egreso=CASE WHEN eje_id=$2 THEN 0 ELSE 3 END) WHERE prueba_id=$1`,
        [base.pruebaId, omitido!.id],
      );
      await m.banco();
      const { token } = await base.sesion(undefined, undefined, 2029);
      const r = await m.iniciar(token);
      expect(r.status).toBe(201);
      const { rows } = await entorno.bd.query<{ eje: number; total: number }>(
        `SELECT v.eje_id AS eje,count(*)::int AS total FROM app.evaluacion_item i
       JOIN contenido.pregunta_version v ON (v.pregunta_id,v.version)=(i.pregunta_id,i.version_pregunta)
       WHERE i.evaluacion_id=$1 GROUP BY v.eje_id`,
        [r.body.data.id],
      );
      expect(rows.some((e) => e.eje === omitido!.id)).toBe(false);
      expect(rows.map((e) => e.total).sort((a, b) => a - b)).toEqual([6, 8, 8]);
    });
  },
);
