// Crear y editar preguntas contra PostgreSQL real (HU-12.1, ver base-temporal.ts): con las semillas
// (temario y tipos de pregunta por prueba), la pregunta nueva queda en borrador con su autor, sus
// alternativas, su historial y su auditoría; al editar, las alternativas conservan su id y la versión
// sube sola si ya se había guardado. Los textos de lectura (HU-12.2) se crean con su autor y su
// auditoría, y no se editan si una pregunta que los usa está en revisión. Los casos de RN-08 sin base
// están en preguntas-edicion.test.ts y los de los textos en textos-lectura.test.ts.
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearServicios, type Servicios } from '../app.js';
import { ErrorConflicto } from '../comun/errores.js';
import { ejecutarEnTransaccion } from '../db/transaccion.js';
import { ejecutarSemillas } from '../db/semillas.js';
import {
  type DatosPregunta,
  esquemaPregunta,
  esquemaTexto,
} from '../modulos/preguntas/preguntas.validadores.js';
import { crearDependenciasDePrueba } from './ayudantes.js';
import { uno } from './banco-de-prueba.js';
import {
  type BaseTemporal,
  crearBaseTemporal,
  exigirBaseEnCi,
  MINUTO,
  urlBase,
} from './base-temporal.js';
import { alternativas } from './edicion-de-prueba.js';
import { cuerpoTexto } from './textos-de-prueba.js';

