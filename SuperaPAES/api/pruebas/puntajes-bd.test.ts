// Puntajes PAES declarados contra PostgreSQL real (HU-41.1, RF-A17, RN-16, CU-14a, CP-25): sin el
// permiso no se guarda nada; con él, el puntaje queda como declarado y uno fuera de 100 a 1.000 se
// rechaza; al retirar el permiso los puntajes se borran. Carga las semillas, con el permiso de puntajes.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { prepararPerfil } from './perfil-de-prueba.js';

const RUTA_PUNTAJES = '/api/v1/app/cuentas/puntajes';
const RUTA_PERMISO = `${RUTA_PUNTAJES}/permiso`;

/** Mediodía del 27/10/2026 en Chile: la admisión que viene es la 2027. */
const OCTUBRE_2026 = new Date('2026-10-27T15:00:00.000Z');

interface PuntajesPaes {
  permiso: {
    documento: { id: number; version: string; texto: string };
    otorgado: boolean;
    otorgadoEn: string | null;
  };
  puntajes: { id: number; pruebaId: number; anioAdmision: number; puntaje: number }[];
}

describe('puntajes PAES sin base de datos', () => {
  exigirBaseEnCi();
});

describe.skipIf(!urlBase)('puntajes PAES con PostgreSQL (HU-41.1)', () => {
  const { entorno, prueba, estudianteA } = prepararPerfil('puntajes');

  const leer = (sesion: Record<string, string>) =>
    request(entorno.app).get(RUTA_PUNTAJES).set(sesion);
  const cargar = (sesion: Record<string, string>, cuerpo: Record<string, unknown>) =>
    request(entorno.app).put(RUTA_PUNTAJES).set(sesion).send(cuerpo);

  /** Estudiante con el permiso de puntajes vigente ya dado. */
  async function conPermiso() {
    const estudiante = await estudianteA(OCTUBRE_2026);
    const { documento } = ((await leer(estudiante.sesion)).body.data as PuntajesPaes).permiso;
    const dado = await request(entorno.app)
      .post(RUTA_PERMISO)
      .set(estudiante.sesion)
      .send({ documentoId: documento.id });
    expect(dado.status).toBe(200);
    return estudiante;
  }

  async function filas(estudianteId: string) {
    const { rows } = await entorno.bd.query<{ puntaje: number }>(
      'SELECT puntaje FROM app.puntaje_paes WHERE estudiante_id = $1',
      [estudianteId],
    );
    return rows;
  }

  it('sin el permiso muestra el permiso vigente y no guarda ningún puntaje (CP-25 paso 1)', async () => {
    const { id, sesion } = await estudianteA(OCTUBRE_2026);

    const inicial = await leer(sesion);
    const cargado = await cargar(sesion, {
      pruebaId: prueba('M1'),
      anioAdmision: 2025,
      puntaje: 650,
    });

    expect(inicial.status).toBe(200);
    const datos = inicial.body.data as PuntajesPaes;
    expect(datos.permiso).toMatchObject({ otorgado: false, otorgadoEn: null });
    expect(datos.permiso.documento.version).toBe('1.0');
    expect(datos.permiso.documento.texto).toContain('Permiso para usar los puntajes PAES');
    expect(datos.puntajes).toEqual([]);
    expect(cargado.status).toBe(403);
    expect(cargado.body.error.codigo).toBe('SIN_PERMISO');
    expect(await filas(id)).toEqual([]);
  });

  it('con el permiso guarda el puntaje como declarado y cargarlo otra vez lo corrige (CP-25 paso 2)', async () => {
    const { id, sesion } = await conPermiso();

    const primero = await cargar(sesion, {
      pruebaId: prueba('M1'),
      anioAdmision: 2025,
      puntaje: 650,
    });
    const corregido = await cargar(sesion, {
      pruebaId: prueba('M1'),
      anioAdmision: 2025,
      puntaje: 700,
    });
    const otro = await cargar(sesion, { pruebaId: prueba('CL'), anioAdmision: 2026, puntaje: 540 });

    expect(primero.status).toBe(200);
    expect(corregido.status).toBe(200);
    const datos = otro.body.data as PuntajesPaes;
    expect(datos.permiso.otorgado).toBe(true);
    expect(datos.puntajes).toEqual([
      expect.objectContaining({ pruebaId: prueba('CL'), anioAdmision: 2026, puntaje: 540 }),
      expect.objectContaining({ pruebaId: prueba('M1'), anioAdmision: 2025, puntaje: 700 }),
    ]);
    expect(typeof datos.puntajes[0]?.id).toBe('number');
    expect(await filas(id)).toHaveLength(2);
  });

  it.each([
    ['un puntaje fuera de rango', { puntaje: 1200 }, 'puntaje', 'puntaje_fuera_de_rango'],
    ['un puntaje bajo 100', { puntaje: 99 }, 'puntaje', 'puntaje_fuera_de_rango'],
    ['una admisión que todavía no llega', { anioAdmision: 2028 }, 'anioAdmision', 'anio_invalido'],
    ['una admisión anterior a la PAES', { anioAdmision: 2022 }, 'anioAdmision', 'anio_invalido'],
    ['una prueba que no existe', { pruebaId: 999 }, 'pruebaId', 'prueba_inexistente'],
  ] as const)(
    'rechaza %s con su motivo y no guarda nada (CP-25 paso 3)',
    async (_caso, cambios, ruta, motivo) => {
      const { id, sesion } = await conPermiso();

      const respuesta = await cargar(sesion, {
        pruebaId: prueba('M1'),
        anioAdmision: 2025,
        puntaje: 650,
        ...cambios,
      });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.codigo).toBe('VALIDACION');
      expect(respuesta.body.error.detalles).toContainEqual(
        expect.objectContaining({ ruta, motivo }),
      );
      expect(await filas(id)).toEqual([]);
    },
  );

  it('dar el permiso dos veces deja un solo consentimiento, y con otra versión responde 409', async () => {
    const { id, sesion } = await conPermiso();
    const { documento } = ((await leer(sesion)).body.data as PuntajesPaes).permiso;

    const repetido = await request(entorno.app)
      .post(RUTA_PERMISO)
      .set(sesion)
      .send({ documentoId: documento.id });
    const otraVersion = await request(entorno.app)
      .post(RUTA_PERMISO)
      .set(sesion)
      .send({ documentoId: documento.id + 100 });

    expect(repetido.status).toBe(200);
    expect(otraVersion.status).toBe(409);
    expect(otraVersion.body.error.codigo).toBe('CONFLICTO');
    const { rows } = await entorno.bd.query(
      'SELECT 1 FROM app.consentimiento WHERE estudiante_id = $1 AND documento_legal_id = $2',
      [id, documento.id],
    );
    expect(rows).toHaveLength(1);
  });

  it('retirar el permiso borra los puntajes y ya no deja cargar más (RN-16)', async () => {
    const { id, sesion } = await conPermiso();
    await cargar(sesion, { pruebaId: prueba('M1'), anioAdmision: 2025, puntaje: 650 });

    const retirado = await request(entorno.app).delete(RUTA_PERMISO).set(sesion);
    const despues = await cargar(sesion, {
      pruebaId: prueba('M1'),
      anioAdmision: 2026,
      puntaje: 600,
    });

    expect(retirado.status).toBe(200);
    expect(retirado.body.data).toMatchObject({ permiso: { otorgado: false }, puntajes: [] });
    expect(await filas(id)).toEqual([]);
    const { rows } = await entorno.bd.query<{ revocado: boolean }>(
      'SELECT revocado_en IS NOT NULL AS revocado FROM app.consentimiento WHERE estudiante_id = $1',
      [id],
    );
    expect(rows.map((fila) => fila.revocado)).toContain(true);
    expect(despues.status).toBe(403);
  });

  it('borra un puntaje propio; el de otro estudiante responde 404 y no se toca', async () => {
    const ana = await conPermiso();
    const beto = await conPermiso();
    const deAna = await cargar(ana.sesion, {
      pruebaId: prueba('M1'),
      anioAdmision: 2025,
      puntaje: 650,
    });
    const puntajeId = (deAna.body.data as PuntajesPaes).puntajes[0]?.id ?? 0;

    const ajeno = await request(entorno.app)
      .delete(`${RUTA_PUNTAJES}/${String(puntajeId)}`)
      .set(beto.sesion);
    expect(ajeno.status).toBe(404);
    expect(await filas(ana.id)).toHaveLength(1);

    const propio = await request(entorno.app)
      .delete(`${RUTA_PUNTAJES}/${String(puntajeId)}`)
      .set(ana.sesion);
    expect(propio.status).toBe(200);
    expect((propio.body.data as PuntajesPaes).puntajes).toEqual([]);
  });

  it('sin la sesión de la app las rutas responden 401', async () => {
    expect((await request(entorno.app).get(RUTA_PUNTAJES)).status).toBe(401);
    expect((await request(entorno.app).delete(RUTA_PERMISO)).status).toBe(401);
  });
});
