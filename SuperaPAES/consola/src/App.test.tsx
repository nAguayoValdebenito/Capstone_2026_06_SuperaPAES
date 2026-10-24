import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { abrirSesion } from './estado/almacen-sesion';
import { SESION_DESARROLLO } from './estado/contexto-sesion';
import { FormularioIngreso } from './paginas/ingreso/PaginaIngreso';
import { instalarAlmacen, sesionDePrueba } from './pruebas/sesion';
import { INICIO_POR_ROL, redireccionDeRuta, SECCIONES, seccionesDelRol } from './rutas/secciones';
import type { RolCuentaInterna, UsuarioInterno } from './tipos';

const sesiones: Record<RolCuentaInterna, UsuarioInterno> = {
  admin: { id: '1', nombre: 'Ana Admin', rol: 'admin' },
  docente: { id: '2', nombre: 'Diego Docente', rol: 'docente' },
};

// Menús del DAS 7.4, en su orden.
const MENU_ADMIN = [
  'Panel',
  'Banco de preguntas',
  'Revisiones',
  'Generador IA',
  'Temario',
  'Evaluaciones',
  'Listas de opciones',
  'Usuarios internos',
  'Planes',
  'Configuración',
  'Avisos de error',
  'Solicitudes de datos',
  'Estudiantes',
  'Suscripciones',
];
const MENU_DOCENTE = ['Mis revisiones', 'Desempates', 'Clasificar dificultad', 'Calibración'];

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
  ] as const)('el menú del %s tiene exactamente sus secciones, en orden', (rol, titulos) => {
    expect(seccionesDelRol(rol).map((s) => s.titulo)).toEqual(titulos);

    const html = renderizar(seccionesDelRol(rol)[0]?.ruta ?? '/', sesiones[rol]);
    for (const seccion of SECCIONES) {
      const enlace = `href="${seccion.ruta}"`;
      if (seccion.roles.includes(rol)) expect(html).toContain(enlace);
      else expect(html).not.toContain(enlace);
    }
  });

  it('un docente que abre una página del administrador es redirigido a su bandeja (HU-03 esc. 3)', () => {
    const html = renderizar('/usuarios-internos', sesiones.docente);

    expect(html).not.toContain('>Usuarios internos</h1>');
    expect(redireccionDeRuta(sesiones.docente, ['admin'])).toBe('/revision');
  });

  it('un administrador que abre la bandeja del docente es redirigido al banco', () => {
    const html = renderizar('/desempates', sesiones.admin);

    expect(html).not.toContain('>Desempates</h1>');
    expect(redireccionDeRuta(sesiones.admin, ['docente'])).toBe('/banco');
  });

  it('sin sesión, una sección redirige a la página de ingreso', () => {
    const html = renderizar('/panel', null);

    expect(html).not.toContain('>Panel</h1>');
    expect(redireccionDeRuta(null, ['admin'])).toBe('/ingreso');
  });

  // Separación de roles: el administrador no entra a D01–D04 y el docente no entra a C01–C16.
  it.each([
    ['admin', 'docente', '/banco'],
    ['docente', 'admin', '/revision'],
  ] as const)(
    'el %s que abre a mano cualquier página del %s es redirigido a %s',
    (rol, otroRol, entrada) => {
      const ajenas = SECCIONES.filter((s) => s.roles.includes(otroRol));
      expect(ajenas.length).toBeGreaterThan(0);

      for (const seccion of ajenas) {
        expect(seccion.roles).not.toContain(rol);
        expect(redireccionDeRuta(sesiones[rol], seccion.roles)).toBe(entrada);
        expect(renderizar(seccion.ruta, sesiones[rol])).not.toContain(`>${seccion.titulo}</h1>`);
      }
    },
  );

  it('no hay forma de cambiar de rol: «Ver como» no aparece ni con la sesión provisional', () => {
    expect(SESION_DESARROLLO).not.toBeNull();
    const sesionesPosibles = [SESION_DESARROLLO, sesiones.admin, sesiones.docente];
    for (const sesion of sesionesPosibles) {
      if (!sesion) continue;
      const html = renderizar(INICIO_POR_ROL[sesion.rol], sesion);
      expect(html).not.toContain('Ver como');
      expect(html).not.toContain('<select');
    }
  });

  it('cada rol puede abrir sus propias secciones', () => {
    for (const seccion of SECCIONES) {
      for (const rol of seccion.roles) {
        expect(redireccionDeRuta(sesiones[rol], seccion.roles)).toBeNull();
      }
    }
  });

  it('la página de ingreso (C00) se muestra sin sesión, con el logo, el correo y la contraseña', () => {
    const html = renderizar('/ingreso', null);

    expect(html).toContain('>Iniciar sesión</h1>');
    expect(html).toContain('src="/logo_supera_paes.png"');
    expect(html).toContain('type="email"');
    expect(html).toContain('type="password"');
    expect(html).not.toContain('Cerrar sesión');
  });

  it('con sesión, la página de ingreso no muestra el formulario', () => {
    expect(renderizar('/ingreso', sesiones.docente)).not.toContain('type="password"');
  });

  it('con la sesión provisional de desarrollo, la página de ingreso sí muestra el formulario', () => {
    expect(renderizar('/ingreso', SESION_DESARROLLO)).toContain('type="password"');
  });

  it('el formulario muestra el error del ingreso y se bloquea mientras envía', () => {
    const conError = renderToString(
      <FormularioIngreso
        estado={{ tipo: 'fallido', mensaje: 'Correo o contraseña incorrectos.' }}
        alEnviar={() => undefined}
      />,
    );
    const enviando = renderToString(
      <FormularioIngreso estado={{ tipo: 'enviando' }} alEnviar={() => undefined} />,
    );

    expect(conError).toContain('role="alert"');
    expect(conError).toContain('Correo o contraseña incorrectos.');
    expect(enviando).toContain('disabled');
    expect(enviando).toContain('Ingresando…');
  });

  it('el menú ofrece cerrar sesión', () => {
    expect(renderizar('/banco', sesiones.admin)).toContain('Cerrar sesión');
  });

  it('el administrador entra al banco mientras el panel está pendiente y el docente a su bandeja', () => {
    expect(INICIO_POR_ROL).toEqual({ admin: '/banco', docente: '/revision' });
  });
});

describe('sesión iniciada en la consola (HU-03 esc. 1)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ['docente', '/revision', MENU_DOCENTE, MENU_ADMIN],
    ['admin', '/banco', MENU_ADMIN, MENU_DOCENTE],
  ] as const)(
    'después de ingresar como %s, la consola muestra el menú de su rol',
    (rol, inicio, propio, ajeno) => {
      instalarAlmacen();
      abrirSesion(sesionDePrueba(rol));

      const html = renderizar(inicio, null);

      for (const titulo of propio) expect(html).toContain(`>${titulo}</a>`);
      for (const titulo of ajeno) expect(html).not.toContain(`>${titulo}</a>`);
    },
  );

  it('una sesión de la app no abre la consola (HU-03 esc. 2)', () => {
    instalarAlmacen();
    abrirSesion(sesionDePrueba('estudiante'));

    expect(renderizar('/banco', null)).not.toContain('>Banco de preguntas</h1>');
  });
});
