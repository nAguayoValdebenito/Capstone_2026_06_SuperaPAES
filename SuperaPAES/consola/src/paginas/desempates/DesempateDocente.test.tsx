// D02 · Desempates (HU-23, CU-20, RN-11 y RN-12): la bandeja del tercer docente, la pregunta con las dos
// revisiones de la ronda (sin quién las escribió), el aviso de posiblemente confusa y su decisión con la
// dificultad final; y las llamadas a la API de los desempates.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DesempateDocente } from '../../estado/desempate-docente';
import { camposVacios } from '../../estado/formulario-revision';
import { formularioSinAcciones, OPCIONES_DE_DECISION } from '../../pruebas/bandeja-docente';
import { textoDibujado } from '../../pruebas/dibujo';
import { primeraLlamada, responderUnaVez } from '../../pruebas/sesion';
import { entregarDesempate, listarDesempates, obtenerDesempate } from '../../servicios/revision';
import type { DesempateAbierto, RevisionDelRevisor } from '../../tipos';
import { ContenidoDesempateDocente } from './DesempateDocente';

afterEach(() => vi.unstubAllGlobals());

const PENDIENTE = {
  id: 950,
  preguntaId: 244,
  ronda: 1,
  prueba: { codigo: 'M1', nombre: 'Competencia Matemática 1' },
  contenido: 'Figuras geométricas',
  venceEn: '2026-10-22T15:00:00.000Z',
};

const PAUTA = [
  { codigo: 'contenido', descripcion: 'La pregunta evalúa el contenido del temario.' },
  { codigo: 'enunciado', descripcion: 'El enunciado es claro.' },
];

const revisionDe = (
  decision: string,
  dificultad: string,
  comentario: string | null,
  observacion: string | null,
): RevisionDelRevisor => ({
  decision: { codigo: decision.toLowerCase(), nombre: decision },
  dificultad: { codigo: dificultad.toLowerCase(), nombre: dificultad },
  comentario,
  criterios: PAUTA.map((criterio, i) => ({
    ...criterio,
    cumple: i === 0 || observacion === null,
    observacion: i === 0 ? null : observacion,
  })),
});

const DESEMPATE: DesempateAbierto = {
  ...PENDIENTE,
  eje: 'Geometría',
  habilidad: 'Modelar',
  enunciado: '¿Cuál es el perímetro de un cuadrado de lado 6 cm?',
  explicacion: 'Cuatro lados de 6 cm suman 24 cm.',
  alternativas: [
    { id: 1, letra: 'A', texto: '12 cm', explicacion: null, esCorrecta: false },
    { id: 2, letra: 'B', texto: '24 cm', explicacion: null, esCorrecta: true },
  ],
  texto: null,
  ...OPCIONES_DE_DECISION,
  revisiones: [
    revisionDe('Aprobar', 'Fácil', null, null),
    revisionDe('Rechazar', 'Difícil', 'Tiene dos respuestas.', 'Se puede leer de dos formas.'),
  ],
  posibleAmbigua: true,
};

function dibujar(cambios: Partial<DesempateDocente> = {}) {
  const desempate: DesempateDocente = {
    bandeja: { tipo: 'lista', revisiones: [PENDIENTE] },
    abierta: 950,
    revision: { tipo: 'lista', pregunta: DESEMPATE },
    ...formularioSinAcciones(),
    ...cambios,
  };
  return textoDibujado(<ContenidoDesempateDocente desempate={desempate} />);
}

describe('D02 · bandeja de desempates (HU-23 esc. 3)', () => {
  it('muestra cada desempate con su código, prueba y fecha límite', () => {
    const html = dibujar();

    expect(html).toContain('aria-label="Bandeja de desempates"');
    expect(html).toContain('P-0244 · M1');
    expect(html).toContain('<span class="bandeja__fecha">22-10-26</span>');
  });

  it('sin desempates pendientes lo dice', () => {
    const html = dibujar({ bandeja: { tipo: 'lista', revisiones: [] }, abierta: null });

    expect(html).toContain('No tienes desempates pendientes.');
    expect(html).not.toContain('Revisiones de la ronda');
  });
});

