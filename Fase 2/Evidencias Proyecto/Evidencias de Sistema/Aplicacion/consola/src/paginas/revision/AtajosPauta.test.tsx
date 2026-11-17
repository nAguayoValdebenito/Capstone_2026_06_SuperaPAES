// @vitest-environment jsdom
// D01 · los atajos S y N con interacción real: la tecla sobre la opción enfocada de un criterio responde
// ese criterio; escribiendo la observación no actúa.
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { camposVacios } from '../../estado/formulario-revision';
import type { RevisionDocente } from '../../estado/revision-docente';
import { formularioSinAcciones, OPCIONES_DE_DECISION } from '../../pruebas/bandeja-docente';
import { tecla, usarPantallaDePrueba } from '../../pruebas/interaccion';
import type { PreguntaARevisar } from '../../tipos';
import { FormularioRevision } from './FormularioRevision';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PREGUNTA: PreguntaARevisar = {
  id: 900,
  preguntaId: 244,
  ronda: 1,
  prueba: { codigo: 'M1', nombre: 'Competencia Matemática 1' },
  contenido: 'Figuras geométricas',
  asignadoEn: '2026-10-20T15:00:00.000Z',
  venceEn: '2026-10-22T15:00:00.000Z',
  eje: 'Geometría',
  habilidad: 'Modelar',
  enunciado: '¿Cuál es el perímetro?',
  explicacion: 'Es 24 cm.',
  alternativas: [],
  texto: null,
  maximoNoParaAprobar: 2,
  pauta: [
    { codigo: 'contenido', descripcion: 'Evalúa el contenido.' },
    { codigo: 'habilidad', descripcion: 'Evalúa la habilidad.' },
  ],
  ...OPCIONES_DE_DECISION,
};

describe('D01 · atajos S y N del criterio enfocado', () => {
  const pantalla = usarPantallaDePrueba();

  function dibujar(responder: RevisionDocente['responder'], campos = camposVacios()) {
    const revision = {
      bandeja: { tipo: 'lista', revisiones: [] },
      abierta: 900,
      revision: { tipo: 'lista', pregunta: PREGUNTA },
      ...formularioSinAcciones(),
      campos,
      responder,
    } as RevisionDocente;
    act(() =>
      pantalla.raiz.render(
        <FormularioRevision
          pregunta={PREGUNTA}
          revision={revision}
          firma={{ quien: 'Docente', fecha: '' }}
        />,
      ),
    );
  }

  const opcion = (nombre: string, valor: string) =>
    pantalla.contenedor.querySelector<HTMLInputElement>(
      `input[name="criterio-${nombre}"][value="${valor}"]`,
    )!;

  it('S y N responden el criterio que tiene el foco', async () => {
    const responder = vi.fn();
    dibujar(responder);

    act(() => opcion('habilidad', 'si').focus());
    await tecla('n');
    await tecla('S');

    expect(responder.mock.calls).toEqual([
      ['habilidad', false],
      ['habilidad', true],
    ]);
  });

  it('en la observación, S y N se escriben y no cambian la respuesta', async () => {
    const responder = vi.fn();
    dibujar(responder, {
      ...camposVacios(),
      criterios: { contenido: { cumple: false, observacion: '' } },
    });

    const observacion = pantalla.contenedor.querySelector<HTMLInputElement>(
      '.pauta__observacion input',
    )!;
    act(() => observacion.focus());
    await tecla('s');

    expect(responder).not.toHaveBeenCalled();
  });
});

describe('D01 · aprobar con criterios en «No» (RN-11)', () => {
  const pantalla = usarPantallaDePrueba();

  function dibujar(maximo: number, respuestas: Record<string, boolean>, decision: string | null) {
    const pregunta = { ...PREGUNTA, maximoNoParaAprobar: maximo };
    const campos = {
      ...camposVacios(),
      decision,
      criterios: Object.fromEntries(
        Object.entries(respuestas).map(([codigo, cumple]) => [
          codigo,
          { cumple, observacion: cumple ? '' : 'No se cumple.' },
        ]),
      ),
    };
    const revision = {
      bandeja: { tipo: 'lista', revisiones: [] },
      abierta: 900,
      revision: { tipo: 'lista', pregunta },
      ...formularioSinAcciones(),
      campos,
    } as RevisionDocente;
    act(() =>
      pantalla.raiz.render(
        <FormularioRevision
          pregunta={pregunta}
          revision={revision}
          firma={{ quien: 'Docente', fecha: '' }}
        />,
      ),
    );
  }

  const decisionDe = (valor: string) =>
    pantalla.contenedor.querySelector<HTMLInputElement>(
      `input[name="decision"][value="${valor}"]`,
    )!;

  it('dice cuántos «No» permiten aprobar y cuántos lleva', () => {
    dibujar(1, { contenido: false }, null);
    expect(pantalla.contenedor.querySelector('.revision-acta__limite')?.textContent).toContain(
      'Se aprueba con hasta 1 «No»; llevas 1.',
    );
  });

  it('con los «No» permitidos se puede aprobar y no hay aviso', () => {
    dibujar(1, { contenido: false, habilidad: true }, 'aprobar');
    expect(decisionDe('aprobar').disabled).toBe(false);
    expect(pantalla.contenedor.textContent).not.toContain('No se puede aprobar.');
  });

  it('con más «No» que el máximo «Aprobar» queda deshabilitada y se explica; observar y rechazar siguen', () => {
    dibujar(1, { contenido: false, habilidad: false }, null);
    expect(decisionDe('aprobar').disabled).toBe(true);
    expect(decisionDe('observar').disabled).toBe(false);
    expect(decisionDe('rechazar').disabled).toBe(false);
    expect(pantalla.contenedor.textContent).toContain(
      'No se puede aprobar. Tienes 2 criterios en «No» y se aprueba con 1 como máximo',
    );
  });
});
