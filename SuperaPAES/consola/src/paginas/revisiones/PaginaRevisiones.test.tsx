import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Carga } from '../../estado/carga';
import { useSeguimiento } from '../../estado/seguimiento';
import type { PaginaSeguimiento, PreguntaSeguida } from '../../tipos/seguimiento';
import { avisoSinDocentes, etiquetaDeDocente } from '../../utilidades/seguimiento';
import { PaginaRevisiones } from './PaginaRevisiones';

vi.mock('../../estado/seguimiento', () => ({ useSeguimiento: vi.fn() }));

const docente = (correo: string, estado = 'pendiente') => ({
  correo,
  estado,
  decision: null,
  dificultad: null,
});

const pregunta: PreguntaSeguida = {
  id: 244,
  prueba: 'M1',
  contenido: 'Figuras geométricas',
  estado: { codigo: 'en_desempate', nombre: 'En desempate' },
  posibleConfusa: true,
  revisores: [
    { ...docente('uno@ejemplo.cl', 'completada'), decision: 'aprobar', dificultad: 'Fácil' },
    { ...docente('dos@ejemplo.cl', 'completada'), decision: 'aprobar', dificultad: 'Difícil' },
  ],
  desempate: docente('tres@ejemplo.cl'),
  venceEn: '2099-11-08T12:00:00.000Z',
};

const pagina = (preguntas: PreguntaSeguida[], area = true): Carga<PaginaSeguimiento> => ({
  tipo: 'lista',
  datos: {
    seguimiento: {
      preguntas,
      conteos: { en_curso: 12, en_desempate: 2, vencidas: 1, terminadas: 4 },
      sinDocentes: area ? [{ area: 'Historia', preguntas: 3 }] : [],
      plazoDias: 3,
    },
    paginacion: { pagina: 1, porPagina: 20, total: preguntas.length },
  },
});

function preparar(carga: Carga<PaginaSeguimiento>) {
  vi.mocked(useSeguimiento).mockReturnValue({
    carga,
    grupo: 'en_curso',
    elegirGrupo: vi.fn(),
    irAPagina: vi.fn(),
  });
}

const dibujar = () =>
  renderToString(
    <MemoryRouter>
      <PaginaRevisiones />
    </MemoryRouter>,
  );

beforeEach(() => preparar(pagina([pregunta])));

describe('Revisiones C06', () => {
  it('muestra las pestañas con sus cantidades, los docentes y el estado de la pregunta', () => {
    const html = dibujar();
    for (const texto of [
      'En curso (12)',
      'Vencidas (1)',
      'P-0244',
      'Figuras geométricas',
      'uno@ejemplo.cl',
      'Aprobó · Fácil',
      'Aprobó · Difícil',
      'tres@ejemplo.cl',
      'En desempate',
      'Posiblemente confusa',
      'días desde la asignación',
    ]) {
      expect(html).toContain(texto);
    }
    expect(html).toContain('href="/banco/244"');
  });

  it('avisa del área sin docentes y enlaza a Usuarios internos', () => {
    const html = dibujar();

    expect(html).toContain('Historia: 3 preguntas en borrador sin docentes suficientes');
    expect(html).toContain('href="/usuarios-internos"');
  });

  it('sin preguntas lo dice, sin tabla, paginación ni aviso de áreas', () => {
    preparar(pagina([], false));

    const html = dibujar();

    expect(html).toContain('No hay preguntas en este grupo.');
    expect(html).not.toContain('<table');
    expect(html).not.toContain('Página');
    expect(html).not.toContain('Usuarios internos');
  });

  it('mientras carga no inventa las cantidades', () => {
    preparar({ tipo: 'cargando' });

    const html = dibujar();

    expect(html).toContain('Cargando las revisiones');
    expect(html).not.toContain('En curso (');
  });

  it('escribe lo que hizo cada docente, también si venció su plazo', () => {
    expect(etiquetaDeDocente(docente('a@ejemplo.cl'), false).texto).toBe('Pendiente');
    expect(etiquetaDeDocente(docente('a@ejemplo.cl'), true).texto).toBe('Vencida');
    expect(etiquetaDeDocente(docente('a@ejemplo.cl', 'vencida'), false).texto).toBe('Vencida');
    expect(
      etiquetaDeDocente({ ...docente('a@ejemplo.cl'), decision: 'rechazar' }, true).texto,
    ).toBe('Rechazó');
  });

  it('usa singular en el aviso de una pregunta', () => {
    expect(avisoSinDocentes({ area: 'Ciencias', preguntas: 1 })).toBe(
      'Ciencias: 1 pregunta en borrador sin docentes suficientes para revisarlas.',
    );
  });
});