describe('D02 · la pregunta y las dos revisiones (CU-20, RN-12)', () => {
  it('muestra la pregunta con la correcta y las dos revisiones, sin quién las escribió', () => {
    const html = dibujar();

    expect(html).toMatch(/revision-alternativa--correcta">.*24 cm.*Correcta/);
    expect(html).toContain('aria-label="Revisión 1"');
    expect(html).toContain('aria-label="Revisión 2"');
    expect(html).toMatch(/Revisión 1.*<dd>Aprobar<\/dd>.*<dd>Fácil<\/dd>/);
    expect(html).toMatch(
      /Revisión 2.*<dd>Rechazar<\/dd>.*<dd>Difícil<\/dd>.*<dd>Tiene dos respuestas\.<\/dd>/,
    );
    expect(html).toMatch(
      /revision-ronda__punto--no.*El enunciado es claro\..*Se puede leer de dos formas\./,
    );
    // Sin datos de quién revisó (la clase revision-docente es del diseño, no de una persona).
    expect(html).not.toMatch(/correo|@|sugerida:/i);
  });

  it('avisa cuando una dijo fácil y la otra difícil, y no avisa si no', () => {
    expect(dibujar()).toContain(
      'Posiblemente confusa: una revisión la consideró fácil y la otra difícil.',
    );
    const sinAviso = dibujar({
      revision: { tipo: 'lista', pregunta: { ...DESEMPATE, posibleAmbigua: false } },
    });
    expect(sinAviso).not.toContain('Posiblemente confusa');
  });

  it('decide la dificultad final, la decisión y el motivo, sin pauta que responder', () => {
    const html = dibujar({
      campos: { ...camposVacios(), dificultad: 'dificil', decision: 'rechazar' },
      errores: { comentario: 'Escribe el motivo para rechazar la pregunta.' },
    });

    expect(html).toContain('<legend>Dificultad final</legend>');
    expect(html).toMatch(/name="dificultad" checked="" value="dificil"/);
    expect(html).toMatch(/name="decision" checked="" value="rechazar"/);
    expect(html).toContain('Escribe el motivo para rechazar la pregunta.');
    expect(html).toContain('Guardar decisión');
    expect(html).not.toContain('name="criterio-');
  });

  it('mientras guarda no se puede enviar de nuevo, y al terminar avisa', () => {
    expect(dibujar({ enviando: true })).toMatch(/disabled="">Guardando…<\/button>/);
    expect(dibujar({ aviso: 'Desempate de la pregunta 244 entregado.' })).toContain(
      'role="status">Desempate de la pregunta 244 entregado.',
    );
  });
});

describe('servicios de los desempates (HU-23)', () => {
  it('pide la bandeja y el desempate, y entrega la decisión', async () => {
    responderUnaVez({ data: [PENDIENTE], error: null, meta: null });
    expect(await listarDesempates()).toEqual([PENDIENTE]);
    expect(primeraLlamada()).toMatchObject({ url: '/admin/revision/desempates', metodo: 'GET' });

    responderUnaVez({ data: DESEMPATE, error: null, meta: null });
    expect(await obtenerDesempate(950)).toEqual(DESEMPATE);
    expect(primeraLlamada()).toMatchObject({ url: '/admin/revision/desempates/950' });

    const datos = { dificultad: 'dificil', decision: 'aprobar', comentario: null };
    responderUnaVez(
      { data: { asignacionId: 950, estado: 'aprobada' }, error: null, meta: null },
      201,
    );
    await entregarDesempate(950, datos);
    expect(primeraLlamada()).toEqual({
      url: '/admin/revision/desempates/950',
      metodo: 'POST',
      cuerpo: JSON.stringify(datos),
    });
  });
});
