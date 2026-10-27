// Registro del estudiante contra PostgreSQL real (HU-01.1 y HU-01.3, CU-01, CP-01, CP-02): cuenta sin
// verificar con la contraseña cifrada, consentimientos con su versión y fecha, correo de verificación,
// rechazos sin datos huérfanos, motivos de la contraseña, invitación, dos registros a la vez y una
// falla a mitad de la transacción. Carga la semilla 003 (documentos legales 1.0).
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { crearServicios } from '../app.js';
import { ejecutarSemillas } from '../db/semillas.js';
import { ejecutarEnTransaccion } from '../db/transaccion.js';
import { crearCuentasServicio } from '../modulos/cuentas/index.js';
import { crearDependenciasDePrueba, errorConFormato } from './ayudantes.js';
import { usarBaseDeSesiones } from './base-sesiones.js';
import { exigirBaseEnCi, MINUTO, urlBase } from './base-temporal.js';
import { crearEstudianteDePrueba } from './estudiantes-de-prueba.js';

const RUTA_REGISTRO = '/api/v1/app/cuentas/registro';
const CARPETA_SEMILLAS = path.join(import.meta.dirname, '../db/semillas');

describe('registro del estudiante sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('registro del estudiante con PostgreSQL', () => {
  const entorno = usarBaseDeSesiones('registro');
  /** Ids de las versiones vigentes de términos y privacidad (1.0, de la semilla 003). */
  let vigentes: number[] = [];
  /** El registro cuenta todos los intentos (RNF-02): este archivo usa una app con un límite holgado. */
  let app: ReturnType<typeof entorno.crearAppConLimite>;

  beforeAll(async () => {
    const todas = (await readdir(CARPETA_SEMILLAS)).filter((nombre) => nombre.endsWith('.sql'));
    await ejecutarSemillas(
      entorno.bd,
      CARPETA_SEMILLAS,
      todas.filter((nombre) => nombre !== '003_documentos_legales.sql'),
    );
    const { rows } = await entorno.bd.query<{ id: number }>(
      `SELECT d.id FROM contenido.documento_legal d
         JOIN contenido.tipo_documento_legal t ON t.id = d.tipo_documento_legal_id
        WHERE t.obligatorio ORDER BY d.id`,
    );
    vigentes = rows.map((fila) => fila.id);
    app = entorno.crearAppConLimite({ ventanaMs: 60_000, maximo: 1000 });
  }, MINUTO);

  const cuerpo = (cambios: Record<string, unknown> = {}) => ({
    nombre: 'Estudiante Prueba',
    correo: 'estudiante@ejemplo.cl',
    contrasena: 'tranquilo-del-sur',
    declaraTenerCatorceAnios: true,
    documentosAceptados: vigentes,
    ...cambios,
  });
  const registrar = (cambios: Record<string, unknown> = {}) =>
    request(app).post(RUTA_REGISTRO).send(cuerpo(cambios));
  const contar = async (tabla: string) =>
    (await entorno.bd.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${tabla}`)).rows[0]?.n;
  /** Nada quedó a medias: ni cuenta, ni consentimientos, ni sesión, ni invitación, ni correo. */
  const sinDatos = async () => ({
    estudiantes: await contar('app.estudiante'),
    consentimientos: await contar('app.consentimiento'),
    sesiones: await contar('app.token_sesion'),
    invitaciones: await contar('app.invitacion'),
    correos: await contar('app.token_correo'),
  });
  const vacio = { estudiantes: 0, consentimientos: 0, sesiones: 0, invitaciones: 0, correos: 0 };

  describe('CP-01: cuenta creada', () => {
    it('crea la cuenta sin verificar, con la contraseña cifrada, lo aceptado con versión y fecha, la sesión y el correo de verificación', async () => {
      const respuesta = await registrar({
        nombre: '  Estudiante   Prueba ',
        correo: '  Estudiante@Ejemplo.CL ',
      });

      expect(respuesta.status).toBe(201);
      const { estudiante } = respuesta.body.data as { estudiante: { id: number } };
      expect(respuesta.body.data).toEqual({
        tokenAcceso: expect.any(String) as string,
        tokenRenovacion: expect.any(String) as string,
        estudiante: {
          id: estudiante.id,
          nombre: 'Estudiante Prueba',
          correo: 'estudiante@ejemplo.cl',
          correoVerificado: false,
        },
      });
      expect(JSON.stringify(respuesta.body)).not.toMatch(/hash|\$2[aby]\$/i);
      const { rows } = await entorno.bd.query<{
        hash: string;
        verificado: boolean;
        codigo: string;
        creado: Date;
      }>(
        `SELECT hash_contrasena AS hash, correo_verificado AS verificado,
                codigo_invitacion AS codigo, creado_en AS creado
           FROM app.estudiante WHERE id = $1`,
        [estudiante.id],
      );
      expect(rows[0]?.hash.startsWith('$2')).toBe(true);
      expect(rows[0]?.verificado).toBe(false);
      expect(rows[0]?.codigo).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
      expect(rows[0]?.creado).toEqual(entorno.ahora());
      const consentimientos = await entorno.bd.query<{ tipo: string; version: string; en: Date }>(
        `SELECT t.codigo AS tipo, d.version, c.aceptado_en AS en
           FROM app.consentimiento c
           JOIN contenido.documento_legal d ON d.id = c.documento_legal_id
           JOIN contenido.tipo_documento_legal t ON t.id = d.tipo_documento_legal_id
          WHERE c.estudiante_id = $1 AND c.revocado_en IS NULL ORDER BY t.codigo`,
        [estudiante.id],
      );
      expect(consentimientos.rows).toEqual([
        { tipo: 'privacidad', version: '1.0', en: entorno.ahora() },
        { tipo: 'terminos', version: '1.0', en: entorno.ahora() },
      ]);
      expect(await contar('app.token_sesion')).toBe(1);
      expect(await contar('app.token_correo')).toBe(1);
      expect(entorno.correos.map((c) => c.para)).toEqual(['estudiante@ejemplo.cl']);
    });

    it('HU-01 esc. 4: no crea filas de cupo; el cupo inicial (10) sale de la configuración', async () => {
      await registrar();

      const { rows } = await entorno.bd.query<{ valor: unknown }>(
        `SELECT valor FROM contenido.configuracion WHERE clave = 'cupo_inicial'`,
      );
      expect(rows[0]?.valor).toBe(10);
      expect(await contar('app.cupo_diario')).toBe(0);
    });

    it('si el correo de verificación no sale, la cuenta igual se crea y se puede pedir otro', async () => {
      entorno.fallarCorreo(true);

      const respuesta = await registrar();

      expect(respuesta.status).toBe(201);
      expect(await contar('app.estudiante')).toBe(1);
      expect(await contar('app.token_correo')).toBe(1);
    });
  });

  describe('CP-02: rechazos sin crear nada', () => {
    it.each([
      [
        'sin aceptar los términos ni la política',
        { documentosAceptados: [] },
        'documentos_no_vigentes',
      ],
      ['aceptando solo uno de los documentos', 'uno', 'documentos_no_vigentes'],
      ['sin la declaración de edad', { declaraTenerCatorceAnios: false }, 'edad_no_declarada'],
    ])('%s: 400 con su motivo', async (_caso, cambios, motivo) => {
      const respuesta = await registrar(
        cambios === 'uno'
          ? { documentosAceptados: vigentes.slice(0, 1) }
          : (cambios as Record<string, unknown>),
      );

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.detalles[0].motivo).toBe(motivo);
      expect(respuesta.body.error.mensaje).not.toBe('');
      expect(await sinDatos()).toEqual(vacio);
    });

    it('con un documento desactualizado (ya hay una versión 2.0 vigente): 400 que nombra la versión vigente', async () => {
      const { rows } = await entorno.bd.query<{ id: number }>(
        `INSERT INTO contenido.documento_legal (tipo_documento_legal_id, version, contenido, vigente_desde)
         SELECT id, '2.0', 'Términos 2.0', $1 FROM contenido.tipo_documento_legal WHERE codigo = 'terminos'
         RETURNING id`,
        [new Date(entorno.ahora().getTime() - 60_000)],
      );
      try {
        const respuesta = await registrar();

        expect(respuesta.status).toBe(400);
        expect(respuesta.body.error.detalles[0].motivo).toBe('documentos_no_vigentes');
        expect(respuesta.body.error.mensaje).toMatch(/versión 2\.0/);
        expect(await sinDatos()).toEqual(vacio);
      } finally {
        await entorno.bd.query('DELETE FROM contenido.documento_legal WHERE id = $1', [
          rows[0]?.id,
        ]);
      }
    });

    it('con un correo ya registrado, también con otras mayúsculas: 409 claro y sin consentimientos huérfanos', async () => {
      expect((await registrar()).status).toBe(201);

      const repetido = await registrar({ correo: 'ESTUDIANTE@ejemplo.cl', nombre: 'Otra' });

      expect(repetido.status).toBe(409);
      expect(repetido.body).toEqual(errorConFormato('CONFLICTO'));
      expect(repetido.body.error.mensaje).toMatch(/ya tiene una cuenta/);
      expect(await contar('app.estudiante')).toBe(1);
      expect(await contar('app.consentimiento')).toBe(2);
      expect(await contar('app.token_sesion')).toBe(1);
    });
  });

  it.each([
    ['contrasena_corta', 'corta12'],
    ['contrasena_larga', 'k'.repeat(73)],
    ['contrasena_bytes', '😀'.repeat(20)],
    ['contrasena_igual_correo', 'Estudiante@Ejemplo.cl'],
    ['contrasena_comun', 'Contraseña123'],
  ])(
    'rechaza la contraseña con motivo %s y no crea la cuenta (CU-01 5.b)',
    async (motivo, contrasena) => {
      const respuesta = await registrar({ contrasena });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.detalles[0]).toMatchObject({ ruta: 'contrasena', motivo });
      expect(await sinDatos()).toEqual(vacio);
    },
  );

  describe('código de invitación (HU-01 esc. 3)', () => {
    it('con el código de un estudiante, crea la invitación sin bono ni dispositivo', async () => {
      const invitante = await crearEstudianteDePrueba(entorno.bd, {
        correo: 'invitante@ejemplo.cl',
        contrasena: 'clave-del-invitante',
      });
      const { rows: codigos } = await entorno.bd.query<{ codigo: string }>(
        'SELECT codigo_invitacion AS codigo FROM app.estudiante WHERE id = $1',
        [invitante],
      );

      const respuesta = await registrar({
        codigoInvitacion: ` ${codigos[0]?.codigo.toLowerCase() ?? ''} `,
      });

      expect(respuesta.status).toBe(201);
      const { rows } = await entorno.bd.query(
        `SELECT invitante_id::text AS invitante, invitado_id::text AS invitado, registrado_en AS registrado,
                verificado_en AS verificado, bono_entregado AS bono, dispositivo_hash AS dispositivo
           FROM app.invitacion`,
      );
      expect(rows).toEqual([
        {
          invitante,
          invitado: String((respuesta.body.data as { estudiante: { id: number } }).estudiante.id),
          registrado: entorno.ahora(),
          verificado: null,
          bono: false,
          dispositivo: null,
        },
      ]);
    });

    it('con un código que no existe, rechaza con un mensaje claro y no deja nada a medias', async () => {
      const respuesta = await registrar({ codigoInvitacion: 'ZZZZ22' });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.detalles[0]).toMatchObject({
        ruta: 'codigoInvitacion',
        motivo: 'codigo_invitacion_inexistente',
      });
      // La cuenta, sus consentimientos y la sesión se habían escrito antes en la transacción.
      expect(await sinDatos()).toEqual(vacio);
    });
  });

  it('un código de invitación propio repetido se reintenta con otro: nunca se repite entre cuentas', async () => {
    const dependencias = crearDependenciasDePrueba({
      bd: entorno.bd,
      unidadDeTrabajo: { enTransaccion: (trabajo) => ejecutarEnTransaccion(entorno.bd, trabajo) },
    });
    const servicios = crearServicios(dependencias);
    const secuencia = ['AAAAAA', 'AAAAAA', 'BBBBBB'];
    const cuentas = crearCuentasServicio({
      ...dependencias,
      correo: dependencias.proveedores.correo,
      administracion: servicios.administracion,
      cupoInvitaciones: servicios.cupoInvitaciones,
      generarCodigoInvitacion: () => secuencia.shift() ?? 'CCCCCC',
    });
    const datos = cuerpo() as Parameters<typeof cuentas.registrarEstudiante>[0];

    await cuentas.registrarEstudiante(datos);
    await cuentas.registrarEstudiante({ ...datos, correo: 'segunda@ejemplo.cl' });

    const { rows } = await entorno.bd.query<{ codigo: string }>(
      'SELECT codigo_invitacion AS codigo FROM app.estudiante ORDER BY id',
    );
    expect(rows.map((r) => r.codigo)).toEqual(['AAAAAA', 'BBBBBB']);
  });

  it('dos registros a la vez con el mismo correo: uno solo gana', async () => {
    const estados = (
      await Promise.all([registrar(), registrar({ correo: 'Estudiante@ejemplo.cl' })])
    ).map((r) => r.status);

    expect(estados.sort()).toEqual([201, 409]);
    expect(await contar('app.estudiante')).toBe(1);
    expect(await contar('app.consentimiento')).toBe(2);
  });
});
