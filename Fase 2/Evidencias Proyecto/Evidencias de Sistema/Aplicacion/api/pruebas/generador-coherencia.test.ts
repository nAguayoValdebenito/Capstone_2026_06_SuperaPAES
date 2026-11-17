// HU-17.1 (coherencia entre «resolucion» y la clave): una comprobación barata, no una demostración.
// Solo descarta con una discrepancia clara entre dos números; lo que no se puede leer como número
// («no_comprobable») pasa a los docentes.
import { describe, expect, it } from 'vitest';
import { compararClave } from '../modulos/generador/generador.coherencia.js';

describe('compararClave: coherente', () => {
  it.each([
    ['Se despeja: $4x = 28$, luego $x = 7$.', '$7$'],
    ['$x = \\frac{24}{4} = 6$', '6'],
    ['Entonces $x = -6$.', '$-6$'],
    ['Entonces $x = -6$.', '$−6$'],
    ['Resulta $x = \\frac{2}{7}$.', '$\\dfrac{2}{7}$'],
    ['Resulta $x = 2/7$.', '$\\frac{2}{7}$'],
    ['Así $x = \\frac{1}{2}$.', '$0{,}5$'],
    ['Así $x = 0,5$.', '$\\frac{1}{2}$'],
    ['Así $x = \\frac{2}{4}$.', '$\\frac{1}{2}$'],
    ['El resultado es $x = 1.250$.', '$1250$'],
    ['Entonces $x = 8$.', '$x = 8$'],
    ['Entonces $x = 15\\%$.', '$15\\%$'],
    ['Resulta $x = 7$. Comprobación: $2 \\cdot 7 + 3 = 17$.', '$7$'],
  ])('resolución %j y clave %j', (resolucion, clave) => {
    expect(compararClave(resolucion, clave)).toBe('coherente');
  });
});

describe('compararClave: incoherente', () => {
  it.each([
    ['Se despeja: $4x = 28$, luego $x = 7$.', '$6$'],
    ['$x = \\frac{24}{4} = 6$', '$4$'],
    ['Entonces $x = -6$.', '$6$'],
    ['Resulta $x = \\frac{2}{7}$.', '$\\frac{2}{3}$'],
    ['Así $x = 0,5$.', '$\\frac{1}{3}$'],
    ['Resulta $2 \\cdot 7 + 3 = 17$ y entonces $x = 8$.', '$7$'],
  ])('resolución %j y clave %j', (resolucion, clave) => {
    expect(compararClave(resolucion, clave)).toBe('incoherente');
  });
});

describe('compararClave: no comprobable (pasa a los docentes)', () => {
  it.each([
    ['Se factoriza y queda $(x+1)(x-1)$.', '$x^2 - 1$'],
    ['Resulta $x = 7$.', '$3x + 2$'],
    ['El resultado es $x \\in [2, 5]$.', '$[2, 5]$'],
    ['La respuesta es el texto central del párrafo.', 'La idea central del texto'],
    ['Se suma y queda el total.', '$12$'],
    ['Entonces $x = 7$.', '$7 \\text{ o } 8$'],
  ])('resolución %j y clave %j', (resolucion, clave) => {
    expect(compararClave(resolucion, clave)).toBe('no_comprobable');
  });
});
