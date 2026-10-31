// Formato de las preguntas (HU-12.4): los mismos casos que app/test/formato_pregunta_test.dart, para que
// la vista previa de C03 separe el texto igual que la app.
import { describe, expect, it } from 'vitest';
import { bloquesDePregunta, formulasDe, trozosDeTexto } from './formato-pregunta';

/** Los trozos como texto legible: «t:…» para texto, «f:…» para fórmulas, «*» cursiva y «**» negrita. */
const trozos = (texto: string) =>
  trozosDeTexto(texto).map((trozo) =>
    trozo.tipo === 'formula'
      ? `f:${trozo.tex}`
      : `t:${trozo.negrita ? '**' : ''}${trozo.cursiva ? '*' : ''}${trozo.texto}`,
  );

describe('trozosDeTexto', () => {
  it('separa las fórmulas en línea y la cursiva (A17)', () => {
    expect(trozos(String.raw`Si $\log_2(x) = 5$, ¿cuál es el valor de *x*?`)).toEqual([
      't:Si ',
      String.raw`f:\log_2(x) = 5`,
      't:, ¿cuál es el valor de ',
      't:*x',
      't:?',
    ]);
  });

  it('un precio en pesos no es una fórmula: «$5.000 y $3.000»', () => {
    expect(trozos('Pagó $5.000 y luego $3.000.')).toEqual(['t:Pagó $5.000 y luego $3.000.']);
    expect(trozos('Costó $ 300 en total')).toEqual(['t:Costó $ 300 en total']);
  });

  it(String.raw`\$ es un signo peso dentro del texto`, () => {
    expect(trozos(String.raw`Ahorra \$500 al mes y gasta $x$`)).toEqual([
      't:Ahorra $500 al mes y gasta ',
      'f:x',
    ]);
  });

  it('la negrita y un asterisco suelto', () => {
    expect(trozos('**Importante:** lee 2 * 3 con calma')).toEqual([
      't:**Importante:',
      't: lee 2 * 3 con calma',
    ]);
  });
});

describe('bloquesDePregunta', () => {
  it('una fórmula $$…$$ va en su propia línea, aunque ocupe varias', () => {
    const bloques = bloquesDePregunta('Resuelve:\n$$x^2\n= 4$$\nElige la alternativa correcta.');

    expect(bloques.map((b) => b.tipo)).toEqual(['parrafo', 'formula', 'parrafo']);
    expect(bloques[1]).toEqual({ tipo: 'formula', tex: 'x^2\n= 4' });
  });

  it('una imagen separa el párrafo y guarda su texto alternativo', () => {
    const bloques = bloquesDePregunta(
      'Observa el gráfico:\n![Ventas por mes](https://ejemplo.cl/v.png)\n¿En qué mes se vendió más?',
    );

    expect(bloques.map((b) => b.tipo)).toEqual(['parrafo', 'imagen', 'parrafo']);
    expect(bloques[1]).toEqual({
      tipo: 'imagen',
      url: 'https://ejemplo.cl/v.png',
      alternativo: 'Ventas por mes',
    });
  });

  it('los saltos de línea de un párrafo se conservan (I, II y III)', () => {
    expect(bloquesDePregunta('I. Es par.\nII. Es primo.')).toEqual([
      {
        tipo: 'parrafo',
        trozos: [
          { tipo: 'texto', texto: 'I. Es par.\nII. Es primo.', negrita: false, cursiva: false },
        ],
      },
    ]);
  });

  it('un texto vacío no tiene bloques', () => {
    expect(bloquesDePregunta('  \n\n ')).toEqual([]);
  });
});

describe('formulasDe', () => {
  it('reúne las fórmulas en línea y solas, en orden', () => {
    expect(formulasDe(String.raw`Si $\frac{x}{2} = 4$, entonces:` + '\n\n$$x = 8$$')).toEqual([
      String.raw`\frac{x}{2} = 4`,
      'x = 8',
    ]);
  });
});
