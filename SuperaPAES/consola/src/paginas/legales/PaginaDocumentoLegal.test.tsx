// /terminos y /privacidad (HU-34.4): páginas públicas con el texto legal vigente, sin menú ni sesión.
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { App } from '../../App';
import { SegunCarga } from '../../componentes/SegunCarga';
import { textoDibujado } from '../../pruebas/dibujo';
import { TextoLegal } from './PaginaDocumentoLegal';

const dibujar = (ruta: string) =>
  textoDibujado(
    <MemoryRouter initialEntries={[ruta]}>
      <App sesionInicial={null} />
    </MemoryRouter>,
  );

describe('páginas públicas de los textos legales (HU-34.4)', () => {
  it.each([
    ['/terminos', 'Política de privacidad', '/privacidad'],
    ['/privacidad', 'Términos y condiciones', '/terminos'],
  ])('%s se abre sin sesión, con el logo y el enlace al otro texto', (ruta, otro, enlace) => {
    const html = dibujar(ruta);

    expect(html).toContain('src="/logo_supera_paes.png"');
    expect(html).toContain(
      `<title>${ruta === '/terminos' ? 'Términos y condiciones' : 'Política de privacidad'} · Supera PAES</title>`,
    );
    expect(html).toContain('Cargando el documento…');
    expect(html).toContain(`href="${enlace}"`);
    expect(html).toContain(`Lee también: <a`);
    expect(html).toContain(`>${otro}</a>`);
    expect(html).toContain('superapaes@gmail.com');
    expect(html).not.toContain('<nav');
    expect(html).not.toContain('Iniciar sesión</h1>');
  });

  it('dibuja el texto con su título, subtítulos y listas, sin insertar HTML', () => {
    const html = textoDibujado(
      <TextoLegal
        documento={{
          tipo: 'privacidad',
          texto: '# Política de privacidad\n\n## 1. Responsable\n\n- Nombre <b>y</b> correo.',
        }}
      />,
    );

    expect(html).toContain('<h1>Política de privacidad</h1>');
    expect(html).toContain('<h2>1. Responsable</h2>');
    expect(html).toContain('<li>Nombre &lt;b&gt;y&lt;/b&gt; correo.</li>');
  });

  it('si la API falla, muestra un texto para el visitante, sin el detalle técnico', () => {
    const html = textoDibujado(
      <SegunCarga
        carga={{
          tipo: 'fallida',
          codigo: 'SIN_CONEXION',
          mensaje: 'No se pudo conectar con la API.',
        }}
        cargando="Cargando…"
        fallida="No pudimos cargar el documento. Intenta de nuevo en unos minutos."
      >
        {() => null}
      </SegunCarga>,
    );

    expect(html).toContain('No pudimos cargar el documento.');
    expect(html).not.toContain('SIN_CONEXION');
    expect(html).not.toContain('API');
  });
});
