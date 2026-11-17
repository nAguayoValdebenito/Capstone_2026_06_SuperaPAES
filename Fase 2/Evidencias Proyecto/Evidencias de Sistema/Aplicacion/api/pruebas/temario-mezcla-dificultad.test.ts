// Edición de la mezcla global de dificultad (C09, RF-C12, RN-09; decisión del 14/11/2026) sin
// PostgreSQL: el servicio real de temario con las dificultades en memoria, una transacción falsa y la
// auditoría falsa. Lo que hace la base (CHECK y trigger dificultad_suma) está en
// temario-mezcla-dificultad-bd.test.ts.
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { EntradaAuditoria } from '../modulos/administracion/administracion.repositorio.js';
import type {
  DificultadLista,
  MezclaDificultad,
  TemarioListasRepositorio,
} from '../modulos/temario/temario.listas.repositorio.js';
import { crearTemarioServicio } from '../modulos/temario/temario.servicio.js';
import type { Ejecutor } from '../db/transaccion.js';
import {
  crearAppDePrueba,
  crearDependenciasDePrueba,
  errorConFormato,
  tokenAdmin,
  tokenApp,
} from './ayudantes.js';

const RUTA = '/api/v1/admin/temario/listas-opciones/dificultades';

const INICIALES: DificultadLista[] = [
  { codigo: 'facil', nombre: 'Fácil', minimo: 25, objetivo: 30, maximo: 35 },
  { codigo: 'media', nombre: 'Media', minimo: 40, objetivo: 45, maximo: 50 },
  { codigo: 'dificil', nombre: 'Difícil', minimo: 20, objetivo: 25, maximo: 30 },
];

/** La mezcla 35/40/25, válida. */
const NUEVA: MezclaDificultad[] = [
  { codigo: 'facil', minimo: 30, objetivo: 35, maximo: 40 },
  { codigo: 'media', minimo: 35, objetivo: 40, maximo: 45 },
  { codigo: 'dificil', minimo: 20, objetivo: 25, maximo: 30 },
];

function escenario() {
  const TX = { query: vi.fn() } as unknown as Ejecutor;
  let filas = INICIALES.map((fila) => ({ ...fila }));
  const listas = {
    dificultades: vi.fn(() => Promise.resolve(filas.map((fila) => ({ ...fila })))),
    reservarDificultades: vi.fn(() => Promise.resolve(filas.map((fila) => ({ ...fila })))),
    actualizarMezcla: vi.fn((mezcla: readonly MezclaDificultad[]) => {
      filas = filas.map((fila) => ({ ...fila, ...mezcla.find((m) => m.codigo === fila.codigo) }));
      return Promise.resolve();
    }),
    areasCarrera: vi.fn(() => Promise.resolve([])),
    tiposEvaluacion: vi.fn(() => Promise.resolve([])),
    opciones: vi.fn(() => Promise.resolve([])),
  } satisfies TemarioListasRepositorio;
  const auditoria: { entrada: EntradaAuditoria; tx: Ejecutor }[] = [];
  const registrarAuditoria = vi.fn((entrada: EntradaAuditoria, tx: Ejecutor) => {
    auditoria.push({ entrada, tx });
    return Promise.resolve();
  });
  const enTransaccion = vi.fn(<T>(trabajo: (tx: Ejecutor) => Promise<T>) =>
    trabajo(TX),
  ) as unknown as <T>(trabajo: (tx: Ejecutor) => Promise<T>) => Promise<T>;
  const temario = crearTemarioServicio({
    ...crearDependenciasDePrueba(),
    unidadDeTrabajo: { enTransaccion },
    repositorioListas: listas,
    administracion: { registrarAuditoria },
  });
  return { app: crearAppDePrueba({}, { temario }), listas, auditoria, enTransaccion, TX };
}

const comoAdmin = async () => ({ Authorization: `Bearer ${await tokenAdmin('admin', '5')}` });

const enviar = async (app: ReturnType<typeof escenario>['app'], cuerpo: unknown) =>
  request(app)
    .put(RUTA)
    .set(await comoAdmin())
    .send(cuerpo as object);

