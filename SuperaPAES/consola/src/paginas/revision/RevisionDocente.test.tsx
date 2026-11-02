// D01 · Mis revisiones (HU-22.2 y HU-22.3, CU-19, CP-16 paso 3): la bandeja con la fecha límite, la
// pregunta a ciegas con la correcta y la explicación, la pauta con Sí/No y su observación, la dificultad,
// la decisión y el motivo; y las llamadas a la API de la bandeja.
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { camposVacios } from '../../estado/formulario-revision';
import type { RevisionDocente } from '../../estado/revision-docente';
import { responderUnaVez } from '../../pruebas/sesion';
import { entregarRevision, listarMisRevisiones, obtenerMiRevision } from '../../servicios/revision';
import type { PreguntaARevisar, RevisionPendiente } from '../../tipos';
import { ContenidoRevisionDocente } from './RevisionDocente';

afterEach(() => vi.unstubAllGlobals());

const sinAccion = () => undefined;

const pendiente = (id: number, preguntaId: number, venceEn: string): RevisionPendiente => ({
  id,
  preguntaId,
  ronda: 1,
  prueba: { codigo: 'M1', nombre: 'Competencia Matemática 1' },
  contenido: 'Figuras geométricas',
  venceEn,
});

const PREGUNTA: PreguntaARevisar = {
  ...pendiente(900, 244, '2026-10-22T15:00:00.000Z'),
  eje: 'Geometría',
  habilidad: 'Modelar',
  enunciado: 'Un triángulo rectángulo tiene catetos de 6 cm y 8 cm. ¿Cuál es su perímetro?',
  explicacion: 'La hipotenusa mide 10 cm, así que el perímetro es 24 cm.',
  alternativas: [
    { id: 1, letra: 'A', texto: '14 cm', explicacion: null, esCorrecta: false },
    { id: 2, letra: 'B', texto: '20 cm', explicacion: null, esCorrecta: false },
    { id: 3, letra: 'C', texto: '24 cm', explicacion: null, esCorrecta: true },
    { id: 4, letra: 'D', texto: '48 cm', explicacion: null, esCorrecta: false },
  ],
  texto: null,
  pauta: [
    { codigo: 'contenido', descripcion: 'La pregunta evalúa el contenido del temario.' },
    { codigo: 'habilidad', descripcion: 'La pregunta evalúa la habilidad indicada.' },
  ],
  dificultades: [
    { codigo: 'facil', nombre: 'Fácil' },
    { codigo: 'media', nombre: 'Media' },
    { codigo: 'dificil', nombre: 'Difícil' },
  ],
  decisiones: [
    { codigo: 'aprobar', nombre: 'Aprobar', requiereComentario: false },
    { codigo: 'observar', nombre: 'Observar', requiereComentario: true },
    { codigo: 'rechazar', nombre: 'Rechazar', requiereComentario: true },
  ],
};

const BANDEJA = [
  pendiente(900, 244, '2026-10-22T15:00:00.000Z'),
  pendiente(901, 251, '2026-10-23T15:00:00.000Z'),
];

function dibujar(cambios: Partial<RevisionDocente> = {}) {
  const revision: RevisionDocente = {
    bandeja: { tipo: 'lista', revisiones: BANDEJA },
    abierta: 900,
    revision: { tipo: 'lista', pregunta: PREGUNTA },
    campos: camposVacios(),
    errores: {},
    enviando: false,
    aviso: null,
    elegir: sinAccion,
    entregar: sinAccion,
    responder: sinAccion,
    observar: sinAccion,
    elegirDificultad: sinAccion,
    elegirDecision: sinAccion,
    escribirMotivo: sinAccion,
    ...cambios,
  };
  // Sin los separadores que React pone entre textos, para comparar el texto como se lee.
  return renderToString(<ContenidoRevisionDocente revision={revision} />).replaceAll(
    '<!-- -->',
    '',
  );
}

