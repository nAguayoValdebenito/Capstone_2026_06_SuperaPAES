import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { MENSAJES_CAMBIO } from '../../estado/cambiar-contrasena';
import { abrirSesion } from '../../estado/almacen-sesion';
import { instalarAlmacen, sesionDePrueba } from '../../pruebas/sesion';
import { FormularioCambio } from './PaginaCambiarContrasena';

const nada = () => undefined;

function renderizar(ruta: string) {
  return renderToString(
    <MemoryRouter initialEntries={[ruta]}>
      <App sesionInicial={null} />
    </MemoryRouter>,
  );
}

/** Sesión guardada de un administrador, con o sin la contraseña que le asignó el administrador. */
function conSesion(debeCambiarContrasena: boolean) {
  instalarAlmacen();
  abrirSesion({ ...sesionDePrueba('admin'), usuario: { debeCambiarContrasena } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Cambia tu contraseña', () => {
  it('con el cambio pendiente pide la actual, la nueva y la repetición, con los requisitos de RN-31', () => {
    conSesion(true);

    const html = renderizar('/cambiar-contrasena');

    expect(html).toContain('Cambia tu contraseña</h1>');
    expect(html).toContain(MENSAJES_CAMBIO.asignada);
    expect(html).toContain('Contraseña actual');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain('Nueva contraseña');
    expect(html).toContain('Repite la contraseña');
    expect(html).toContain('De 8 a 72 caracteres');
    expect(html).toContain('contraseña común');
    // Sin el menú de la consola: solo puede cambiarla o cerrar la sesión.
    expect(html).not.toContain('<nav');
    expect(html).toContain('Cerrar sesión');
    expect(html).not.toContain('Volver a la consola');
  });

  it('sin el cambio pendiente (desde el menú de la cuenta) ofrece volver a la consola', () => {
    conSesion(false);

    const html = renderizar('/cambiar-contrasena');

    expect(html).toContain(MENSAJES_CAMBIO.voluntaria);
    expect(html).toContain('Volver a la consola');
  });

  it('sin sesión no muestra el formulario', () => {
    instalarAlmacen();

    expect(renderizar('/cambiar-contrasena')).not.toContain('Contraseña actual');
  });

  it('con el cambio pendiente, las secciones de la consola no se muestran', () => {
    conSesion(true);

    const html = renderizar('/banco');

    expect(html).not.toContain('>Banco de preguntas</h1>');
    expect(html).not.toContain('Secciones de la consola');
  });

  it('el menú de la cuenta ofrece Cambiar contraseña, fuera de las secciones', () => {
    conSesion(false);

    const html = renderizar('/banco');

    expect(html).toContain('href="/cambiar-contrasena"');
    expect(html).toContain('Cambiar contraseña');
    const secciones = html.slice(
      html.indexOf('Secciones de la consola'),
      html.indexOf('menu__sesion'),
    );
    expect(secciones).not.toContain('Cambiar contraseña');
  });

  it('cada error va bajo su campo y mientras guarda el botón queda desactivado', () => {
    const actual = renderToString(
      <FormularioCambio
        estado={{
          tipo: 'fallido',
          mensaje: 'La contraseña actual no es correcta.',
          campo: 'actual',
        }}
        alEnviar={nada}
      />,
    );
    const general = renderToString(
      <FormularioCambio
        estado={{ tipo: 'fallido', mensaje: MENSAJES_CAMBIO.general, campo: null }}
        alEnviar={nada}
      />,
    );
    const enviando = renderToString(
      <FormularioCambio estado={{ tipo: 'enviando' }} alEnviar={nada} />,
    );

    expect(actual).toContain('class="restablecer__error"');
    expect(actual).toContain('La contraseña actual no es correcta.');
    expect(actual).toContain('aria-invalid="true"');
    expect(general).toContain('restablecer__aviso--error');
    expect(enviando).toContain('Guardando…');
    expect(enviando).toMatch(/<button[^>]*disabled=""/);
  });
});
