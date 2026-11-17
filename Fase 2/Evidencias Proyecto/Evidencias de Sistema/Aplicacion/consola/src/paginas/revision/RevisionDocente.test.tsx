// D01 · Mis revisiones (HU-22.2 y HU-22.3, CU-19, CP-16 paso 3): la bandeja con la fecha límite, la
// pregunta a ciegas con la correcta y la explicación, la pauta con Sí/No y su observación, la dificultad,
// la decisión y el motivo; y las llamadas a la API de la bandeja.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { camposVacios } from '../../estado/formulario-revision';
import type { RevisionDocente } from '../../estado/revision-docente';
import { formularioSinAcciones, OPCIONES_DE_DECISION } from '../../pruebas/bandeja-docente';
import { textoDibujado } from '../../pruebas/dibujo';
import { primeraLlamada, responderUnaVez } from '../../pruebas/sesion';
import { entregarRevision, listarMisRevisiones, obtenerMiRevision } from '../../servicios/revision';
import type { PreguntaARevisar, RevisionPendiente } from '../../tipos';
import { ContenidoRevisionDocente } from './RevisionDocente';

afterEach(() => vi.unstubAllGlobals());

const pendiente = (id: number, preguntaId: number, venceEn: string): RevisionPendiente => ({
  id,
  preguntaId,
  ronda: 1,
  prueba: { codigo: 'M1', nombre: 'Competencia Matemática 1' },
  contenido: 'Figuras geométricas',
  asignadoEn: '2026-10-20T15:00:00.000Z',
  venceEn,
});

const PREGUNTA: PreguntaARevisar = {
  ...pendiente(900, 244, '2026-10-22T15:00:00.000Z'),
  eje: 'Geometría',
  habilidad: 'Modelar',
  enunciado: 'Un triángulo rectángulo tiene catetos de 6 cm y 8 cm. ¿Cuál es su perímetro?',
  explicacion: 'La hipotenusa mide 10 cm, así que el perímetro es 24 cm.',
  maximoNoParaAprobar: 2,
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
  ...OPCIONES_DE_DECISION,
};

const BANDEJA = [
  pendiente(900, 244, '2026-10-22T15:00:00.000Z'),
  pendiente(901, 251, '2026-10-23T15:00:00.000Z'),
];

function dibujar(cambios: Partial<RevisionDocente> = {}, firma?: { quien: string; fecha: string }) {
  const revision: RevisionDocente = {
    bandeja: { tipo: 'lista', revisiones: BANDEJA },
    abierta: 900,
    revision: { tipo: 'lista', pregunta: PREGUNTA },
    ...formularioSinAcciones(),
    ...cambios,
  };
  return textoDibujado(<ContenidoRevisionDocente revision={revision} firma={firma} />);
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

  it('muestra el texto de lectura con su título y su imagen', () => {
    const conTexto = {
      ...PREGUNTA,
      texto: { titulo: 'El faro', contenido: null, imagenUrl: 'https://ejemplo.cl/faro.png' },
    };
    const html = dibujar({ revision: { tipo: 'lista', pregunta: conTexto } });

    expect(html).toContain('aria-label="Texto de lectura"><h3>El faro</h3>');
    expect(html).toContain(
      '<img class="formato__imagen" src="https://ejemplo.cl/faro.png" alt="El faro" loading="lazy"/>',
    );
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
    // Cada opción anuncia su atajo (aria-keyshortcuts va entre type y name al dibujarse).
    expect(conNo.match(/type="radio" [^>]*name="criterio-/g)).toHaveLength(4);
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

describe('D01 · el acta (folio, contador, atajos y firma)', () => {
  it('el folio lleva el código, la ronda, la fecha de asignación y la fecha límite; la firma, quién decide y la fecha', () => {
    const html = dibujar({}, { quien: 'Ana Pérez', fecha: '14 de noviembre de 2026' });

    expect(html).toMatch(/class="panel panel--ancho acta revision-acta revision-formulario"/);
    expect(html).toContain(
      '<p class="folio"><span>Acta <b>P-0244</b></span><span>revisión <b>1</b></span><span>asignada el <b>20-10-26</b></span><span>vence el <b>22-10-26</b></span></p>',
    );
    expect(html).toMatch(
      /<div class="firma"><p class="firma__quien">Firma <b>Ana Pérez<\/b> · 14 de noviembre de 2026<\/p><button type="submit"/,
    );
    expect(dibujar()).toContain('<p class="firma__quien">Firma <b>Docente</b></p>');
  });

  it('cuenta los criterios que faltan, con aria-live', () => {
    expect(dibujar()).toContain('aria-live="polite">Faltan 2 de 2 criterios</p>');
    const uno = dibujar({
      campos: { ...camposVacios(), criterios: { contenido: { cumple: true, observacion: '' } } },
    });
    expect(uno).toContain('Falta 1 de 2 criterios');
  });

  it('anuncia los atajos S y N en cada opción y en una nota con kbd', () => {
    const html = dibujar();

    expect(
      html.match(/type="radio" aria-keyshortcuts="S" name="criterio-[a-z]+" value="si"/g),
    ).toHaveLength(2);
    expect(
      html.match(/type="radio" aria-keyshortcuts="N" name="criterio-[a-z]+" value="no"/g),
    ).toHaveLength(2);
    expect(html).toContain('<kbd>S</kbd> marca Sí y <kbd>N</kbd> marca No');
    expect(html).not.toMatch(/name="dificultad"[^>]*aria-keyshortcuts/);
  });

  it('el motivo y la observación con error quedan marcados y descritos por su mensaje', () => {
    const html = dibujar({
      campos: {
        ...camposVacios(),
        criterios: { habilidad: { cumple: false, observacion: '' } },
      },
      errores: {
        comentario: 'Escribe el motivo para observar la pregunta.',
        'criterios.habilidad': 'Escribe por qué no se cumple.',
      },
    });

    expect(html).toMatch(
      /<textarea rows="3" aria-invalid="true" aria-describedby="error-comentario">/,
    );
    expect(html).toMatch(
      /<\/textarea><p id="error-comentario" class="campo__error" role="alert">Escribe el motivo/,
    );
    expect(html).toMatch(
      /aria-invalid="true" aria-describedby="error-criterio-habilidad" value=""\/><p id="error-criterio-habilidad"/,
    );
  });
});

describe('servicios de la bandeja (HU-22)', () => {
  it('pide la bandeja y la pregunta, y entrega la revisión', async () => {
    responderUnaVez({ data: BANDEJA, error: null, meta: null });
    expect(await listarMisRevisiones()).toEqual(BANDEJA);
    expect(primeraLlamada()).toMatchObject({
      url: '/admin/revision/mis-revisiones',
      metodo: 'GET',
    });

    responderUnaVez({ data: PREGUNTA, error: null, meta: null });
    expect(await obtenerMiRevision(900)).toEqual(PREGUNTA);
    expect(primeraLlamada()).toMatchObject({ url: '/admin/revision/mis-revisiones/900' });

    const datos = { criterios: [], dificultad: 'media', decision: 'aprobar', comentario: null };
    responderUnaVez({ data: { asignacionId: 900 }, error: null, meta: null }, 201);
    await entregarRevision(900, datos);
    expect(primeraLlamada()).toEqual({
      url: '/admin/revision/mis-revisiones/900',
      metodo: 'POST',
      cuerpo: JSON.stringify(datos),
    });
  });
});
