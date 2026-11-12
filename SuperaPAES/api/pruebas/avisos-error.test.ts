// Bandeja y cierre de los avisos de error por HTTP (HU-50.1, RF-C08, CU-26, C13), sin PostgreSQL: el
// servicio real de preguntas con los avisos en memoria. El filtro, el orden, la fecha y quién cerró cada
// aviso contra la base real están en avisos-error-bd.test.ts.
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type {
  AvisosRepositorio,
  FilaAviso,
  FilaGrupoAvisos,
} from '../modulos/preguntas/preguntas.avisos.repositorio.js';
import { errorConFormato, tokenAdmin, tokenApp } from './ayudantes.js';
import { comoAdmin, escenarioEdicion, M1, problemas, RUTA_PREGUNTAS } from './edicion-de-prueba.js';

const RUTA_AVISOS = `${RUTA_PREGUNTAS}/avisos`;
const PENDIENTE = { codigo: 'pendiente', nombre: 'Pendiente' };
const RESUELTO = { codigo: 'resuelto', nombre: 'Resuelto' };
const RESPUESTA = { codigo: 'respuesta', nombre: 'La respuesta correcta está mal' };

const aviso = (id: string, cambios: Partial<FilaAviso> = {}): FilaAviso => ({
  id,
  version: 2,
  motivo: RESPUESTA,
  comentario: 'Creo que la correcta es la C.',
  estado: PENDIENTE,
  creadoEn: '2026-10-20T13:00:00+00:00',
  resueltoEn: null,
  resueltoPor: null,
  ...cambios,
});

/** La pregunta 205 de M1 con dos avisos pendientes (41 y 42) y el aviso 43, ya resuelto. */
const GRUPO: FilaGrupoAvisos = {
  preguntaId: '205',
  versionActual: 3,
  estado: { codigo: 'publicada', nombre: 'Publicada' },
  contenidoId: M1.contenidoId,
  resumen: 'Si $2x + 3 = 11$, ¿cuánto vale $x$?',
  pendientes: 2,
  avisos: [aviso('42'), aviso('41')],
};

function escenario() {
  const estados: Record<string, { estado: typeof PENDIENTE; final: boolean }> = {
    '41': { estado: PENDIENTE, final: false },
    '42': { estado: PENDIENTE, final: false },
    '43': { estado: RESUELTO, final: true },
  };
  const avisos = {
    listarAvisos: vi.fn(() => Promise.resolve({ filas: [GRUPO], total: 1 })),
    motivosDeAviso: vi.fn(() => Promise.resolve([RESPUESTA, { codigo: 'otro', nombre: 'Otro' }])),
    reservarAviso: vi.fn((id: string) => Promise.resolve(estados[id] ?? null)),
    cerrarAviso: vi.fn((id: string, [estado]: [string, string]) =>
      Promise.resolve(
        aviso(id, {
          estado: { codigo: estado, nombre: estado === 'resuelto' ? 'Resuelto' : 'Descartado' },
          resueltoEn: '2026-10-21T15:30:00+00:00',
          resueltoPor: 'Ana Admin',
        }),
      ),
    ),
  } satisfies AvisosRepositorio;
  return { ...escenarioEdicion(undefined, avisos), avisos };
}

describe('bandeja de avisos (HU-50 esc. 1)', () => {
  it('lista los pendientes por defecto, agrupados por pregunta y con el acceso a ella', async () => {
    const { app, avisos } = escenario();

    const respuesta = await request(app)
      .get(RUTA_AVISOS)
      .set(await comoAdmin());

    expect(respuesta.status).toBe(200);
    expect(avisos.listarAvisos).toHaveBeenCalledWith({
      estado: 'pendiente',
      motivo: null,
      limite: 20,
      desde: 0,
    });
    expect(respuesta.body.meta).toEqual({ pagina: 1, porPagina: 20, total: 1 });
    expect(respuesta.body.data).toEqual([
      {
        pregunta: {
          id: 205,
          versionActual: 3,
          estado: { codigo: 'publicada', nombre: 'Publicada' },
          prueba: { id: M1.pruebaId, codigo: 'M1', nombre: 'Competencia Matemática 1' },
          contenido: { id: M1.contenidoId, nombre: 'Ecuaciones' },
          resumen: GRUPO.resumen,
        },
        pendientes: 2,
        avisos: [
          expect.objectContaining({ id: 42, creadoEn: '2026-10-20T13:00:00.000Z' }),
          expect.objectContaining({ id: 41, version: 2, motivo: RESPUESTA }),
        ],
      },
    ]);
  });

  it('nunca entrega datos del estudiante que avisó', async () => {
    const { app } = escenario();

    const respuesta = await request(app)
      .get(RUTA_AVISOS)
      .set(await comoAdmin());

    const cuerpo = respuesta.body as { data: { avisos: Record<string, unknown>[] }[] };
    expect(Object.keys(cuerpo.data[0]?.avisos[0] ?? {}).sort()).toEqual([
      'comentario',
      'creadoEn',
      'estado',
      'id',
      'motivo',
      'resueltoEn',
      'resueltoPor',
      'version',
    ]);
  });

  it('filtra por estado y motivo, y «todos» no filtra el estado', async () => {
    const { app, avisos } = escenario();

    await request(app)
      .get(`${RUTA_AVISOS}?estado=todos&motivo=respuesta&pagina=2&porPagina=10`)
      .set(await comoAdmin());

    expect(avisos.listarAvisos).toHaveBeenCalledWith({
      estado: null,
      motivo: 'respuesta',
      limite: 10,
      desde: 10,
    });
  });

  it('rechaza un estado o un motivo que no existen (400)', async () => {
    const { app, avisos } = escenario();

    const estado = await request(app)
      .get(`${RUTA_AVISOS}?estado=abierto`)
      .set(await comoAdmin());
    const motivo = await request(app)
      .get(`${RUTA_AVISOS}?motivo=ortografia`)
      .set(await comoAdmin());

    expect(estado.status).toBe(400);
    expect(problemas(estado)).toEqual([
      'estado: El estado debe ser pendiente, resuelto, descartado o todos.',
    ]);
    expect(motivo.status).toBe(400);
    expect(problemas(motivo)).toEqual(['motivo: El motivo no existe.']);
    expect(avisos.listarAvisos).not.toHaveBeenCalled();
  });
});

