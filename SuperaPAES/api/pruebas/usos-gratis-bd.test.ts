import { describe, expect, it } from 'vitest';
import { crearServicios } from '../app.js';
import { crearDependenciasDePrueba } from './ayudantes.js';
import { prepararPracticas } from './base-practicas.js';
import { evaluacionConTiempo, publicadas } from './evaluaciones-con-tiempo.js';

const urlBase = process.env['DATABASE_URL_PRUEBAS'];

describe.skipIf(!urlBase)('usos gratis por la interfaz de cupo (HU-40.1)', () => {
  const base = prepararPracticas('usos_mini');
  const { entorno } = base;

  async function datos(estudianteId: string) {
    const [evaluacionId = ''] = await evaluacionConTiempo(entorno.bd, {
      estudianteId,
      pruebaId: base.pruebaId,
      tipo: 'mini_ensayo',
      preguntas: await publicadas(entorno.bd, 1),
    });
    const { rows } = await entorno.bd.query<{ estructuraId: number }>(
      'SELECT estructura_id AS "estructuraId" FROM app.evaluacion WHERE id=$1',
      [evaluacionId],
    );
    return {
      estudianteId,
      pruebaId: base.pruebaId,
      evaluacionId,
      estructuraId: rows[0]!.estructuraId,
    };
  }

  function cupo(cubierta = false) {
    return crearServicios(
      crearDependenciasDePrueba({ bd: entorno.bd, cubrePrueba: () => Promise.resolve(cubierta) }),
    ).cupoInvitaciones;
  }

  it('usa el mes de Chile y registra una sola vez la misma evaluación', async () => {
    const { id } = await base.sesion();
    const uso = await datos(id);
    const servicio = cupo();
    expect(servicio).toHaveProperty('registrarUsoGratis');
    // En UTC ya es noviembre, pero Chile aún está en octubre.
    await servicio.registrarUsoGratis(
      { ...uso, ahora: new Date('2026-11-01T02:59:59Z') },
      entorno.bd,
    );
    await servicio.registrarUsoGratis(
      { ...uso, ahora: new Date('2026-11-01T03:00:01Z') },
      entorno.bd,
    );
    const { rows } = await entorno.bd.query<{ periodo: string; total: number }>(
      "SELECT to_char(periodo,'YYYY-MM-DD') AS periodo, count(*)::int AS total FROM app.uso_gratis GROUP BY periodo",
    );
    expect(rows).toEqual([{ periodo: '2026-10-01', total: 1 }]);
  });

  it('rechaza el segundo uso del mes, pero admite el mes siguiente en Chile', async () => {
    const { id } = await base.sesion();
    const primero = await datos(id);
    const servicio = cupo();
    expect(servicio).toHaveProperty('registrarUsoGratis');
    await servicio.registrarUsoGratis(
      { ...primero, ahora: new Date('2026-11-01T02:59:59Z') },
      entorno.bd,
    );
    await entorno.bd.query("SELECT app.cerrar_evaluacion($1,'entregada')", [primero.evaluacionId]);
    const segundo = await datos(id);
    await expect(
      servicio.registrarUsoGratis(
        { ...segundo, ahora: new Date('2026-11-01T02:59:59Z') },
        entorno.bd,
      ),
    ).rejects.toMatchObject({
      estadoHttp: 409,
      codigo: 'USO_GRATIS_AGOTADO',
      detalles: {
        motivo: 'limite_mensual',
        opciones: ['esperar_proximo_mes', 'ver_planes'],
      },
    });
    await servicio.registrarUsoGratis(
      { ...segundo, ahora: new Date('2026-11-01T03:00:01Z') },
      entorno.bd,
    );
    const { rows } = await entorno.bd.query(
      'SELECT periodo FROM app.uso_gratis WHERE estudiante_id=$1',
      [id],
    );
    expect(rows).toHaveLength(2);
  });

  it('una prueba cubierta no registra uso gratis', async () => {
    const { id } = await base.sesion();
    const uso = await datos(id);
    const servicio = cupo(true);
    expect(servicio).toHaveProperty('registrarUsoGratis');
    await servicio.registrarUsoGratis({ ...uso, ahora: new Date() }, entorno.bd);
    expect((await entorno.bd.query('SELECT * FROM app.uso_gratis')).rows).toHaveLength(0);
  });
});
