// Acciones en lote del banco (C02), para llenar la app de pruebas: qué preguntas de la página toma cada
// botón (hasta 10), cuándo aparece «Aceptar y publicar sin revisión» (solo con el modo de pruebas de la
// API), el aviso con lo hecho y lo que no, y las llamadas a la API.
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type AccionesEnLote as Acciones,
  avisoDeLote,
  paraEnviar,
  paraPublicar,
} from '../../estado/acciones-lote-banco';
import { primeraLlamada, responderUnaVez } from '../../pruebas/sesion';
import { preguntaEnEtapa } from '../../pruebas/tabla-banco';
import { publicarSinRevision } from '../../servicios/preguntas';
import { enviarLoteARevision } from '../../servicios/revision';
import { AccionesEnLote } from './AccionesEnLote';

afterEach(() => vi.unstubAllGlobals());

const borradores = (cantidad: number) =>
  Array.from({ length: cantidad }, (_, i) => preguntaEnEtapa(i + 1, 'borrador', 'Borrador', true));

const PAGINA = [
  preguntaEnEtapa(1, 'borrador', 'Borrador', true),
  preguntaEnEtapa(2, 'observada', 'Observada', true),
  preguntaEnEtapa(3, 'en_revision', 'En revisión'),
  preguntaEnEtapa(4, 'publicada', 'Publicada'),
];

const acciones = (cambios: Partial<Acciones> = {}): Acciones => ({
  enCurso: null,
  aviso: null,
  porConfirmar: false,
  ejecutar: vi.fn(),
  confirmar: vi.fn(),
  cancelar: vi.fn(),
  ...cambios,
});

const dibujar = (modoPruebas: boolean, cambios: Partial<Acciones> = {}, preguntas = PAGINA) =>
  renderToString(
    <AccionesEnLote preguntas={preguntas} modoPruebas={modoPruebas} acciones={acciones(cambios)} />,
  );

describe('qué preguntas toma cada acción en lote', () => {
  it('enviar toma las que admiten el envío (borrador u observada); publicar, solo los borradores', () => {
    expect(paraEnviar(PAGINA)).toEqual([1, 2]);
    expect(paraPublicar(PAGINA)).toEqual([1]);
  });

  it('toma hasta 10 por clic, en el orden de la página', () => {
    expect(paraEnviar(borradores(12))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(paraPublicar(borradores(12))).toHaveLength(10);
  });
});

describe('botones de las acciones en lote', () => {
  it('sin el modo de pruebas solo ofrece enviar a revisión', () => {
    const html = dibujar(false);

    expect(html).toContain('Enviar a revisión (2)');
    expect(html).not.toContain('sin revisión');
  });

  it('con el modo de pruebas ofrece también aceptar y publicar sin revisión', () => {
    const html = dibujar(true);

    expect(html).toContain('Enviar a revisión (2)');
    expect(html).toContain('Aceptar y publicar sin revisión (1)');
    expect(html).toContain('hasta 10 por clic');
  });

  it('mientras se hace una, las dos esperan', () => {
    const html = dibujar(true, { enCurso: 'enviar' });

    expect(html).toContain('disabled="">Enviando…</button>');
    expect(html).toMatch(/disabled="">Aceptar y publicar sin revisión \(1\)<\/button>/);
  });

  it('sin preguntas que procesar en la página no muestra nada', () => {
    const html = dibujar(true, {}, [preguntaEnEtapa(4, 'publicada', 'Publicada')]);

    expect(html).toBe('');
  });
});

describe('aviso de las acciones en lote', () => {
  it('dice cuántas se hicieron y por qué no las demás', () => {
    expect(avisoDeLote('enviar', 2, [{ id: 85, motivo: 'Sin docentes de Historia.' }])).toEqual({
      tipo: 'exito',
      texto: '2 preguntas quedaron en revisión. No se pudo con la 85: Sin docentes de Historia.',
    });
    expect(avisoDeLote('publicar', 1, [])).toEqual({
      tipo: 'exito',
      texto: '1 pregunta quedó publicada sin revisión: ya llegan a la app.',
    });
  });

  it('si no se pudo con ninguna, es un error', () => {
    expect(avisoDeLote('publicar', 0, [{ id: 7, motivo: 'No está en borrador.' }]).tipo).toBe(
      'error',
    );
  });
});

describe('llamadas a la API de las acciones en lote', () => {
  it('envía a revisión el lote', async () => {
    const lote = { enviadas: [], noEnviadas: [{ id: 85, motivo: 'Sin docentes.' }] };
    responderUnaVez({ data: lote, error: null, meta: null });

    expect(await enviarLoteARevision([84, 85])).toEqual(lote);
    expect(primeraLlamada()).toMatchObject({
      url: '/admin/revision/preguntas/lote',
      metodo: 'POST',
      cuerpo: JSON.stringify({ ids: [84, 85] }),
    });
  });

  it('publica sin revisión el lote', async () => {
    const lote = { publicadas: [84], noPublicadas: [] };
    responderUnaVez({ data: lote, error: null, meta: null });

    expect(await publicarSinRevision([84])).toEqual(lote);
    expect(primeraLlamada()).toMatchObject({
      url: '/admin/preguntas/publicacion-sin-revision',
      metodo: 'POST',
      cuerpo: JSON.stringify({ ids: [84] }),
    });
  });
});