describe('D01 · bandeja (HU-22 esc. 1)', () => {
  it('muestra cada revisión con su código, prueba, contenido y fecha límite; la abierta va marcada', () => {
    const html = dibujar();

    expect(html).toContain('Bandeja (2)');
    expect(html).toMatch(/bandeja__item--abierta" aria-current="true">.*P-0244 · M1/);
    expect(html).toContain('P-0251 · M1');
    expect(html).toContain('Figuras geométricas');
    expect(html).toContain('<span class="bandeja__fecha">22-10-26</span>');
  });

  it('sin revisiones pendientes lo dice', () => {
    const html = dibujar({ bandeja: { tipo: 'lista', revisiones: [] }, abierta: null });

    expect(html).toContain('No tienes revisiones pendientes.');
    expect(html).not.toContain('Pauta');
  });
});

describe('D01 · la pregunta y la pauta (HU-22 esc. 2 y 3, CP-16 paso 3)', () => {
  it('muestra la pregunta completa con la correcta y la explicación, y nada de la dificultad sugerida', () => {
    const html = dibujar();

    expect(html).toContain(
      'P-0244 · Competencia Matemática 1 · Geometría · Figuras geométricas · Modelar',
    );
    expect(html).toMatch(/revision-alternativa--correcta">.*24 cm.*Correcta/);
    expect(html).toContain('La hipotenusa mide 10 cm');
    expect(html).toContain('No ves la dificultad sugerida ni la decisión del otro revisor.');
    expect(html).not.toMatch(/sugerida:/i);
  });

  it('cada punto de la pauta se responde con Sí o No; con No pide la observación', () => {
    const conNo = dibujar({
      campos: {
        ...camposVacios(),
        criterios: { habilidad: { cumple: false, observacion: 'Es un cálculo directo.' } },
      },
      errores: { 'criterios.habilidad': 'Escribe por qué no se cumple.' },
    });

    expect(conNo).toContain('<legend>La pregunta evalúa el contenido del temario.</legend>');
    expect(conNo.match(/type="radio" name="criterio-/g)).toHaveLength(4);
    expect(conNo).toContain('value="Es un cálculo directo."');
    expect(conNo).toContain('Escribe por qué no se cumple.');
    expect(dibujar()).not.toContain('Observación');
  });

  it('pide la dificultad, la decisión y el motivo, y muestra los errores y el de la API', () => {
    const html = dibujar({
      campos: { ...camposVacios(), dificultad: 'media', decision: 'observar' },
      errores: {
        comentario: 'Escribe el motivo para observar la pregunta.',
        general: 'Esta revisión ya se entregó.',
      },
    });

    expect(html).toMatch(/name="dificultad" checked="" value="media"/);
    expect(html).toMatch(/name="decision" checked="" value="observar"/);
    expect(html).toContain('Motivo (obligatorio al observar o rechazar)');
    expect(html).toContain('Escribe el motivo para observar la pregunta.');
    expect(html).toContain('Esta revisión ya se entregó.');
  });

  it('mientras guarda no se puede enviar de nuevo, y al terminar avisa', () => {
    expect(dibujar({ enviando: true })).toMatch(/disabled="">Guardando…<\/button>/);
    expect(dibujar({ aviso: 'Revisión de la pregunta 244 entregada.' })).toContain(
      'role="status">Revisión de la pregunta 244 entregada.',
    );
  });

  it('si la pregunta no se puede abrir, muestra el mensaje de la API', () => {
    const html = dibujar({
      revision: {
        tipo: 'fallida',
        codigo: 'NO_ENCONTRADO',
        mensaje: 'La revisión no existe o ya la entregaste.',
      },
    });

    expect(html).toContain('La revisión no existe o ya la entregaste.');
  });
});

describe('servicios de la bandeja (HU-22)', () => {
  const llamada = () => {
    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    return {
      url: (url as string).replace(/^.*\/api\/v1/, ''),
      metodo: init?.method ?? 'GET',
      cuerpo: init?.body,
    };
  };

  it('pide la bandeja y la pregunta, y entrega la revisión', async () => {
    responderUnaVez({ data: BANDEJA, error: null, meta: null });
    expect(await listarMisRevisiones()).toEqual(BANDEJA);
    expect(llamada()).toMatchObject({ url: '/admin/revision/mis-revisiones', metodo: 'GET' });

    responderUnaVez({ data: PREGUNTA, error: null, meta: null });
    expect(await obtenerMiRevision(900)).toEqual(PREGUNTA);
    expect(llamada()).toMatchObject({ url: '/admin/revision/mis-revisiones/900' });

    const datos = { criterios: [], dificultad: 'media', decision: 'aprobar', comentario: null };
    responderUnaVez({ data: { asignacionId: 900 }, error: null, meta: null }, 201);
    await entregarRevision(900, datos);
    expect(llamada()).toEqual({
      url: '/admin/revision/mis-revisiones/900',
      metodo: 'POST',
      cuerpo: JSON.stringify(datos),
    });
  });
});
