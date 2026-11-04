import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { App } from '../../App';
import { MENSAJES_VERIFICACION } from '../../estado/verificar-correo';
import { ResultadoVerificacion } from './PaginaVerificarCorreo';

describe('página pública /verificar-correo (HU-05.4, CP-03)', () => {
  it.each([null, { id: 'admin-prueba', nombre: 'Administradora', rol: 'admin' as const }])(
    'abre sin exigir sesión ni mostrar el menú interno',
    (sesion) => {
      const html = renderToString(
        <MemoryRouter initialEntries={['/verificar-correo?token=enlace-de-prueba']}>
          <App sesionInicial={sesion} />
        </MemoryRouter>,
      );
      expect(html).toContain('Verificando tu correo…');
      expect(html).not.toContain('Cerrar sesión');
      expect(html).not.toContain('enlace-de-prueba');
    },
  );

  it('explica cómo pedir otro correo cuando el enlace está incompleto', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/verificar-correo']}>
        <App sesionInicial={null} />
      </MemoryRouter>,
    );
    expect(html).toContain(MENSAJES_VERIFICACION.incompleto);
    expect(html).toContain('Reenviar correo');
    expect(html).not.toContain('<button');
  });

  it.each([false, true])(
    'confirma la verificación e invita a volver a la app (%j)',
    (yaVerificado) => {
      const html = renderToString(
        <ResultadoVerificacion
          estado={{ tipo: 'verificado', yaVerificado }}
          alReintentar={() => undefined}
        />,
      );
      expect(html).toContain('Correo verificado');
      expect(html).toContain('Vuelve a la app');
      expect(html).toContain('role="status"');
    },
  );

  it.each([false, true])('ofrece la acción que corresponde al error (%j)', (reintentable) => {
    const html = renderToString(
      <ResultadoVerificacion
        estado={{ tipo: 'fallido', mensaje: 'No se pudo verificar.', reintentable }}
        alReintentar={() => undefined}
      />,
    );
    expect(html).toContain('role="alert"');
    if (reintentable) expect(html).toContain('Reintentar');
    else expect(html).toContain('Reenviar correo');
  });
});
