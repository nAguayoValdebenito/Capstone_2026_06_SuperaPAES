import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { App } from '../../App';
import { MENSAJES_RESTABLECER } from '../../estado/restablecer-contrasena';
import { FormularioRestablecer } from './PaginaRestablecerContrasena';

const nada = () => undefined;

function renderizar(ruta: string) {
  return renderToString(
    <MemoryRouter initialEntries={[ruta]}>
      <App sesionInicial={null} />
    </MemoryRouter>,
  );
}

describe('página Nueva contraseña (A05)', () => {
  it('es pública: con el token del enlace pide la contraseña dos veces, sin menú', () => {
    const html = renderizar('/restablecer-contrasena?token=abc123');

    expect(html).toContain('Crea tu contraseña nueva');
    expect(html).toContain('Contraseña nueva');
    expect(html).toContain('Repite la contraseña nueva');
    expect(html).toContain('De 8 a 72 caracteres');
    expect(html).toContain('contraseña común');
    expect(html).toContain('logo_supera_paes.png');
    expect(html).not.toContain('Iniciar sesión</h1>');
  });

  it('sin token avisa que el enlace está incompleto y no muestra el formulario', () => {
    const html = renderizar('/restablecer-contrasena');

    expect(html).toContain('Enlace incompleto');
    expect(html).toContain('«¿Olvidaste tu contraseña?»');
    expect(html).not.toContain('Crea tu contraseña nueva');
  });

  it('un error de la contraseña va bajo el campo', () => {
    const html = renderToString(
      <FormularioRestablecer
        estado={{
          tipo: 'fallido',
          mensaje: MENSAJES_RESTABLECER.noCoinciden,
          deContrasena: true,
          enlaceNoVigente: false,
        }}
        alEnviar={nada}
      />,
    );

    expect(html).toContain('class="campo__error"');
    expect(html).toContain(MENSAJES_RESTABLECER.noCoinciden);
    expect(html).toContain('aria-invalid="true"');
  });

  it('mientras guarda, el botón queda desactivado', () => {
    const html = renderToString(
      <FormularioRestablecer estado={{ tipo: 'enviando' }} alEnviar={nada} />,
    );

    expect(html).toContain('Guardando…');
    expect(html).toMatch(/<button[^>]*disabled=""/);
  });
});
