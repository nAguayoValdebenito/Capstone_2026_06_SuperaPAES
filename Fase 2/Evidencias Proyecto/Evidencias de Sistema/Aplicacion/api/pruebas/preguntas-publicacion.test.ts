// Publicar, retirar y volver a borrador por HTTP (HU-24, CU-21, RF-G09, RF-G10, RN-13), sin PostgreSQL:
// el servicio real de preguntas con la etapa de cada pregunta en memoria. Que la pregunta retirada deje
// de llegar a la app y el historial están en preguntas-publicacion-bd.test.ts.
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type {
  EtapaDePregunta,
  PublicacionRepositorio,
} from '../modulos/preguntas/preguntas.publicacion.repositorio.js';
import { errorConFormato, tokenAdmin } from './ayudantes.js';
import { comoAdmin, escenarioEdicion, RUTA_PREGUNTAS } from './edicion-de-prueba.js';

const NOMBRES: Record<string, string> = {
  borrador: 'Borrador',
  aprobada: 'Aprobada',
  publicada: 'Publicada',
  retirada: 'Retirada',
};

const etapa = (codigo: string): EtapaDePregunta => ({
  estado: { codigo, nombre: NOMBRES[codigo] ?? codigo },
});

/** El error del trigger de la base al publicar una pregunta sin dificultad asignada (RN-13). */
const SIN_DIFICULTAD = 'Solo se publica una pregunta con dificultad asignada por los docentes';

/**
 * Preguntas 84 aprobada, 85 publicada, 86 retirada, 87 en borrador y 88 aprobada sin dificultad, que la
 * base no deja publicar.
 */
function escenario() {
  const etapas: Record<string, EtapaDePregunta> = {
    '84': etapa('aprobada'),
    '85': etapa('publicada'),
    '86': etapa('retirada'),
    '87': etapa('borrador'),
    '88': etapa('aprobada'),
  };
  const publicacion = {
    reservar: vi.fn((id: string) => Promise.resolve(etapas[id] ?? null)),
    cambiarEtapa: vi.fn((id: string, hacia: string) =>
      id === '88' && hacia === 'publicada'
        ? Promise.reject(Object.assign(new Error(SIN_DIFICULTAD), { code: 'P0001' }))
        : Promise.resolve({ codigo: hacia, nombre: NOMBRES[hacia] ?? hacia }),
    ),
  } satisfies PublicacionRepositorio;
  return { ...escenarioEdicion(publicacion), publicacion };
}

const cambiar = async (app: Parameters<typeof request>[0], id: string, accion: string) =>
  request(app)
    .post(`${RUTA_PREGUNTAS}/${id}/${accion}`)
    .set(await comoAdmin());

describe('publicar (HU-24 esc. 1 y 3, RN-13)', () => {
  it('publica una pregunta aprobada con dificultad y deja quién lo hizo en la auditoría', async () => {
    const { app, publicacion, repositorio, auditoria } = escenario();

    const respuesta = await cambiar(app, '84', 'publicar');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({
      id: 84,
      estado: { codigo: 'publicada', nombre: 'Publicada' },
    });
    expect(publicacion.cambiarEtapa).toHaveBeenCalledWith('84', 'publicada', expect.anything());
    expect(repositorio.fijarAutor).toHaveBeenCalledWith('5', expect.anything());
    expect(auditoria.registrarAuditoria).toHaveBeenCalledWith(
      {
        usuarioId: '5',
        accion: 'publicar_pregunta',
        entidad: 'pregunta',
        entidadId: '84',
        antes: { estado: 'aprobada' },
        despues: { estado: 'publicada' },
      },
      expect.anything(),
    );
  });

  it('solo publica preguntas aprobadas y con la dificultad que asignaron los docentes (409)', async () => {
    const { app, publicacion, auditoria } = escenario();

    const enBorrador = await cambiar(app, '87', 'publicar');
    const sinDificultad = await cambiar(app, '88', 'publicar');
    const yaPublicada = await cambiar(app, '85', 'publicar');

    expect(enBorrador.status).toBe(409);
    expect(enBorrador.body.error.mensaje).toBe(
      'La pregunta está «Borrador»: solo se publican preguntas aprobadas.',
    );
    expect(sinDificultad.status).toBe(409);
    expect(sinDificultad.body.error.mensaje).toBe(SIN_DIFICULTAD);
    expect(yaPublicada.status).toBe(409);
    expect(publicacion.cambiarEtapa).toHaveBeenCalledTimes(1);
    expect(auditoria.registrarAuditoria).not.toHaveBeenCalled();
  });
});

describe('retirar y volver a borrador (HU-24 esc. 2 y 3, RF-G09)', () => {
  it('retira una pregunta publicada y lo deja en la auditoría', async () => {
    const { app, auditoria } = escenario();

    const respuesta = await cambiar(app, '85', 'retirar');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.estado).toEqual({ codigo: 'retirada', nombre: 'Retirada' });
    expect(auditoria.registrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: '5', accion: 'retirar_pregunta', entidadId: '85' }),
      expect.anything(),
    );
  });

  it('solo retira preguntas publicadas', async () => {
    const { app } = escenario();

    const respuesta = await cambiar(app, '84', 'retirar');

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.mensaje).toBe(
      'La pregunta está «Aprobada»: solo se retiran preguntas publicadas.',
    );
  });

  it('una retirada vuelve a borrador para corregirla; queda en el historial, no en la auditoría', async () => {
    const { app, publicacion, repositorio, auditoria } = escenario();

    const respuesta = await cambiar(app, '86', 'borrador');
    const noRetirada = await cambiar(app, '85', 'borrador');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.estado).toEqual({ codigo: 'borrador', nombre: 'Borrador' });
    expect(publicacion.cambiarEtapa).toHaveBeenCalledWith('86', 'borrador', expect.anything());
    expect(repositorio.fijarAutor).toHaveBeenCalledWith('5', expect.anything());
    expect(auditoria.registrarAuditoria).not.toHaveBeenCalled();
    expect(noRetirada.status).toBe(409);
    expect(noRetirada.body.error.mensaje).toBe(
      'La pregunta está «Publicada»: solo vuelven a borrador las preguntas retiradas.',
    );
  });
});

describe('quién puede cambiar la etapa', () => {
  it('una pregunta que no existe da 404', async () => {
    const { app } = escenario();

    const respuesta = await cambiar(app, '999', 'publicar');

    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toEqual(errorConFormato('NO_ENCONTRADO'));
  });

  it.each(['publicar', 'retirar', 'borrador'])('el docente no puede %s (403)', async (accion) => {
    const { app, publicacion } = escenario();

    const respuesta = await request(app)
      .post(`${RUTA_PREGUNTAS}/84/${accion}`)
      .set({ Authorization: `Bearer ${await tokenAdmin('docente', '21')}` });

    expect(respuesta.status).toBe(403);
    expect(publicacion.reservar).not.toHaveBeenCalled();
  });
});
