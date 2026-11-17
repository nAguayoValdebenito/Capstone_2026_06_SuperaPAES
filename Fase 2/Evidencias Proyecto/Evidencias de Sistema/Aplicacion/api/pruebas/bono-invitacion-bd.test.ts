// HU-47.1 (RF-A12, RN-03, CU-02a) contra PostgreSQL real: cuando el invitado verifica su correo, su
// invitación queda verificada y quien lo invitó recibe 5 preguntas extra, una sola vez por invitado y
// hasta el tope de invitaciones premiadas del mes de Chile. A38 ve lo ganado, el saldo y el tope.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { usarBaseDeSesiones } from './base-sesiones.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { conToken, RUTA_INGRESO_APP } from './escenario-sesiones.js';
import { crearEstudianteDePrueba } from './estudiantes-de-prueba.js';
import { estudianteConSesion, pedirCorreo, verificarConCodigo } from './verificacion-de-prueba.js';

const RUTA_INVITACIONES = '/api/v1/app/cupo-invitaciones/invitaciones';
const CONTRASENA = 'clave-de-prueba-1';

exigirBaseEnCi();
describe.skipIf(!urlBase)('bono por invitación con PostgreSQL (HU-47.1)', () => {
  const entorno = usarBaseDeSesiones('bono');
  let numero = 0;

  /** Quien invita, con su sesión para ver A38. */
  async function invitante() {
    numero += 1;
    const correo = `invita${String(numero)}@ejemplo.cl`;
    const id = await crearEstudianteDePrueba(entorno.bd, { correo, contrasena: CONTRASENA });
    const ingreso = await request(entorno.app)
      .post(RUTA_INGRESO_APP)
      .send({ correo, contrasena: CONTRASENA });
    return { id, sesion: conToken(ingreso.body.data.tokenAcceso as string) };
  }

  /** Un invitado registrado con el código del invitante (CU-01a), sin verificar. */
  async function invitado(invitanteId: string) {
    const cuenta = await estudianteConSesion(entorno);
    await entorno.bd.query(
      `INSERT INTO app.invitacion (invitante_id, invitado_id, registrado_en) VALUES ($1, $2, $3)`,
      [invitanteId, cuenta.id, entorno.ahora()],
    );
    return cuenta;
  }

  /** El invitado verifica su correo con el código (A06). */
  async function verificar(cuenta: { sesion: Record<string, string> }) {
    const { codigo } = await pedirCorreo(entorno, cuenta.sesion);
    expect((await verificarConCodigo(entorno, cuenta.sesion, codigo)).status).toBe(200);
  }

  const resumen = async (sesion: Record<string, string>) =>
    (await request(entorno.app).get(RUTA_INVITACIONES).set(sesion)).body.data as Record<
      string,
      unknown
    >;

  const invitacionDe = async (invitadoId: string) => {
    const { rows } = await entorno.bd.query<{ verificada: boolean; bono: boolean }>(
      `SELECT verificado_en IS NOT NULL AS verificada, bono_entregado AS bono
         FROM app.invitacion WHERE invitado_id = $1`,
      [invitadoId],
    );
    return rows[0];
  };

  it('al verificar el invitado, quien invitó gana 5 preguntas extra, una sola vez (CU-02a)', async () => {
    const ana = await invitante();
    const beto = await invitado(ana.id);
    expect(await resumen(ana.sesion)).toMatchObject({ registrados: 1, verificados: 0 });

    await verificar(beto);

    expect(await invitacionDe(beto.id)).toEqual({ verificada: true, bono: true });
    expect(await resumen(ana.sesion)).toMatchObject({
      registrados: 1,
      verificados: 1,
      preguntasGanadas: 5,
      saldoExtra: 5,
      premiadasMes: 1,
      topeMes: 10,
    });
    // Pedir otra verificación con el correo ya verificado no premia de nuevo.
    await verificarConCodigo(entorno, beto.sesion, '000000');
    expect(await resumen(ana.sesion)).toMatchObject({ preguntasGanadas: 5, saldoExtra: 5 });
  });

  it('sin código de invitación, verificar no premia a nadie', async () => {
    const ana = await invitante();
    const solo = await estudianteConSesion(entorno);

    await verificar(solo);

    expect(await resumen(ana.sesion)).toMatchObject({ preguntasGanadas: 0, saldoExtra: 0 });
  });

  it('sobre el tope del mes la invitación queda verificada sin bono; las del mes anterior no cuentan (RN-03)', async () => {
    await entorno.bd.query(
      "UPDATE contenido.configuracion SET valor = '1' WHERE clave = 'tope_invitaciones_mes'",
    );
    try {
      const ana = await invitante();
      // Un premio del mes pasado no cuenta para el tope de este mes.
      const antiguo = await invitado(ana.id);
      await entorno.bd.query(
        'UPDATE app.invitacion SET verificado_en = $2, bono_entregado = true WHERE invitado_id = $1',
        [antiguo.id, new Date(entorno.ahora().getTime() - 40 * 86_400_000)],
      );
      await entorno.bd.query(
        `INSERT INTO app.movimiento_bono
           (estudiante_id, tipo_movimiento_bono_id, cantidad, invitacion_id, creado_en)
         SELECT $1, t.id, 5, i.id, $3 FROM contenido.tipo_movimiento_bono t, app.invitacion i
          WHERE t.codigo = 'abono' AND i.invitado_id = $2`,
        [ana.id, antiguo.id, new Date(entorno.ahora().getTime() - 40 * 86_400_000)],
      );
      const primero = await invitado(ana.id);
      const segundo = await invitado(ana.id);

      await verificar(primero);
      await verificar(segundo);

      expect(await invitacionDe(primero.id)).toEqual({ verificada: true, bono: true });
      expect(await invitacionDe(segundo.id)).toEqual({ verificada: true, bono: false });
      expect(await resumen(ana.sesion)).toMatchObject({
        verificados: 3,
        preguntasGanadas: 10,
        saldoExtra: 10,
        premiadasMes: 1,
        topeMes: 1,
      });
    } finally {
      await entorno.bd.query(
        "UPDATE contenido.configuracion SET valor = '10' WHERE clave = 'tope_invitaciones_mes'",
      );
    }
  });

  it('si quien invitó borró su cuenta, la invitación queda verificada sin bono', async () => {
    const ana = await invitante();
    const beto = await invitado(ana.id);
    await entorno.bd.query('UPDATE app.estudiante SET eliminado_en = $2 WHERE id = $1', [
      ana.id,
      entorno.ahora(),
    ]);

    await verificar(beto);

    expect(await invitacionDe(beto.id)).toEqual({ verificada: true, bono: false });
  });
});
