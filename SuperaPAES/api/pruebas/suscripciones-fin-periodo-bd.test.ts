// A-03, RN-04, RN-26 y CU-12 1.a, contra PostgreSQL real: una suscripción activa da acceso hasta el fin del
// período pagado, más un día de margen para esperar el aviso de la tienda (el mismo del cierre de respaldo de
// HU-45.1). Así no da acceso para siempre si el aviso no llega. En mora sigue con acceso aunque el período ya
// haya terminado: es justo cuando la tienda reintenta el cobro (RN-26).
import { beforeAll, describe, expect, it } from 'vitest';
import { FabricaProveedores } from '../adaptadores/fabrica.js';
import {
  crearSuscripcionesServicio,
  type SuscripcionesServicio,
} from '../modulos/suscripciones/index.js';
import { exigirBaseEnCi, urlBase } from './base-temporal.js';
import { crearEstudianteDePrueba } from './estudiantes-de-prueba.js';
import { prepararRespuestas } from './respuestas-de-prueba.js';
import { insertarSuscripcion } from './suscripciones-de-prueba.js';

const AHORA = new Date('2026-11-20T12:00:00.000Z');
const HORA = 3_600_000;
const antes = (horas: number) => new Date(AHORA.getTime() - horas * HORA);

exigirBaseEnCi();
describe.skipIf(!urlBase)('fin del período pagado con PostgreSQL (A-03)', () => {
  const r = prepararRespuestas('fin_periodo');
  const { base, entorno } = r;
  let servicio: SuscripcionesServicio;
  let m1: number;

  beforeAll(async () => {
    const reloj = () => AHORA;
    servicio = crearSuscripcionesServicio({
      bd: entorno.bd,
      unidadDeTrabajo: { enTransaccion: (trabajo) => trabajo(entorno.bd) },
      reloj,
      pagos: FabricaProveedores.pagos({ proveedor: 'simulado' }, reloj),
    });
    const { rows } = await entorno.bd.query<{ id: number }>(
      "SELECT id FROM contenido.prueba WHERE codigo = 'M1'",
    );
    m1 = rows[0]?.id ?? 0;
  });

  let siguiente = 0;
  async function conPlan(estado: string, periodoFin?: Date) {
    const estudianteId = await crearEstudianteDePrueba(entorno.bd, {
      correo: `fin${String(++siguiente)}@ejemplo.cl`,
      contrasena: 'clave-para-practicar',
    });
    await insertarSuscripcion(entorno.bd, {
      estudianteId,
      plan: 'Todas las pruebas mensual',
      estado,
      ...(periodoFin ? { periodoFin } : {}),
    });
    return {
      cubre: await servicio.cubrePrueba(estudianteId, m1, entorno.bd),
      ensayo: await servicio.permiteEnsayoCompleto(estudianteId, entorno.bd),
    };
  }
  const conAcceso = { cubre: true, ensayo: true };
  const sinAcceso = { cubre: false, ensayo: false };

  it('una activa con el período en curso da acceso', async () => {
    expect(await conPlan('activa', new Date(AHORA.getTime() + HORA))).toEqual(conAcceso);
  });

  it('el último día de margen todavía da acceso, a la espera del aviso de la tienda', async () => {
    expect(await conPlan('activa', antes(23))).toEqual(conAcceso);
    expect(await conPlan('activa', antes(24))).toEqual(conAcceso);
  });

  it('pasado el margen, una activa sin aviso de la tienda ya no da acceso', async () => {
    expect(await conPlan('activa', antes(25))).toEqual(sinAcceso);
  });

  it('en mora sigue con acceso aunque el período haya terminado (RN-26)', async () => {
    expect(await conPlan('en_mora', antes(24 * 10))).toEqual(conAcceso);
  });

  it('sin fin de período guardado se sigue por el estado', async () => {
    expect(await conPlan('activa')).toEqual(conAcceso);
  });

  it('al responder con el período terminado se descuenta cupo como en el plan Gratis', async () => {
    await base.publicar(5, { prueba: 'M1', dificultad: 'media' });
    const { id, token } = await base.sesion();
    await insertarSuscripcion(entorno.bd, {
      estudianteId: id,
      plan: 'Todas las pruebas mensual',
      estado: 'activa',
      periodoFin: new Date(entorno.ahora().getTime() - 3 * 24 * HORA),
    });
    const pregunta = await r.practicaConPregunta(token);

    expect((await r.responderCon(token, pregunta)).status).toBe(200);

    expect((await r.itemGuardado(pregunta.itemId))?.consumo).toBe('cupo');
  });
});