const conCambio = (i: number, cambio: Partial<MezclaDificultad>) =>
  NUEVA.map((fila, j) => (j === i ? { ...fila, ...cambio } : fila));

const mensajes = (respuesta: { body: { error: { detalles: { mensaje: string }[] } } }) =>
  respuesta.body.error.detalles.map((d) => d.mensaje);

describe('PUT /admin/temario/listas-opciones/dificultades: permisos', () => {
  it('el administrador guarda la mezcla y recibe las dificultades como en el GET', async () => {
    const e = escenario();

    const respuesta = await enviar(e.app, { dificultades: NUEVA });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      data: [
        { codigo: 'facil', nombre: 'Fácil', minimo: 30, objetivo: 35, maximo: 40 },
        { codigo: 'media', nombre: 'Media', minimo: 35, objetivo: 40, maximo: 45 },
        { codigo: 'dificil', nombre: 'Difícil', minimo: 20, objetivo: 25, maximo: 30 },
      ],
      error: null,
      meta: null,
    });
  });

  it('sin sesión responde 401 y no cambia nada', async () => {
    const e = escenario();
    const respuesta = await request(e.app).put(RUTA).send({ dificultades: NUEVA });
    expect(respuesta.status).toBe(401);
    expect(e.listas.actualizarMezcla).not.toHaveBeenCalled();
  });

  it('un docente recibe 403 SIN_PERMISO', async () => {
    const e = escenario();
    const respuesta = await request(e.app)
      .put(RUTA)
      .auth(await tokenAdmin('docente'), { type: 'bearer' })
      .send({ dificultades: NUEVA });
    expect(respuesta.status).toBe(403);
    expect(respuesta.body).toEqual(errorConFormato('SIN_PERMISO'));
    expect(e.enTransaccion).not.toHaveBeenCalled();
  });

  it('un token de estudiante no sirve', async () => {
    const e = escenario();
    const respuesta = await request(e.app)
      .put(RUTA)
      .auth(await tokenApp(), { type: 'bearer' })
      .send({ dificultades: NUEVA });
    expect(respuesta.status).toBe(401);
  });
});

describe('PUT /admin/temario/listas-opciones/dificultades: auditoría', () => {
  it('registra editar_catalogo con antes y después en la misma transacción del cambio', async () => {
    const e = escenario();

    await enviar(e.app, { dificultades: NUEVA });

    expect(e.enTransaccion).toHaveBeenCalledTimes(1);
    expect(e.listas.reservarDificultades).toHaveBeenCalledWith(e.TX);
    expect(e.listas.actualizarMezcla).toHaveBeenCalledWith(NUEVA, e.TX);
    expect(e.auditoria).toEqual([
      {
        tx: e.TX,
        entrada: {
          usuarioId: '5',
          accion: 'editar_catalogo',
          entidad: 'dificultad',
          entidadId: 'mezcla',
          antes: { dificultades: INICIALES.map(({ nombre: _, ...fila }) => fila) },
          despues: { dificultades: NUEVA },
        },
      },
    ]);
  });
});

