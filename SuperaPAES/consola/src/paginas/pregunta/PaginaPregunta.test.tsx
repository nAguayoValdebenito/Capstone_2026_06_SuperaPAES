// Formulario C03 y su vista previa (HU-12.5, CP-09): las alternativas se ajustan a la prueba, se marca
// una sola correcta, Competencia Lectora pide su texto de lectura, los errores de la API se muestran
// bajo su campo y la vista previa dibuja las fórmulas con KaTeX y avisa de las mal escritas.
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import {
  type CamposPregunta,
  cambiarCantidad,
  camposVacios,
  conPrueba,
  type ErroresPregunta,
} from '../../estado/formulario-pregunta';
import { CL, M1, M2 } from '../../pruebas/temario';
import type { OpcionesFiltrosBanco, PruebaTemario } from '../../tipos';
import type { Editor } from './CamposPregunta';
import { ContenidoPregunta } from './PaginaPregunta';

const OPCIONES: OpcionesFiltrosBanco = {
  pruebas: [CL, M1, M2],
  estados: [],
  origenes: [],
  dificultades: [{ codigo: 'media', nombre: 'Media' }],
};
const nada = () => undefined;

/** Un editor ya cargado con los campos y errores indicados; sus acciones no hacen nada. */
function editor(campos: CamposPregunta, errores: ErroresPregunta = {}): Editor {
  return {
    carga: { tipo: 'lista', opciones: OPCIONES, tiposTexto: [], pregunta: null },
    campos,
    errores,
    enviando: false,
    aviso: null,
    enviar: nada,
    cambiar: nada,
    elegirPrueba: nada,
    elegirEje: nada,
    cambiarAlternativa: nada,
    cambiarCantidad: nada,
    cambiarTexto: nada,
    cambiarTextoNuevo: nada,
  };
}

const dibujar = (campos: CamposPregunta, errores?: ErroresPregunta) =>
  renderToString(
    <MemoryRouter>
      <ContenidoPregunta editor={editor(campos, errores)} />
    </MemoryRouter>,
  );

const conLa = (prueba: PruebaTemario, cambios: Partial<CamposPregunta> = {}) => ({
  ...conPrueba(camposVacios(), prueba),
  ...cambios,
});

const letras = (html: string) =>
  [...html.matchAll(/aria-label="Texto de la alternativa ([A-E])"/g)].map((m) => m[1]).join('');

describe('formulario C03 (HU-12.3 y HU-12.5)', () => {
  it('M1 muestra 4 alternativas sin «Agregar la E»; M2 permite agregarla y luego quitarla (RN-08)', () => {
    const m1 = dibujar(conLa(M1));
    const m2 = dibujar(conLa(M2));
    const m2ConE = dibujar(cambiarCantidad(conLa(M2), M2, true));

    expect(letras(m1)).toBe('ABCD');
    expect(m1).toContain('M1 admite 4 · marca la correcta');
    expect(m1).not.toContain('Agregar la E');
    expect(m2).toContain('Agregar la E');
    expect(letras(m2ConE)).toBe('ABCDE');
    expect(m2ConE).toContain('Quitar la E');
  });

  it('la correcta se marca con un botón de opción: una sola, con su etiqueta «Correcta»', () => {
    const html = dibujar(conLa(M1, { correcta: 'C' }));

    const radios = [...html.matchAll(/<input type="radio"[^>]*>/g)].map((m) => m[0]);
    expect(radios).toHaveLength(4);
    expect(radios.every((r) => r.includes('name="correcta"'))).toBe(true);
    expect(radios.filter((r) => r.includes('checked'))).toEqual([
      expect.stringContaining('aria-label="La C es la correcta"'),
    ]);
    expect(html.match(/>Correcta</g)).toHaveLength(1);
  });

  it('la sección del texto de lectura aparece solo en Competencia Lectora (esc. 2)', () => {
    expect(dibujar(conLa(CL))).toContain('Texto de lectura');
    expect(dibujar(conLa(CL))).toContain('Orden de la pregunta en el texto');
    expect(dibujar(conLa(M1))).not.toContain('Orden de la pregunta en el texto');
  });

  it('los errores de la API van bajo su campo y el general arriba del formulario', () => {
    const html = dibujar(conLa(M1), {
      alternativas: 'Competencia Matemática 1 lleva 4 alternativas.',
      general: 'La pregunta está «Aprobada» y no se puede editar.',
    });

    expect(html).toMatch(
      /id="error-alternativas"[^>]*role="alert"[^>]*>Competencia Matemática 1 lleva 4 alternativas\./,
    );
    expect(html).toMatch(/aviso--error" role="alert">La pregunta está «Aprobada»/);
  });
});

describe('vista previa con fórmulas (HU-12.4)', () => {
  it('dibuja las fórmulas con KaTeX en el teléfono de 390 px y deja el precio como texto', () => {
    const html = dibujar(
      conLa(M2, {
        enunciado: String.raw`Si $\log_2(x) = 5$, ¿cuánto vale *x*? Pagó $5.000 y $3.000.`,
      }),
    );

    expect(html).toContain('class="telefono"');
    expect(html).toContain('class="katex"');
    // KaTeX deja el LaTeX en MathML para los lectores de pantalla.
    expect(html).toContain(String.raw`<annotation encoding="application/x-tex">\log_2(x) = 5`);
    expect(html).toContain('Pagó $5.000 y $3.000.');
    expect(html).not.toContain('Hay fórmulas que no se pueden dibujar');
  });

  it('una fórmula mal escrita se ve tal cual y se avisa en qué campo está', () => {
    const html = dibujar(
      conLa(M1, { enunciado: String.raw`Mal: $\frac{1}{$ fin`, explicacion: '$x^2$ bien' }),
    );

    expect(html).toContain('Hay fórmulas que no se pueden dibujar');
    expect(html).toContain(String.raw`En <!-- -->el enunciado<!-- -->: <code>\frac{1}{</code>`);
    expect(html).toContain(String.raw`formula--error">$\frac{1}{$</span>`);
  });

  it('no deja pasar HTML ni enlaces: el texto se escapa y \\href se rechaza', () => {
    const html = dibujar(
      conLa(M1, {
        enunciado: String.raw`<img src=x onerror="alert(1)"> y $\href{javascript:alert(1)}{clic}$`,
      }),
    );

    const telefono = html.slice(html.indexOf('class="telefono"'));
    expect(telefono).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(telefono).not.toContain('<img');
    expect(telefono).not.toContain('<a ');
    expect(html).toContain(String.raw`<code>\href{javascript:alert(1)}{clic}</code>`);
  });

  it('en Competencia Lectora muestra el texto nuevo arriba del enunciado', () => {
    const campos = conLa(CL, { enunciado: '¿Qué dice el texto?' });
    const html = dibujar({
      ...campos,
      texto: {
        ...campos.texto,
        modo: 'nuevo',
        nuevo: {
          tipoTexto: 'literario',
          titulo: 'El faro',
          contenido: 'Había un **faro**.',
          imagenUrl: '',
        },
      },
    });

    const telefono = html.slice(html.indexOf('class="telefono"'));
    expect(telefono.indexOf('El faro')).toBeLessThan(telefono.indexOf('¿Qué dice el texto?'));
    expect(telefono).toContain('<strong>faro</strong>');
  });
});
