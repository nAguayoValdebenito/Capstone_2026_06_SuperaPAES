// Acciones en lote del banco (C02), para llenar la app de pruebas: los dos botones siempre están en la
// barra de acciones, dicen cuántas toma el próximo clic (hasta 10) y, sin ninguna, quedan deshabilitados
// con el motivo; el aviso dice lo hecho y lo que no; y las llamadas llevan los filtros del banco, clic
// tras clic, hasta que no queda ninguna.
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type AccionesEnLote, avisoDeLote, delProximoClic } from '../../estado/acciones-lote-banco';
import { primeraLlamada, responderUnaVez } from '../../pruebas/sesion';
import { contarLote, publicarSinRevision } from '../../servicios/preguntas';
import { enviarLoteARevision } from '../../servicios/revision';
import { BotonesEnLote } from './AccionesEnLote';

afterEach(() => vi.unstubAllGlobals());

const acciones = (cambios: Partial<AccionesEnLote> = {}): AccionesEnLote => ({
  conteo: { paraRevision: 23, paraPublicar: 7 },
  enCurso: null,
  aviso: null,
  porConfirmar: false,
  ejecutar: vi.fn(),
  confirmar: vi.fn(),
  cancelar: vi.fn(),
  ...cambios,
});

const dibujar = (cambios: Partial<AccionesEnLote> = {}) =>
  renderToString(<BotonesEnLote acciones={acciones(cambios)} />);

/** El HTML de cada botón (sin el diálogo, que se dibuja cerrado). */
const botones = (html: string) => html.match(/<button[^>]*>[^<]*<\/button>/g) ?? [];

describe('botones de las acciones en lote', () => {
  it('los dos botones siempre están y dicen cuántas toma el próximo clic, hasta 10', () => {
    const [enviar, publicar] = botones(dibujar());

    expect(enviar).toContain('>Enviar a revisión (10)</button>');
    expect(publicar).toContain('>Aceptar y publicar (7)</button>');
    expect(enviar).not.toContain('disabled');
    expect(publicar).not.toContain('disabled');
  });

  it('sin preguntas elegibles siguen ahí, deshabilitados y con el motivo', () => {
    const [enviar, publicar] = botones(dibujar({ conteo: { paraRevision: 0, paraPublicar: 0 } }));

    expect(enviar).toContain('disabled=""');
    expect(enviar).toContain('Enviar a revisión (0)');
    expect(enviar).toContain('No hay preguntas en borrador u observadas');
    expect(publicar).toContain('disabled=""');
    expect(publicar).toContain('Aceptar y publicar (0)');
  });

  it('mientras se cuentan, se muestran sin cantidad y se pueden usar', () => {
    const [enviar, publicar] = botones(dibujar({ conteo: null }));

    expect(enviar).toContain('>Enviar a revisión</button>');
    expect(publicar).toContain('>Aceptar y publicar</button>');
    expect(enviar).not.toContain('disabled');
  });

  it('mientras se hace una, las dos esperan', () => {
    const [enviar, publicar] = botones(dibujar({ enCurso: 'publicar' }));

    expect(enviar).toContain('disabled=""');
    expect(publicar).toContain('disabled=""');
    expect(publicar).toContain('>Publicando…</button>');
  });

  it('cada clic toma hasta 10: con 23 en borrador, 10, 10 y 3', () => {
    expect([23, 13, 3, 0].map(delProximoClic)).toEqual([10, 10, 3, 0]);
  });
});

describe('aviso de las acciones en lote', () => {
  it('dice cuántas se hicieron', () => {
    expect(avisoDeLote('enviar', 10, [])).toEqual({
      tipo: 'exito',
      texto: '10 preguntas enviadas a revisión.',
    });
    expect(avisoDeLote('publicar', 1, [])).toEqual({
      tipo: 'exito',
      texto: '1 pregunta publicada.',
    });
  });

  it('dice por qué no las demás, hasta tres', () => {
    const noHechas = [85, 86, 87, 88].map((id) => ({ id, motivo: 'Sin docentes.' }));

    expect(avisoDeLote('enviar', 6, noHechas).texto).toBe(
      '6 preguntas enviadas a revisión. No se pudo con la 85: Sin docentes. la 86: Sin docentes. ' +
        'la 87: Sin docentes. (y 1 más)',
    );
    expect(avisoDeLote('publicar', 0, noHechas.slice(0, 1)).tipo).toBe('error');
  });

  it('sin ninguna que procesar lo dice, sin error', () => {
    expect(avisoDeLote('publicar', 0, [])).toEqual({
      tipo: 'exito',
      texto: 'No quedan preguntas para publicar con estos filtros.',
    });
  });
});

describe('llamadas a la API de las acciones en lote, con los filtros del banco', () => {
  it('cuenta las que hay para cada acción', async () => {
    responderUnaVez({ data: { paraRevision: 3, paraPublicar: 5 }, error: null, meta: null });

    expect(await contarLote({ prueba: 2 })).toEqual({ paraRevision: 3, paraPublicar: 5 });
    expect(primeraLlamada()).toMatchObject({ url: '/admin/preguntas/lote/elegibles?prueba=2' });
  });

  it('envía a revisión las 10 siguientes del filtro', async () => {
    const lote = { enviadas: [], noEnviadas: [] };
    responderUnaVez({ data: lote, error: null, meta: null });

    expect(await enviarLoteARevision({ prueba: 2, estado: 'borrador' })).toEqual(lote);
    expect(primeraLlamada()).toMatchObject({
      url: '/admin/revision/preguntas/lote?prueba=2&estado=borrador',
      metodo: 'POST',
    });
  });

  it('publica sin revisión las 10 siguientes del filtro', async () => {
    const lote = { publicadas: [84], noPublicadas: [] };
    responderUnaVez({ data: lote, error: null, meta: null });

    expect(await publicarSinRevision({})).toEqual(lote);
    expect(primeraLlamada()).toMatchObject({
      url: '/admin/preguntas/publicacion-sin-revision',
      metodo: 'POST',
    });
  });
});
