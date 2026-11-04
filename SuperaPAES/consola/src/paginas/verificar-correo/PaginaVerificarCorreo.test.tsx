import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { App } from '../../App';
import { MENSAJES_VERIFICACION, type EstadoVerificacion } from '../../estado/verificar-correo';
import { ResultadoVerificacion } from './PaginaVerificarCorreo';

function renderizar(ruta: string) {
  return renderToString(
    <MemoryRouter initialEntries={[ruta]}>
      <App sesionInicial={null} />
    </MemoryRouter>,
  );
}

const resultado = (estado: EstadoVerificacion) =>
  renderToString(<ResultadoVerificacion estado={estado} />);

describe('página Verificar correo (HU-05.4, CU-02)', () => {
  it('es pública: con el token del enlace verifica sin pedir sesión ni mostrar el menú', () => {
    const html = renderizar('/verificar-correo?token=abc123');

    expect(html).toContain('Verificando tu correo');
    expect(html).not.toContain('<nav');
    expect(html).not.toContain('Iniciar sesión</h1>');
  });

  it('sin token avisa que el enlace está incompleto', () => {
    const html = renderizar('/verificar-correo');

    expect(html).toContain('Enlace incompleto');
    expect(html).not.toContain('Verificando tu correo');
  });

  it('al verificar cuenta que el cupo subió y pide volver a la app', () => {
    const html = resultado({ tipo: 'verificado' });

    expect(html).toContain('Correo verificado');
    expect(html).toContain('Tu cupo diario subió de 10 a 20 preguntas.');
    expect(html).toContain('Vuelve a la app');
  });

  it('un correo ya verificado se explica sin mostrar un error', () => {
    const html = resultado({ tipo: 'ya_verificado' });

    expect(html).toContain('Tu correo ya estaba verificado');
    expect(html).toContain('restablecer__aviso--exito');
  });

  it('un enlace que ya no sirve ofrece pedir un correo nuevo desde la app (CU-02 3.b)', () => {
    const html = resultado({ tipo: 'no_vigente', mensaje: 'Este enlace ya no sirve.' });

    expect(html).toContain('Este enlace ya no sirve');
    expect(html).toContain('Reenviar correo');
  });

  it('una falla pide intentarlo de nuevo', () => {
    const html = resultado({ tipo: 'fallido', mensaje: MENSAJES_VERIFICACION.general });

    expect(html).toContain('No pudimos verificar tu correo');
    expect(html).toContain(MENSAJES_VERIFICACION.general);
  });
});
