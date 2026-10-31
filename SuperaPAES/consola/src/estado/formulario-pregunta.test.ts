// Reglas del formulario C03 (HU-12.3, RN-08, RF-G09): alternativas según la prueba, una sola correcta,
// texto de lectura en Competencia Lectora, lo que se envía y los errores de la API bajo cada campo.
import { describe, expect, it } from 'vitest';
import { ErrorApi } from '../api/cliente';
import { CL, M1, M2 } from '../pruebas/temario';
import type { PreguntaParaEditar } from '../tipos';
import {
  armarDatos,
  type CamposPregunta,
  camposDePregunta,
  camposVacios,
  cambiarCantidad,
  conPrueba,
  erroresDeApi,
  validarCampos,
} from './formulario-pregunta';

/** Una pregunta de la prueba lista para enviar: contenido, habilidad, textos y la correcta. */
function completa(prueba = M1, cambios: Partial<CamposPregunta> = {}): CamposPregunta {
  const base = conPrueba(camposVacios(), prueba);
  return {
    ...base,
    ejeId: prueba.ejes[0]?.id,
    contenidoId: prueba.ejes[0]?.contenidos[0]?.id,
    habilidadId: prueba.habilidades[0]?.id,
    enunciado: '  Si $2x = 8$, ¿cuánto vale $x$?  ',
    explicacion: 'Se divide por 2.',
    alternativas: base.alternativas.map((a, i) => ({ ...a, texto: String(i + 3) })),
    correcta: 'B',
    ...cambios,
  };
}

const letras = (campos: CamposPregunta) => campos.alternativas.map((a) => a.letra).join('');

describe('alternativas según la prueba (RN-08)', () => {
  it('elegir la prueba limpia eje, contenido y habilidad, y elige su primer tipo de pregunta', () => {
    const campos = conPrueba({ ...completa(M2), ejeId: 31, contenidoId: 310, habilidadId: 50 }, M1);

    expect(campos).toMatchObject({
      pruebaId: 2,
      ejeId: undefined,
      contenidoId: undefined,
      habilidadId: undefined,
      tipoPregunta: 'seleccion_multiple',
    });
  });

  it('M2 agrega y quita la E; no pasa de 5 ni baja de 4', () => {
    const cuatro = completa(M2);
    const cinco = cambiarCantidad(cuatro, M2, true);

    expect(letras(cinco)).toBe('ABCDE');
    expect(letras(cambiarCantidad(cinco, M2, true))).toBe('ABCDE');
    expect(letras(cambiarCantidad(cinco, M2, false))).toBe('ABCD');
    expect(letras(cambiarCantidad(cuatro, M2, false))).toBe('ABCD');
  });

  it('M1 lleva 4 fijas: no se agrega la E', () => {
    expect(letras(cambiarCantidad(completa(M1), M1, true))).toBe('ABCD');
  });

  it('pasar de M2 con 5 a M1 quita la E y su marca de correcta, sin perder lo escrito', () => {
    const conE = { ...cambiarCantidad(completa(M2), M2, true), correcta: 'E' as const };

    const enM1 = conPrueba(conE, M1);

    expect(letras(enM1)).toBe('ABCD');
    expect(enM1.correcta).toBeUndefined();
    expect(enM1.alternativas[0]?.texto).toBe('3');
  });
});

describe('validación antes de enviar (mismos mensajes que la API)', () => {
  it('un formulario vacío dice qué falta en cada campo', () => {
    expect(validarCampos(camposVacios(), undefined)).toEqual({
      pruebaId: 'Elige la prueba.',
      contenidoId: 'Elige el eje y el contenido.',
      habilidadId: 'Elige la habilidad.',
      enunciado: 'Escribe el enunciado.',
      explicacion: 'Escribe la explicación de la respuesta correcta.',
      alternativas: 'Escribe el texto de la alternativa A.',
    });
  });

  it('sin la correcta marcada', () => {
    expect(validarCampos(completa(M1, { correcta: undefined }), M1)).toEqual({
      alternativas: 'Marca la alternativa correcta.',
    });
  });

  it('una completa de M1 no tiene errores', () => {
    expect(validarCampos(completa(M1), M1)).toEqual({});
  });

  it('Competencia Lectora exige su texto de lectura (esc. 2)', () => {
    expect(validarCampos(completa(CL), CL)).toEqual({
      textoEstimuloId: 'En Competencia Lectora cada pregunta va con su texto de lectura.',
    });
  });

  it('un texto nuevo pide su tipo, su título y su contenido o imagen, y el orden', () => {
    const texto = { ...completa(CL).texto, modo: 'nuevo' as const, orden: '0' };
    const sinTitulo = { ...texto, nuevo: { ...texto.nuevo, tipoTexto: 'literario' } };

    expect(validarCampos(completa(CL, { texto }), CL)).toEqual({
      textoNuevo: 'Elige el tipo de texto.',
      ordenEnTexto: 'Indica el orden de la pregunta en el texto.',
    });
    expect(validarCampos(completa(CL, { texto: sinTitulo }), CL).textoNuevo).toBe(
      'Escribe el título del texto.',
    );
  });
});

