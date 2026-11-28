import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearServicios, type Servicios } from '../app.js';
import { ejecutarEnTransaccion } from '../db/transaccion.js';
import { esquemaRevision } from '../modulos/revision/revision.validadores.js';
import { esquemaConsultaSaldo } from '../modulos/revision/revision.saldo.validadores.js';
import { crearSaldoRepositorio } from '../modulos/revision/revision.saldo.repositorio.js';
import { crearDependenciasDePrueba } from './ayudantes.js';
import { type BaseTemporal, exigirBaseEnCi, MINUTO, urlBase } from './base-temporal.js';
import {
  crearCuenta,
  crearPreguntaDeHistoria,
  pautaActiva,
  prepararBaseDeRevision,
  serviciosSobre,
  temarioDeHistoria,
} from './revision-bd.js';

describe('preparación de pruebas de saldo', () => {
  exigirBaseEnCi();
});
describe.skipIf(!urlBase)('remuneración y capacidad con PostgreSQL', () => {
  let base: BaseTemporal;
  let servicios: Servicios;
  let pauta: string[];
  let secuencia = 0;
  beforeAll(async () => {
    ({ base, servicios } = await prepararBaseDeRevision('saldo'));
    pauta = await pautaActiva(base.bd);
  }, MINUTO);
  afterAll(async () => {
    await base.cerrar();
  }, MINUTO);
  const consultar = (docente: string, consulta = {}) =>
    servicios.revision.consultarSaldo(docente, esquemaConsultaSaldo.parse(consulta));
  function conReloj(ahora: Date) {
    return crearServicios(
      crearDependenciasDePrueba({
        bd: base.bd,
        reloj: () => ahora,
        unidadDeTrabajo: { enTransaccion: (trabajo) => ejecutarEnTransaccion(base.bd, trabajo) },
      }),
    );
  }
  async function escenario(cantidad = 2) {
    await base.bd.query(
      "UPDATE contenido.usuario_interno SET activo=false WHERE rol_id=(SELECT id FROM contenido.rol WHERE codigo='docente')",
    );
    await base.bd.query(
      "UPDATE contenido.configuracion SET valor='50' WHERE clave='max_revisiones_diarias_docente'",
    );
    const clave = ++secuencia;
    const admin = await crearCuenta(base.bd, [`admin${clave}@saldo.cl`, 'admin']);
    const docentes: string[] = [];
    for (let i = 0; i < cantidad; i++)
      docentes.push(
        await crearCuenta(base.bd, [`docente${clave}-${i}@saldo.cl`, 'docente'], ['Historia']),
      );
    const temario = await temarioDeHistoria(base.bd);
    const pregunta = async () =>
      crearPreguntaDeHistoria(servicios, temario, [admin, `Pregunta saldo ${clave}`]);
    return { admin, docentes, pregunta };
  }
  function datos(decision = 'aprobar', dificultad = 'media') {
    return esquemaRevision.parse({
      criterios: pauta.map((codigo) => ({ codigo, cumple: true })),
      decision,
      dificultad,
      comentario: decision === 'aprobar' ? null : 'Motivo válido.',
    });
  }
  it('una entrega válida genera 500 pesos y un reenvío no duplica el abono', async () => {
    const e = await escenario();
    const pregunta = await e.pregunta();
    const envio = await servicios.revision.enviarARevision(e.admin, pregunta);
    const a = envio.revisores[0]!;
    await servicios.revision.entregarRevision(a.docente.id, a.asignacionId, datos('observar'));
    expect((await consultar(a.docente.id)).resumen).toMatchObject({ totalClp: 500, cantidad: 1 });
    await expect(
      servicios.revision.entregarRevision(a.docente.id, a.asignacionId, datos()),
    ).rejects.toMatchObject({ estadoHttp: 409 });
    expect((await consultar(a.docente.id)).resumen.totalClp).toBe(500);
    await expect(
      servicios.revision.entregarRevision(
        envio.revisores[1]!.docente.id,
        envio.revisores[1]!.asignacionId,
        { ...datos(), criterios: [] },
      ),
    ).rejects.toMatchObject({ estadoHttp: 400 });
    expect((await consultar(envio.revisores[1]!.docente.id)).resumen.totalClp).toBe(0);
  });
  it('paga el desempate y la clasificación de dificultad', async () => {
    const e = await escenario(3);
    const pregunta = await e.pregunta();
    const envio = await servicios.revision.enviarARevision(e.admin, pregunta);
    for (const [indice, a] of envio.revisores.entries())
      await servicios.revision.entregarRevision(
        a.docente.id,
        a.asignacionId,
        datos(indice === 0 ? 'aprobar' : 'rechazar'),
      );
    const tercero = e.docentes.find(
      (docente) => !envio.revisores.some((a) => a.docente.id === docente),
    )!;
    const [desempate] = await servicios.revision.listarDesempates(tercero);
    await servicios.revision.entregarDesempate(tercero, desempate!.id, {
      decision: 'aprobar',
      dificultad: 'media',
      comentario: null,
    });
    expect((await consultar(tercero)).detalle).toEqual([
      expect.objectContaining({ tipo: 'desempate', montoClp: 500 }),
    ]);
    const importada = await e.pregunta();
    const imp = await base.bd.query<{ id: string }>(
      `INSERT INTO contenido.importacion(nombre_archivo, usuario_id, filas_total, filas_creadas, filas_con_error, creado_en)
      VALUES ('saldo.csv', $1, 1, 1, 0, now()) RETURNING id::text`,
      [e.admin],
    );
    await base.bd.query('UPDATE contenido.pregunta SET importacion_id=$1 WHERE id=$2', [
      imp.rows[0]!.id,
      importada,
    ]);
    const segundo = await servicios.revision.enviarARevision(e.admin, importada);
    const a = segundo.revisores[0]!;
    const antes = (await consultar(a.docente.id)).resumen.cantidad;
    await servicios.revision.clasificarDificultad(a.docente.id, a.asignacionId, 'media');
    expect((await consultar(a.docente.id)).resumen.cantidad).toBe(antes + 1);
  });
  it('conserva el monto histórico al cambiar la tarifa con vigencia', async () => {
    const e = await escenario();
    const pregunta = await e.pregunta();
    const envio = await servicios.revision.enviarARevision(e.admin, pregunta);
    const [a, b] = envio.revisores;
    await servicios.revision.entregarRevision(a!.docente.id, a!.asignacionId, datos());
    const futuras = new Date(Date.now() + 60_000);
    const historial = await servicios.revision.consultarTarifas();
    await servicios.revision.registrarTarifa(e.admin, {
      montoClp: 600,
      ultimaTarifaId: Number(historial.tarifas[0]!.id),
      vigenteDesde: futuras.toISOString(),
    });
    await conReloj(new Date(futuras.getTime() + 1000)).revision.entregarRevision(
      b!.docente.id,
      b!.asignacionId,
      datos(),
    );
    expect((await consultar(a!.docente.id)).resumen.totalClp).toBe(500);
    expect((await consultar(b!.docente.id)).resumen.totalClp).toBe(600);
    await expect(
      base.bd.query('UPDATE contenido.remuneracion_revision SET monto_clp=700'),
    ).rejects.toThrow('no se modifica');
    await expect(base.bd.query('DELETE FROM contenido.tarifa_revision')).rejects.toThrow(
      'no se modifica',
    );
  });
  it(
    'respeta 20 pendientes y permite reponer tras una entrega',
    async () => {
      const e = await escenario();
      const envios = [];
      for (let i = 0; i < 20; i++)
        envios.push(await servicios.revision.enviarARevision(e.admin, await e.pregunta()));
      await expect(
        servicios.revision.enviarARevision(e.admin, await e.pregunta()),
      ).rejects.toMatchObject({ estadoHttp: 409 });
      for (const a of envios[0]!.revisores)
        await servicios.revision.entregarRevision(a.docente.id, a.asignacionId, datos('observar'));
      await servicios.revision.enviarARevision(e.admin, await e.pregunta());
      expect((await consultar(e.docentes[0]!)).capacidad).toMatchObject({
        pendientes: 20,
        completadas: 1,
      });
    },
    MINUTO,
  );
  it('reserva el cupo diario entre pendientes y completadas y bloquea el exceso', async () => {
    const e = await escenario();
    await base.bd.query(
      "UPDATE contenido.configuracion SET valor='2' WHERE clave='max_revisiones_diarias_docente'",
    );
    const envios = [];
    for (let i = 0; i < 2; i++)
      envios.push(await servicios.revision.enviarARevision(e.admin, await e.pregunta()));
    await expect(
      servicios.revision.enviarARevision(e.admin, await e.pregunta()),
    ).rejects.toMatchObject({ estadoHttp: 409 });
    await base.bd.query(
      "UPDATE contenido.configuracion SET valor='1' WHERE clave='max_revisiones_diarias_docente'",
    );
    const a = envios[0]!.revisores[0]!;
    const b = envios[1]!.revisores[0]!;
    await servicios.revision.entregarRevision(a.docente.id, a.asignacionId, datos());
    await expect(
      servicios.revision.entregarRevision(b.docente.id, b.asignacionId, datos()),
    ).rejects.toMatchObject({ estadoHttp: 409 });
    expect((await consultar(b.docente.id)).resumen.cantidad).toBe(1);
    await base.bd.query(
      "UPDATE contenido.configuracion SET valor='50' WHERE clave='max_revisiones_diarias_docente'",
    );
  });
  it('dos entregas simultáneas de la misma asignación generan un solo abono', async () => {
    const e = await escenario();
    const envio = await servicios.revision.enviarARevision(e.admin, await e.pregunta());
    const a = envio.revisores[0]!;
    const otra = await base.conectarOtra();
    try {
      const resultados = await Promise.allSettled([
        servicios.revision.entregarRevision(a.docente.id, a.asignacionId, datos()),
        serviciosSobre(otra).revision.entregarRevision(a.docente.id, a.asignacionId, datos()),
      ]);
      expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect((await consultar(a.docente.id)).resumen.cantidad).toBe(1);
    } finally {
      await otra.end();
    }
  });
  it(
    'dos envíos simultáneos no superan las 20 pendientes',
    async () => {
      const e = await escenario();
      for (let i = 0; i < 19; i++)
        await servicios.revision.enviarARevision(e.admin, await e.pregunta());
      const primera = await e.pregunta();
      const segunda = await e.pregunta();
      const otra = await base.conectarOtra();
      try {
        const resultados = await Promise.allSettled([
          servicios.revision.enviarARevision(e.admin, primera),
          serviciosSobre(otra).revision.enviarARevision(e.admin, segunda),
        ]);
        expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        for (const docente of e.docentes)
          expect((await consultar(docente)).capacidad.pendientes).toBe(20);
      } finally {
        await otra.end();
      }
    },
    MINUTO,
  );
  it('una revisión anterior a la activación no recibe un abono retroactivo', async () => {
    const e = await escenario();
    const envio = await servicios.revision.enviarARevision(e.admin, await e.pregunta());
    const a = envio.revisores[0]!;
    const { tarifas } = await servicios.revision.consultarTarifas();
    const primera = tarifas.at(-1)!;
    await conReloj(new Date(primera.vigenteDesde.getTime() - 1000)).revision.entregarRevision(
      a.docente.id,
      a.asignacionId,
      datos(),
    );
    expect((await consultar(a.docente.id)).resumen.totalClp).toBe(0);
  });
  it('reanuda un desempate cuando vuelve a existir un docente con cupo', async () => {
    const e = await escenario(3);
    const envio = await servicios.revision.enviarARevision(e.admin, await e.pregunta());
    const tercero = e.docentes.find((id) => !envio.revisores.some((a) => a.docente.id === id))!;
    await base.bd.query('UPDATE contenido.usuario_interno SET activo=false WHERE id=$1', [tercero]);
    for (const [i, a] of envio.revisores.entries())
      await servicios.revision.entregarRevision(
        a.docente.id,
        a.asignacionId,
        datos(i === 0 ? 'aprobar' : 'rechazar'),
      );
    expect(await servicios.revision.listarDesempates(tercero)).toHaveLength(0);
    await base.bd.query('UPDATE contenido.usuario_interno SET activo=true WHERE id=$1', [tercero]);
    await servicios.revision.reintentarDesempates(e.admin);
    expect(await servicios.revision.listarDesempates(tercero)).toHaveLength(1);
  });
  it('filtra el detalle sin cambiar los acumulados y distingue el mes de Santiago', async () => {
    const e = await escenario();
    const envios = [];
    for (let i = 0; i < 2; i++)
      envios.push(await servicios.revision.enviarARevision(e.admin, await e.pregunta()));
    const fecha = new Date();
    const anio = fecha.getUTCFullYear();
    const mes = fecha.getUTCMonth() + 1;
    const antes = new Date(Date.UTC(anio, mes, 1, 2, 30));
    const despues = new Date(Date.UTC(anio, mes, 1, 5));
    const docente = envios[0]!.revisores[0]!.docente.id;
    for (const [i, envio] of envios.entries()) {
      const a = envio.revisores.find((r) => r.docente.id === docente)!;
      await conReloj(i === 0 ? antes : despues).revision.entregarRevision(
        docente,
        a.asignacionId,
        datos(),
      );
    }
    const repo = crearSaldoRepositorio(base.bd);
    const saldo = await repo.consultar(
      docente,
      esquemaConsultaSaldo.parse({ desde: despues.toISOString().slice(0, 10), porPagina: 1 }),
      despues,
    );
    expect(saldo!.resumen.cantidad).toBe(2);
    expect(saldo!.resumen.cantidadMes).toBe(1);
    expect(saldo!.detalle).toHaveLength(1);
    expect(saldo!.paginacion.total).toBe(1);
  });
});
