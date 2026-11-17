// HU-17.1: el JSON de motivos del lote cuenta cuántas preguntas descartó cada regla, las fallas de la IA y el cierre.
import { describe, expect, it } from 'vitest';
import { claseDeError } from '../comun/registro.js';
import {
  anotarCierre,
  anotarDescarte,
  anotarFalla,
  anotarTextoDescartado,
  leerMotivos,
} from '../modulos/generador/generador.motivos.js';

const problema = (motivo: 'sin_tildes' | 'clave_incoherente') => ({ motivo, detalle: 'x' });

describe('motivos del lote', () => {
  it('un lote nuevo (null) o un valor raro parte de cero', () => {
    const vacio = { porMotivo: {}, reglas: {}, fallas: {} };

    expect(leerMotivos(null)).toEqual(vacio);
    expect(leerMotivos('texto')).toEqual(vacio);
    expect(leerMotivos([1, 2])).toEqual(vacio);
    expect(leerMotivos({ porMotivo: { a: 'dos', b: -1, c: 3 } }).porMotivo).toEqual({ c: 3 });
  });

  it('el primer problema es el motivo y todas las reglas que saltaron quedan contadas', () => {
    const inicial = leerMotivos(null);

    const uno = anotarDescarte(inicial, [problema('clave_incoherente'), problema('sin_tildes')]);
    const dos = anotarDescarte(uno, [problema('sin_tildes')]);

    expect(dos.porMotivo).toEqual({ clave_incoherente: 1, sin_tildes: 1 });
    expect(dos.reglas).toEqual({ clave_incoherente: 1, sin_tildes: 2 });
    expect(inicial.reglas).toEqual({});
  });

  it('anota las fallas de la IA y el cierre sin perder lo anterior', () => {
    const base = anotarDescarte(leerMotivos(null), [problema('sin_tildes')]);

    const final = anotarCierre(
      anotarFalla(anotarFalla(base, 'IA_NO_DISPONIBLE'), 'IA_NO_DISPONIBLE'),
      'plazo',
    );

    expect(final).toEqual({
      porMotivo: { sin_tildes: 1 },
      reglas: { sin_tildes: 1 },
      fallas: { IA_NO_DISPONIBLE: 2 },
      cierre: 'plazo',
    });
    expect(leerMotivos(final).cierre).toBeUndefined();
  });

  it('los textos de lectura descartados se cuentan aparte y se conservan al leer el JSON', () => {
    const inicial = leerMotivos(null);
    const uno = anotarTextoDescartado(inicial, [
      { motivo: 'texto_corto', detalle: 'x' },
      { motivo: 'sin_tildes', detalle: 'x' },
    ]);
    const dos = anotarTextoDescartado(uno, [{ motivo: 'texto_corto', detalle: 'x' }]);

    expect(dos.textos).toEqual({ texto_corto: 2, sin_tildes: 1 });
    expect(leerMotivos(dos).textos).toEqual({ texto_corto: 2, sin_tildes: 1 });
    expect(inicial).not.toHaveProperty('textos');
    expect(dos.porMotivo).toEqual({});
  });
});

describe('claseDeError', () => {
  it('devuelve la clase y el código, sin el mensaje', () => {
    expect(claseDeError(Object.assign(new TypeError('secreto'), { code: 42 }))).toBe(
      'TypeError:42',
    );
    expect(claseDeError(new Error('secreto'))).toBe('Error');
    expect(claseDeError('texto con secreto')).toBe('desconocido');
  });
});