describe('crear y editar preguntas sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('crear y editar preguntas con PostgreSQL (HU-12.1 y HU-12.2)', () => {
  let base: BaseTemporal;
  let servicios: Servicios;
  let adminId = '';
  const ids = new Map<string, number>();

  /** Una pregunta de la prueba indicada, en su primer contenido y su primera habilidad. */
  const datos = (codigo: string, cambios: Record<string, unknown> = {}): DatosPregunta =>
    esquemaPregunta.parse({
      pruebaId: ids.get(codigo),
      contenidoId: ids.get(`${codigo}:contenido`),
      habilidadId: ids.get(`${codigo}:habilidad`),
      tipoPregunta: 'seleccion_multiple',
      enunciado: 'Si $2x + 3 = 11$, ¿cuánto vale $x$?',
      explicacion: 'Se despeja: $x = 4$.',
      alternativas: alternativas(4, ['B']),
      ...cambios,
    });

  const cambiarEtapa = (id: string, codigo: string) =>
    base.bd.query(
      `UPDATE contenido.pregunta
          SET estado_pregunta_id = (SELECT id FROM contenido.estado_pregunta WHERE codigo = $2)
        WHERE id = $1`,
      [id, codigo],
    );

  beforeAll(async () => {
    base = await crearBaseTemporal('edicion');
    const { bd } = base;
    await ejecutarSemillas(bd, path.join(import.meta.dirname, '../db/semillas'));
    const { rows } = await bd.query<{
      codigo: string;
      id: number;
      contenido: number;
      habilidad: number;
    }>(
      `SELECT p.codigo, p.id,
              (SELECT min(c.id) FROM contenido.contenido_tematico c WHERE c.prueba_id = p.id) AS contenido,
              (SELECT min(h.id) FROM contenido.habilidad h WHERE h.prueba_id = p.id) AS habilidad
         FROM contenido.prueba p`,
    );
    for (const fila of rows) {
      ids.set(fila.codigo, fila.id);
      ids.set(`${fila.codigo}:contenido`, fila.contenido);
      ids.set(`${fila.codigo}:habilidad`, fila.habilidad);
    }
    adminId = String(
      await uno(
        bd,
        `INSERT INTO contenido.usuario_interno (nombre, correo, hash_contrasena, rol_id, creado_en)
         SELECT 'Admin', 'admin@edicion.cl', 'x', id, now() FROM contenido.rol WHERE codigo = 'admin'
         RETURNING id`,
      ),
    );
    servicios = crearServicios(
      crearDependenciasDePrueba({
        bd,
        unidadDeTrabajo: { enTransaccion: (trabajo) => ejecutarEnTransaccion(bd, trabajo) },
      }),
    );
  }, MINUTO);

  afterAll(() => base.cerrar(), MINUTO);

  it('la semilla 005 da selección múltiple a todas las pruebas y suficiencia de datos solo a M2', async () => {
    const pruebas = await servicios.temario.listarTemario();
    const tipos = Object.fromEntries(
      pruebas.map((p) => [p.codigo, p.tiposPregunta.map((t) => t.codigo)]),
    );

    expect(tipos).toEqual({
      CL: ['seleccion_multiple'],
      M1: ['seleccion_multiple'],
      M2: ['seleccion_multiple', 'suficiencia_datos'],
      HCS: ['seleccion_multiple'],
      CIE: ['seleccion_multiple'],
    });
    expect(pruebas.find((p) => p.codigo === 'CL')).toMatchObject({
      opcionesMin: 4,
      opcionesMax: 4,
      requiereTexto: true,
    });
    expect(pruebas.find((p) => p.codigo === 'M2')).toMatchObject({ opcionesMax: 5 });
  });

  it('la pregunta nueva queda en borrador, con su autor, sus alternativas, su historial y su auditoría', async () => {
    const creada = await servicios.preguntas.crearPregunta(adminId, datos('M1'));

    expect(creada).toMatchObject({ estado: { codigo: 'borrador' }, editable: true, version: 1 });
    const { rows: pregunta } = await base.bd.query(
      'SELECT autor_id::text AS autor FROM contenido.pregunta WHERE id = $1',
      [creada.id],
    );
    expect(pregunta).toEqual([{ autor: adminId }]);
    const { rows: alternativasGuardadas } = await base.bd.query(
      'SELECT letra, es_correcta FROM contenido.alternativa WHERE pregunta_id = $1 ORDER BY letra',
      [creada.id],
    );
    expect(alternativasGuardadas.map((a: { letra: string }) => a.letra)).toEqual([
      'A',
      'B',
      'C',
      'D',
    ]);
    expect(alternativasGuardadas.filter((a: { es_correcta: boolean }) => a.es_correcta)).toEqual([
      { letra: 'B', es_correcta: true },
    ]);
    const { rows: historial } = await base.bd.query(
      `SELECT h.desde_id, e.codigo AS hacia, h.usuario_id::text AS usuario
         FROM contenido.historial_estado_pregunta h
         JOIN contenido.estado_pregunta e ON e.id = h.hacia_id
        WHERE h.pregunta_id = $1`,
      [creada.id],
    );
    expect(historial).toEqual([{ desde_id: null, hacia: 'borrador', usuario: adminId }]);
    const { rows: auditoria } = await base.bd.query(
      `SELECT a.entidad, a.entidad_id::text AS id FROM contenido.auditoria a
         JOIN contenido.accion_auditoria x ON x.id = a.accion_auditoria_id
        WHERE x.codigo = 'crear_pregunta'`,
    );
    expect(auditoria).toEqual([{ entidad: 'pregunta', id: creada.id }]);
  });

  it('CP-09 con el temario real: solo se acepta la de M2 con 5; las demás, con su motivo y sin guardarse', async () => {
    const contar = async () =>
      Number((await base.bd.query('SELECT count(*) AS n FROM contenido.pregunta')).rows[0]?.n);
    const antes = await contar();
    const crear = (d: DatosPregunta) => servicios.preguntas.crearPregunta(adminId, d);

    await expect(crear(datos('M1', { alternativas: alternativas(5) }))).rejects.toThrow(
      'Competencia Matemática 1 lleva 4 alternativas.',
    );
    await expect(crear(datos('M1', { alternativas: alternativas(4, ['A', 'C']) }))).rejects.toThrow(
      'Marca una sola alternativa correcta.',
    );
    await expect(crear(datos('CL'))).rejects.toThrow(
      'En Competencia Lectora cada pregunta va con su texto de lectura.',
    );
    expect(await contar()).toBe(antes);

    const m2 = await crear(datos('M2', { alternativas: alternativas(5, ['E']) }));
    expect(m2).toMatchObject({ estado: { codigo: 'borrador' }, version: 1 });
    expect(await contar()).toBe(antes + 1);
    // La base tampoco acepta una segunda correcta aunque se salte la API (ux_alternativa_una_correcta).
    await expect(
      base.bd.query(
        "UPDATE contenido.alternativa SET es_correcta = true WHERE pregunta_id = $1 AND letra = 'A'",
        [m2.id],
      ),
    ).rejects.toThrow(/ux_alternativa_una_correcta/);
  });

  it('una de Competencia Lectora se guarda con su texto de lectura y su orden', async () => {
    const texto = await uno(
      base.bd,
      `INSERT INTO contenido.texto_estimulo (tipo_texto_id, titulo, contenido, creado_en)
       SELECT id, 'El faro', 'Había una vez un faro.', now() FROM contenido.tipo_texto WHERE codigo = 'literario'
       RETURNING id`,
    );

    const creada = await servicios.preguntas.crearPregunta(
      adminId,
      datos('CL', { textoEstimuloId: texto, ordenEnTexto: 1 }),
    );

    expect(creada).toMatchObject({ textoEstimuloId: String(texto), ordenEnTexto: 1 });
  });

  it('editar en borrador cambia las alternativas por letra, sin cambiar sus ids ni la versión', async () => {
    const creada = await servicios.preguntas.crearPregunta(adminId, datos('M2'));

    const editada = await servicios.preguntas.editarPregunta(
      adminId,
      creada.id,
      datos('M2', { enunciado: 'Otro enunciado', alternativas: alternativas(5, ['E']) }),
    );

    expect(editada.enunciado).toBe('Otro enunciado');
    expect(editada.version).toBe(1);
    expect(editada.alternativas.slice(0, 4).map((a) => a.id)).toEqual(
      creada.alternativas.map((a) => a.id),
    );
    expect(editada.alternativas.filter((a) => a.esCorrecta).map((a) => a.letra)).toEqual(['E']);

    const conCuatro = await servicios.preguntas.editarPregunta(adminId, creada.id, datos('M2'));
    expect(conCuatro.alternativas.map((a) => a.letra)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('una observada se edita y su versión sube sola; en revisión no se edita (RF-G09)', async () => {
    const creada = await servicios.preguntas.crearPregunta(adminId, datos('M1'));
    await cambiarEtapa(creada.id, 'en_revision');

    await expect(
      servicios.preguntas.editarPregunta(adminId, creada.id, datos('M1', { enunciado: 'Cambio' })),
    ).rejects.toBeInstanceOf(ErrorConflicto);

    await cambiarEtapa(creada.id, 'observada');
    const editada = await servicios.preguntas.editarPregunta(
      adminId,
      creada.id,
      datos('M1', { enunciado: 'Corregida', alternativas: alternativas(4, ['C']) }),
    );

    expect(editada).toMatchObject({ enunciado: 'Corregida', version: 2 });
    expect(editada.alternativas.map((a) => a.id)).toEqual(creada.alternativas.map((a) => a.id));
  });

  /** Acciones de auditoría registradas sobre la entidad indicada, en orden. */
  const acciones = async (entidad: string, id: string) => {
    const { rows } = await base.bd.query<{ codigo: string }>(
      `SELECT x.codigo FROM contenido.auditoria a
         JOIN contenido.accion_auditoria x ON x.id = a.accion_auditoria_id
        WHERE a.entidad = $1 AND a.entidad_id = $2 ORDER BY a.id`,
      [entidad, id],
    );
    return rows.map((fila) => fila.codigo);
  };

  it('un texto se crea con su autor, se encuentra por su título y se edita, todo auditado', async () => {
    const creado = await servicios.preguntas.crearTexto(adminId, esquemaTexto.parse(cuerpoTexto()));
    const { rows } = await base.bd.query(
      'SELECT creado_por::text AS autor FROM contenido.texto_estimulo WHERE id = $1',
      [creado.id],
    );
    expect(rows).toEqual([{ autor: adminId }]);

    const { textos } = await servicios.preguntas.listarTextos({
      buscar: 'FARO DEL',
      pagina: 1,
      porPagina: 20,
    });
    expect(textos.map((texto) => texto.id)).toContain(creado.id);

    const editado = await servicios.preguntas.editarTexto(
      adminId,
      creado.id,
      esquemaTexto.parse(
        cuerpoTexto({ titulo: 'El faro del norte', imagenUrl: 'imagenes/faro.png' }),
      ),
    );
    expect(editado).toMatchObject({ titulo: 'El faro del norte', imagenUrl: 'imagenes/faro.png' });
    expect(await acciones('texto_estimulo', creado.id)).toEqual(['crear_texto', 'editar_texto']);
  });

  it('una pregunta de Competencia Lectora crea su texto nuevo; el texto no se edita si la pregunta está en revisión', async () => {
    const creada = await servicios.preguntas.crearPregunta(
      adminId,
      datos('CL', { textoNuevo: cuerpoTexto({ titulo: 'Las abejas' }), ordenEnTexto: 1 }),
    );
    const textoId = creada.textoEstimuloId ?? '';
    const texto = await servicios.preguntas.obtenerTexto(textoId);
    expect(texto).toMatchObject({ titulo: 'Las abejas', preguntas: 1, editable: true });
    expect(await acciones('texto_estimulo', textoId)).toEqual(['crear_texto']);

    await cambiarEtapa(creada.id, 'en_revision');

    expect((await servicios.preguntas.obtenerTexto(textoId)).editable).toBe(false);
    await expect(
      servicios.preguntas.editarTexto(adminId, textoId, esquemaTexto.parse(cuerpoTexto())),
    ).rejects.toBeInstanceOf(ErrorConflicto);
  });
});