describe('cerrar un aviso (HU-50 esc. 2)', () => {
  it('lo cierra como resuelto a nombre del administrador y lo deja en la auditoría', async () => {
    const { app, avisos, auditoria } = escenario();

    const respuesta = await request(app)
      .patch(`${RUTA_AVISOS}/41`)
      .set(await comoAdmin())
      .send({ estado: 'resuelto' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual(
      expect.objectContaining({
        id: 41,
        estado: RESUELTO,
        resueltoEn: '2026-10-21T15:30:00.000Z',
        resueltoPor: 'Ana Admin',
      }),
    );
    expect(avisos.cerrarAviso).toHaveBeenCalledWith('41', ['resuelto', '5'], expect.anything());
    expect(auditoria.registrarAuditoria).toHaveBeenCalledWith(
      {
        usuarioId: '5',
        accion: 'atender_reporte',
        entidad: 'reporte_pregunta',
        entidadId: '41',
        antes: { estado: 'pendiente' },
        despues: { estado: 'resuelto' },
      },
      expect.anything(),
    );
  });

  it('solo cierra ese aviso, no los demás de la misma pregunta', async () => {
    const { app, avisos } = escenario();

    await request(app)
      .patch(`${RUTA_AVISOS}/42`)
      .set(await comoAdmin())
      .send({ estado: 'descartado' });

    expect(avisos.cerrarAviso).toHaveBeenCalledTimes(1);
    expect(avisos.cerrarAviso).toHaveBeenCalledWith('42', ['descartado', '5'], expect.anything());
  });

  it('un aviso que no existe da 404 y uno ya cerrado da 409, sin auditoría', async () => {
    const { app, avisos, auditoria } = escenario();

    const inexistente = await request(app)
      .patch(`${RUTA_AVISOS}/999`)
      .set(await comoAdmin())
      .send({ estado: 'resuelto' });
    const cerrado = await request(app)
      .patch(`${RUTA_AVISOS}/43`)
      .set(await comoAdmin())
      .send({ estado: 'descartado' });

    expect(inexistente.status).toBe(404);
    expect(inexistente.body).toEqual(errorConFormato('NO_ENCONTRADO'));
    expect(cerrado.status).toBe(409);
    expect(cerrado.body.error.mensaje).toBe('El aviso ya está «Resuelto».');
    expect(avisos.cerrarAviso).not.toHaveBeenCalled();
    expect(auditoria.registrarAuditoria).not.toHaveBeenCalled();
  });

  it('solo se cierra como resuelto o descartado (400)', async () => {
    const { app } = escenario();

    const respuesta = await request(app)
      .patch(`${RUTA_AVISOS}/41`)
      .set(await comoAdmin())
      .send({ estado: 'pendiente' });

    expect(respuesta.status).toBe(400);
    expect(problemas(respuesta)).toEqual([
      'estado: El aviso se cierra como resuelto o descartado.',
    ]);
  });
});

describe('quién atiende los avisos', () => {
  it.each([
    ['GET', ''],
    ['PATCH', '/41'],
  ])('el docente no puede usar %s (403)', async (metodo, ruta) => {
    const { app, avisos } = escenario();
    const docente = { Authorization: `Bearer ${await tokenAdmin('docente', '21')}` };

    const pedido =
      metodo === 'GET'
        ? request(app).get(`${RUTA_AVISOS}${ruta}`)
        : request(app).patch(`${RUTA_AVISOS}${ruta}`).send({ estado: 'resuelto' });
    const respuesta = await pedido.set(docente);

    expect(respuesta.status).toBe(403);
    expect(avisos.listarAvisos).not.toHaveBeenCalled();
    expect(avisos.reservarAviso).not.toHaveBeenCalled();
  });

  it('el token de la app no sirve en la consola (401)', async () => {
    const { app } = escenario();

    const respuesta = await request(app)
      .get(RUTA_AVISOS)
      .set({ Authorization: `Bearer ${await tokenApp('7')}` });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body).toEqual(errorConFormato('NO_AUTENTICADO'));
  });
});