describe('lo que se envía a la API', () => {
  it('M1: sin texto de lectura, una sola correcta, textos sin espacios y sin dificultad sugerida', () => {
    const datos = armarDatos(completa(M1), M1);

    expect(datos).toMatchObject({
      pruebaId: 2,
      contenidoId: 100,
      habilidadId: 30,
      tipoPregunta: 'seleccion_multiple',
      dificultadSugerida: null,
      enunciado: 'Si $2x = 8$, ¿cuánto vale $x$?',
      textoEstimuloId: null,
      textoNuevo: null,
      ordenEnTexto: null,
    });
    expect(datos.alternativas.filter((a) => a.esCorrecta).map((a) => a.letra)).toEqual(['B']);
  });

  it('Competencia Lectora con un texto guardado o con uno nuevo', () => {
    const guardado = completa(CL, { texto: { ...completa(CL).texto, id: 12, orden: '2' } });
    const nuevo = completa(CL, {
      texto: {
        modo: 'nuevo',
        id: undefined,
        orden: '1',
        nuevo: { tipoTexto: 'literario', titulo: ' El faro ', contenido: 'Había…', imagenUrl: '' },
      },
    });

    expect(armarDatos(guardado, CL)).toMatchObject({
      textoEstimuloId: 12,
      textoNuevo: null,
      ordenEnTexto: 2,
    });
    expect(armarDatos(nuevo, CL)).toMatchObject({
      textoEstimuloId: null,
      textoNuevo: {
        tipoTexto: 'literario',
        titulo: 'El faro',
        contenido: 'Había…',
        imagenUrl: null,
      },
      ordenEnTexto: 1,
    });
  });

  it('una pregunta guardada vuelve al formulario con su correcta, su texto y su eje', () => {
    const pregunta: PreguntaParaEditar = {
      id: 7,
      pruebaId: 1,
      ejeId: 20,
      contenidoId: 200,
      habilidadId: 40,
      tipoPregunta: 'seleccion_multiple',
      dificultadSugerida: 'media',
      enunciado: '¿Qué dice el texto?',
      explicacion: 'Lo dice en la línea 3.',
      textoEstimuloId: 12,
      ordenEnTexto: 3,
      estado: { codigo: 'observada', nombre: 'Observada' },
      editable: true,
      version: 2,
      origen: 'manual',
      alternativas: ['A', 'B', 'C', 'D'].map((letra, i) => ({
        id: 100 + i,
        letra: letra as 'A',
        texto: letra,
        esCorrecta: letra === 'C',
        explicacion: letra === 'C' ? 'Porque sí.' : null,
      })),
      actualizadoEn: '2026-10-30T12:00:00.000Z',
    };

    const campos = camposDePregunta(pregunta);

    expect(campos).toMatchObject({ ejeId: 20, correcta: 'C', dificultadSugerida: 'media' });
    expect(campos.texto).toMatchObject({ modo: 'guardado', id: 12, orden: '3' });
    // La explicación de cada alternativa se conserva al volver a guardar.
    expect(armarDatos(campos, CL).alternativas[2]?.explicacion).toBe('Porque sí.');
  });
});

describe('errores de la API', () => {
  it('cada problema va bajo su campo; textoNuevo.titulo va bajo el texto nuevo', () => {
    const error = new ErrorApi(
      400,
      'VALIDACION',
      'Competencia Matemática 1 lleva 4 alternativas.',
      [
        { ruta: 'alternativas', mensaje: 'Competencia Matemática 1 lleva 4 alternativas.' },
        { ruta: 'textoNuevo.titulo', mensaje: 'Escribe el título del texto.' },
      ],
    );

    expect(erroresDeApi(error)).toEqual({
      alternativas: 'Competencia Matemática 1 lleva 4 alternativas.',
      textoNuevo: 'Escribe el título del texto.',
    });
  });

  it('un 409 de RF-G09 va arriba del formulario', () => {
    const error = new ErrorApi(
      409,
      'CONFLICTO',
      'La pregunta está «Aprobada» y no se puede editar.',
    );

    expect(erroresDeApi(error)).toEqual({
      general: 'La pregunta está «Aprobada» y no se puede editar.',
    });
  });
});
