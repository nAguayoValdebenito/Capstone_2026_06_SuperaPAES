// Reglas del formulario de la revisión docente (D01, HU-22.3, CU-19 pasos 3 a 5): las mismas que revisa
// la API, para avisar antes de enviar.
import { describe, expect, it } from 'vitest';
import { ErrorApi } from '../api/cliente';
import {
  armarRevision,
  type CamposRevision,
  camposVacios,
  erroresDeApi,
  validarRevision,
} from './formulario-revision';

const PREGUNTA = {
  pauta: [
    { codigo: 'contenido', descripcion: 'Evalúa el contenido.' },
    { codigo: 'enunciado', descripcion: 'El enunciado es claro.' },
  ],
  decisiones: [
    { codigo: 'aprobar', nombre: 'Aprobar', requiereComentario: false },
    { codigo: 'observar', nombre: 'Observar', requiereComentario: true },
    { codigo: 'rechazar', nombre: 'Rechazar', requiereComentario: true },
  ],
};

const completa = (cambios: Partial<CamposRevision> = {}): CamposRevision => ({
  criterios: {
    contenido: { cumple: true, observacion: '' },
    enunciado: { cumple: true, observacion: '' },
  },
  dificultad: 'media',
  decision: 'aprobar',
  comentario: '',
  ...cambios,
});

describe('validar la revisión', () => {
  it('una revisión completa que aprueba no tiene errores', () => {
    expect(validarRevision(completa(), PREGUNTA)).toEqual({});
  });

  it('vacía pide la pauta, la dificultad y la decisión', () => {
    expect(validarRevision(camposVacios(), PREGUNTA)).toEqual({
      criterios: 'Responde los 2 puntos de la pauta.',
      dificultad: 'Elige la dificultad que asignas.',
      decision: 'Elige si apruebas, observas o rechazas la pregunta.',
    });
  });

  it('cada punto que no se cumple necesita su observación', () => {
    const campos = completa({
      criterios: {
        contenido: { cumple: true, observacion: '' },
        enunciado: { cumple: false, observacion: '   ' },
      },
    });

    expect(validarRevision(campos, PREGUNTA)).toEqual({
      'criterios.enunciado': 'Escribe por qué no se cumple.',
    });
  });

  it('observar o rechazar exige el motivo (CU-19 5.a); aprobar no', () => {
    expect(validarRevision(completa({ decision: 'observar' }), PREGUNTA)).toEqual({
      comentario: 'Escribe el motivo para observar la pregunta.',
    });
    expect(
      validarRevision(completa({ decision: 'rechazar', comentario: 'Mal planteada.' }), PREGUNTA),
    ).toEqual({});
  });
});

describe('armar la revisión para la API', () => {
  it('va en el orden de la pauta, sin observación en los que se cumplen y con los textos limpios', () => {
    const campos = completa({
      criterios: {
        enunciado: { cumple: false, observacion: '  Tiene dos lecturas. ' },
        contenido: { cumple: true, observacion: 'se escribió antes de marcar Sí' },
      },
      decision: 'observar',
      comentario: '  Aclarar el enunciado. ',
    });

    expect(armarRevision(campos, PREGUNTA.pauta)).toEqual({
      criterios: [
        { codigo: 'contenido', cumple: true, observacion: null },
        { codigo: 'enunciado', cumple: false, observacion: 'Tiene dos lecturas.' },
      ],
      dificultad: 'media',
      decision: 'observar',
      comentario: 'Aclarar el enunciado.',
    });
  });

  it('sin motivo envía null', () => {
    expect(armarRevision(completa(), PREGUNTA.pauta).comentario).toBeNull();
  });
});

describe('errores de la API', () => {
  it('cada problema va bajo su campo', () => {
    const error = new ErrorApi(400, 'VALIDACION', 'Los datos no son válidos.', [
      { lugar: 'cuerpo', ruta: 'criterios.enunciado', mensaje: 'Escribe por qué no se cumple.' },
      { lugar: 'cuerpo', ruta: 'comentario', mensaje: 'Escribe el motivo.' },
    ]);

    expect(erroresDeApi(error)).toEqual({
      'criterios.enunciado': 'Escribe por qué no se cumple.',
      comentario: 'Escribe el motivo.',
    });
  });

  it('lo que no es de un campo, como una revisión ya entregada, va arriba', () => {
    const error = new ErrorApi(409, 'CONFLICTO', 'Esta revisión ya se entregó.');

    expect(erroresDeApi(error)).toEqual({ general: 'Esta revisión ya se entregó.' });
  });
});
