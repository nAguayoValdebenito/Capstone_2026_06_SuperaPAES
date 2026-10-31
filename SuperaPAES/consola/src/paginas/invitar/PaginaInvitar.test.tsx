import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { App } from '../../App';
import { codigoDeInvitacion, enlacesTiendas } from './invitacion';

function renderizar(ruta: string) {
  return renderToString(
    <MemoryRouter initialEntries={[ruta]}>
      <App sesionInicial={null} />
    </MemoryRouter>,
  );
}

describe('página de invitación (W01 y W02)', () => {
  it('es pública: muestra el código del link, los pasos y las tiendas, sin menú', () => {
    const html = renderizar('/invitar/K7P2QX');

    expect(html).toContain('Te invitaron a Supera PAES');
    expect(html).toContain('K7P2QX');
    expect(html).toContain('Copiar código');
    expect(html).toContain('Escribe este código en «Código de invitación».');
    expect(html).toContain('Google Play');
    expect(html).toContain('App Store');
    expect(html).toContain('Quien te invitó gana 5 preguntas extra');
    expect(html).not.toContain('<nav');
    expect(html).not.toContain('Iniciar sesión</h1>');
  });

  it('el código del link se muestra en mayúsculas', () => {
    expect(renderizar('/invitar/k7p2qx')).toContain('K7P2QX');
  });

  it('un código que no cumple RN-33 avisa que el link no es válido, sin tarjeta', () => {
    const html = renderizar('/invitar/K7P2Q0');

    expect(html).toContain('Este link de invitación no es válido');
    expect(html).not.toContain('Copiar código');
    // Igual se puede descargar la app y crear la cuenta sin código.
    expect(html).toContain('Google Play');
  });

  it('sin los enlaces de las tiendas configurados, dice «Pronto en» y no enlaza', () => {
    const html = renderizar('/invitar/K7P2QX');

    expect(html).toContain('Pronto en');
    expect(html).not.toContain('target="_blank"');
  });
});

describe('código y tiendas de la página de invitación', () => {
  it('acepta solo 6 caracteres sin 0, O, 1 ni I (RN-33)', () => {
    expect(codigoDeInvitacion(' k7p2qx ')).toBe('K7P2QX');
    expect(codigoDeInvitacion('K7P2QXA')).toBeNull();
    expect(codigoDeInvitacion('O7P2QX')).toBeNull();
    expect(codigoDeInvitacion('I7P2QX')).toBeNull();
    expect(codigoDeInvitacion(undefined)).toBeNull();
  });

  it('usa solo los enlaces con valor', () => {
    expect(
      enlacesTiendas({
        VITE_ENLACE_GOOGLE_PLAY: 'https://play.google.com/apps/testing/cl.superapaes.app',
        VITE_ENLACE_APP_STORE: '  ',
      }),
    ).toEqual({ googlePlay: 'https://play.google.com/apps/testing/cl.superapaes.app' });
    expect(enlacesTiendas({})).toEqual({});
  });
});
