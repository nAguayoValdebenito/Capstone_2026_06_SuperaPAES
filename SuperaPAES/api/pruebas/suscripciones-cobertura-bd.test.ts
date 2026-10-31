// RN-04, HU-44 esc. 2 y CU-12 paso 6, contra PostgreSQL real: una suscripción activa o en mora cubre
// las pruebas de su plan (Todas las pruebas: todas; Una prueba: la elegida) y responder en ellas no
// descuenta cupo. Pendiente, fallida, cancelada y vencida no cubren nada (RN-26). Hasta HU-44 la
// cobertura sigue solo el estado: nada pasa todavía a cancelada o vencida al terminar el período.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FabricaProveedores } from '../adaptadores/fabrica.js';
import { relojDelSistema } from '../comun/reloj.js';
import {
  crearSuscripcionesServicio,
  type SuscripcionesServicio,
} from '../modulos/suscripciones/index.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { crearEstudianteDePrueba } from './estudiantes-de-prueba.js';
import { prepararRespuestas } from './respuestas-de-prueba.js';
import { insertarSuscripcion } from './suscripciones-de-prueba.js';

exigirBaseEnCi();
describe.skipIf(!urlBase)('cobertura de las suscripciones con PostgreSQL (RN-04)', () => {
  const r = prepararRespuestas('cobertura');
  const { base, entorno } = r;
  let servicio: SuscripcionesServicio;
  let pruebas: Record<'CL' | 'M1' | 'M2', number>;

  beforeAll(async () => {
    servicio = crearSuscripcionesServicio({
      bd: entorno.bd,
      unidadDeTrabajo: { enTransaccion: (trabajo) => trabajo(entorno.bd) },
      pagos: FabricaProveedores.pagos({ proveedor: 'simulado' }, relojDelSistema),
    });
    const { rows } = await entorno.bd.query<{ codigo: 'CL' | 'M1' | 'M2'; id: number }>(
      "SELECT codigo, id FROM contenido.prueba WHERE codigo IN ('CL', 'M1', 'M2')",
    );
    pruebas = Object.fromEntries(rows.map((p) => [p.codigo, p.id])) as typeof pruebas;
  });

  let siguiente = 0;
  const estudiante = () =>
    crearEstudianteDePrueba(entorno.bd, {
      correo: `cobertura${String(++siguiente)}@ejemplo.cl`,
      contrasena: 'clave-para-practicar',
    });
  const cubre = (estudianteId: string, prueba: number) =>
    servicio.cubrePrueba(estudianteId, prueba, entorno.bd);

  it('sin suscripción no cubre ninguna prueba', async () => {
    const id = await estudiante();

    expect(await cubre(id, pruebas.M1)).toBe(false);
  });

  it('Todas las pruebas, activa o en mora, cubre cualquier prueba', async () => {
    const activa = await estudiante();
    const enMora = await estudiante();
    await insertarSuscripcion(entorno.bd, {
      estudianteId: activa,
      plan: 'Todas las pruebas mensual',
      estado: 'activa',
    });
    await insertarSuscripcion(entorno.bd, {
      estudianteId: enMora,
      plan: 'Todas las pruebas anual',
      estado: 'en_mora',
      tienda: 'app_store',
    });

    for (const prueba of Object.values(pruebas)) {
      expect(await cubre(activa, prueba)).toBe(true);
      expect(await cubre(enMora, prueba)).toBe(true);
    }
  });

  it('Una prueba cubre solo la prueba elegida', async () => {
    const id = await estudiante();
    await insertarSuscripcion(entorno.bd, {
      estudianteId: id,
      plan: 'Una prueba mensual',
      estado: 'activa',
      pruebas: [pruebas.M2],
    });

    expect(await cubre(id, pruebas.M2)).toBe(true);
    expect(await cubre(id, pruebas.M1)).toBe(false);
    expect(await cubre(id, pruebas.CL)).toBe(false);
  });

  it('pendiente, fallida, cancelada y vencida no cubren nada (RN-26)', async () => {
    const id = await estudiante();
    for (const estado of ['fallida', 'cancelada', 'vencida', 'pendiente']) {
      await insertarSuscripcion(entorno.bd, {
        estudianteId: id,
        plan: 'Todas las pruebas mensual',
        estado,
      });
    }

    expect(await cubre(id, pruebas.M1)).toBe(false);
  });

  it('la suscripción de otro estudiante no cubre a nadie más', async () => {
    const conPlan = await estudiante();
    const sinPlan = await estudiante();
    await insertarSuscripcion(entorno.bd, {
      estudianteId: conPlan,
      plan: 'Todas las pruebas mensual',
      estado: 'activa',
    });

    expect(await cubre(sinPlan, pruebas.M1)).toBe(false);
  });

  describe('al responder (CU-12 paso 6)', () => {
    beforeEach(async () => {
      await base.publicar(6, { prueba: 'M1', dificultad: 'media' });
    });

    it('con una suscripción activa que cubre la prueba no descuenta cupo ni saldo', async () => {
      const { id, token } = await base.sesion();
      await insertarSuscripcion(entorno.bd, {
        estudianteId: id,
        plan: 'Una prueba mensual',
        estado: 'activa',
        pruebas: [base.pruebaId],
      });
      await r.darSaldoExtra(id, 2);
      const hoy = await r.fechaDelReloj();
      await r.fijarCupo(id, hoy, 10, 10);
      const pregunta = await r.practicaConPregunta(token);

      const respuesta = await r.responderCon(token, pregunta, 'A');

      expect(respuesta.status).toBe(200);
      expect((await r.itemGuardado(pregunta.itemId))?.consumo).toBe('suscripcion');
      expect(await r.cupoDe(id, hoy)).toEqual({ maximo: 10, usadas: 10 });
      expect(await r.saldoExtra(id)).toBe(2);
    });

    it('con la suscripción en otra prueba, el cupo agotado sí rechaza la respuesta', async () => {
      const { id, token } = await base.sesion();
      await insertarSuscripcion(entorno.bd, {
        estudianteId: id,
        plan: 'Una prueba mensual',
        estado: 'activa',
        pruebas: [base.lectoraId],
      });
      const pregunta = await r.practicaConPregunta(token);
      await r.fijarCupo(id, await r.fechaDelReloj(), 10, 10);

      const respuesta = await r.responderCon(token, pregunta, 'A');

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.codigo).toBe('CUPO_AGOTADO');
    });
  });
});
