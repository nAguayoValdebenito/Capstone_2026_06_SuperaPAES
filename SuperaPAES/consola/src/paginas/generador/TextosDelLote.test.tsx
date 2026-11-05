import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTextosGenerados } from '../../estado/textos-generados';
import { textoDibujado } from '../../pruebas/dibujo';
import { LECTURA_GENERADA, PRUEBA_LECTORA } from '../../pruebas/lectura-generada';
import { TextosDelLote } from './TextosDelLote';

vi.mock('../../estado/textos-generados', () => ({ useTextosGenerados: vi.fn() }));

const dibujar = () =>
  textoDibujado(
    <MemoryRouter>
      <TextosDelLote loteId="32" pruebas={[PRUEBA_LECTORA]} />
    </MemoryRouter>,
  );

beforeEach(() =>
  vi.mocked(useTextosGenerados).mockReturnValue({
    carga: { tipo: 'lista', datos: [LECTURA_GENERADA] },
    reintentar: vi.fn(),
  }),
);

describe('C05 · HU-18.3, CP-14: texto con sus preguntas', () => {
  it('muestra primero el texto completo, luego las tres habilidades y cuatro alternativas por pregunta', () => {
    const html = dibujar();
    expect(html).toContain('Texto íntegro de lectura.');
    expect(html.indexOf('Texto íntegro')).toBeLessThan(html.indexOf('Pregunta 1'));
    for (const habilidad of ['Localizar', 'Interpretar', 'Evaluar'])
      expect(html).toContain(habilidad);
    expect(html.match(/<li>/g)).toHaveLength(12);
    expect(html.match(/B · Correcta/g)).toHaveLength(3);
    expect(html).toContain('El texto explica el recorrido del agua.');
    expect(html).toContain('href="/banco/71"');
  });

  it('conserva el formato y escapa HTML procedente de la IA', () => {
    vi.mocked(useTextosGenerados).mockReturnValue({
      carga: {
        tipo: 'lista',
        datos: [
          {
            ...LECTURA_GENERADA,
            texto: {
              ...LECTURA_GENERADA.texto,
              contenido: '<script>alert(1)</script> y $x^2$',
              imagenUrl: '/lectura.png',
            },
          },
        ],
      },
      reintentar: vi.fn(),
    });
    const html = dibujar();
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('katex');
    expect(html).toContain('/lectura.png');
  });

  it('muestra la carga sin resultados del lote anterior', () => {
    vi.mocked(useTextosGenerados).mockReturnValue({
      carga: { tipo: 'cargando' },
      reintentar: vi.fn(),
    });
    const html = dibujar();
    expect(html).toContain('Cargando el texto y sus preguntas');
    expect(html).not.toContain('Texto íntegro');
  });

  it('muestra el error de consulta y permite reintentar', () => {
    vi.mocked(useTextosGenerados).mockReturnValue({
      carga: { tipo: 'fallida', codigo: 'SIN_CONEXION', mensaje: 'No se pudo cargar la lectura.' },
      reintentar: vi.fn(),
    });
    const html = dibujar();
    expect(html).toContain('role="alert"');
    expect(html).toContain('No se pudo cargar la lectura.');
    expect(html).toContain('Reintentar');
  });
});
