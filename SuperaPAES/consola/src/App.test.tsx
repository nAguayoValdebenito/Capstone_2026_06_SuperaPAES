import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { SECCIONES, seccionesDelRol } from './rutas/secciones';
import type { RolCuentaInterna, UsuarioInterno } from './tipos';

const sesiones: Record<RolCuentaInterna, UsuarioInterno> = {
  admin: { id: '1', nombre: 'Ana Admin', rol: 'admin' },
  docente: { id: '2', nombre: 'Diego Docente', rol: 'docente' },
};

const MENU_ADMIN = [
  'Panel',
  'Banco de preguntas',
  'Generador IA',
  'Revisiones',
  'Temario',
  'Usuarios internos',
  'Planes',
  'Configuración',
  'Avisos de error',
  'Solicitudes de datos',
  'Estudiantes',
  'Suscripciones',
  'Auditoría',
];
const MENU_DOCENTE = ['Revisión', 'Desempates', 'Clasificar dificultad'];

function renderizar(ruta: string, sesion: UsuarioInterno | null) {
  return renderToString(
    <MemoryRouter initialEntries={[ruta]}>
      <App sesionInicial={sesion} />
    </MemoryRouter>,
  );
}

describe('consola (prueba de humo)', () => {
  it.each(SECCIONES.map((s) => [s.ruta, s.titulo, s.roles[0]] as const))(
    'la sección %s muestra su título',
    (ruta, titulo, rol) => {
      const html = renderizar(ruta, sesiones[rol ?? 'admin']);

      expect(html).toContain(`>${titulo}</h1>`);
    },
  );

  it.each([
    ['admin', MENU_ADMIN],
    ['docente', MENU_DOCENTE],
  ] as const)('el menú del %s tiene exactamente sus secciones', (rol, titulos) => {
    expect(
      seccionesDelRol(rol)
        .map((s) => s.titulo)
        .sort(),
    ).toEqual([...titulos].sort());

    const html = renderizar(seccionesDelRol(rol)[0]?.ruta ?? '/', sesiones[rol]);
    for (const seccion of SECCIONES) {
      const enlace = `href="${seccion.ruta}"`;
      if (seccion.roles.includes(rol)) expect(html).toContain(enlace);
      else expect(html).not.toContain(enlace);
    }
  });

  it('un docente no puede entrar a una sección del administrador', () => {
    const html = renderizar('/usuarios-internos', sesiones.docente);

    expect(html).toContain('No tienes permiso');
    expect(html).not.toContain('>Usuarios internos</h1>');
  });

  it('un administrador no ve la bandeja del docente', () => {
    const html = renderizar('/desempates', sesiones.admin);

    expect(html).toContain('No tienes permiso');
  });

  it('sin sesión, una sección redirige a la página de ingreso', () => {
    const html = renderizar('/panel', null);

    expect(html).not.toContain('>Panel</h1>');
  });

  it('la página de ingreso se muestra sin sesión', () => {
    const html = renderizar('/ingreso', null);

    expect(html).toContain('>Ingreso</h1>');
  });
});