describe('PUT /admin/temario/listas-opciones/dificultades: validación (400 VALIDACION)', () => {
  it.each([
    ['un número no entero', conCambio(0, { minimo: 25.5 }), 'El mínimo debe ser un número entero.'],
    ['un número bajo 0', conCambio(0, { minimo: -1 }), 'El mínimo va de 0 a 100.'],
    ['un número sobre 100', conCambio(1, { maximo: 101 }), 'El máximo va de 0 a 100.'],
    [
      'un texto en vez de número',
      conCambio(2, { objetivo: '25' as never }),
      'Indica el objetivo como un número.',
    ],
  ])('rechaza %s', async (_caso, dificultades, mensaje) => {
    const e = escenario();
    const respuesta = await enviar(e.app, { dificultades });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION');
    expect(respuesta.body.error.detalles).toContainEqual(
      expect.objectContaining({ lugar: 'cuerpo', mensaje }),
    );
    expect(e.enTransaccion).not.toHaveBeenCalled();
  });

  it.each([
    ['sin lista', {}],
    ['con la lista vacía', { dificultades: [] }],
    ['con un campo de más', { dificultades: NUEVA, otro: 1 }],
  ])('rechaza el cuerpo %s', async (_caso, cuerpo) => {
    const e = escenario();
    const respuesta = await enviar(e.app, cuerpo);
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION');
  });

  it.each([
    [
      'mínimo mayor que el objetivo',
      conCambio(0, { minimo: 36 }),
      'En «facil» el mínimo no puede pasar del objetivo ni el objetivo del máximo.',
    ],
    [
      'objetivo mayor que el máximo',
      [
        { codigo: 'facil', minimo: 30, objetivo: 35, maximo: 34 },
        { codigo: 'media', minimo: 35, objetivo: 40, maximo: 45 },
        { codigo: 'dificil', minimo: 20, objetivo: 25, maximo: 30 },
      ],
      'En «facil» el mínimo no puede pasar del objetivo ni el objetivo del máximo.',
    ],
    [
      'objetivos que no suman 100',
      conCambio(1, { objetivo: 41 }),
      'Los objetivos deben sumar 100 (suman 101).',
    ],
    [
      'mínimos que suman más de 100',
      [
        { codigo: 'facil', minimo: 35, objetivo: 35, maximo: 40 },
        { codigo: 'media', minimo: 40, objetivo: 40, maximo: 45 },
        { codigo: 'dificil', minimo: 26, objetivo: 25, maximo: 30 },
      ],
      'Los mínimos no pueden sumar más de 100.',
    ],
    [
      'máximos que suman menos de 100',
      [
        { codigo: 'facil', minimo: 30, objetivo: 35, maximo: 35 },
        { codigo: 'media', minimo: 35, objetivo: 40, maximo: 40 },
        { codigo: 'dificil', minimo: 20, objetivo: 25, maximo: 24 },
      ],
      'Los máximos deben sumar al menos 100.',
    ],
    ['una dificultad que falta', NUEVA.slice(0, 2), 'Faltan las dificultades: dificil.'],
    [
      'una dificultad que no existe',
      [...NUEVA, { codigo: 'extrema', minimo: 0, objetivo: 0, maximo: 0 }],
      'La dificultad «extrema» no existe.',
    ],
    [
      'una dificultad repetida',
      [...NUEVA, { codigo: 'media', minimo: 0, objetivo: 0, maximo: 0 }],
      '«media» viene repetida.',
    ],
  ])('rechaza %s sin cambiar nada ni auditar', async (_caso, dificultades, mensaje) => {
    const e = escenario();
    const respuesta = await enviar(e.app, { dificultades });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION');
    expect(mensajes(respuesta)).toContain(mensaje);
    expect(respuesta.body.error.detalles[0]).toEqual({
      lugar: 'cuerpo',
      ruta: expect.stringMatching(/^dificultades/) as string,
      mensaje: expect.any(String) as string,
    });
    expect(e.listas.actualizarMezcla).not.toHaveBeenCalled();
    expect(e.auditoria).toEqual([]);
  });

  it('acepta los bordes: 0 y 100, objetivo igual al mínimo y al máximo', async () => {
    const e = escenario();
    const respuesta = await enviar(e.app, {
      dificultades: [
        { codigo: 'facil', minimo: 0, objetivo: 0, maximo: 0 },
        { codigo: 'media', minimo: 100, objetivo: 100, maximo: 100 },
        { codigo: 'dificil', minimo: 0, objetivo: 0, maximo: 0 },
      ],
    });
    expect(respuesta.status).toBe(200);
  });
});

describe('temario sin auditoría', () => {
  it('un temario creado sin administracion (solo lectura) no edita la mezcla', async () => {
    const temario = crearTemarioServicio(crearDependenciasDePrueba());
    await expect(temario.editarMezclaDificultad('5', NUEVA)).rejects.toThrow();
  });
});
