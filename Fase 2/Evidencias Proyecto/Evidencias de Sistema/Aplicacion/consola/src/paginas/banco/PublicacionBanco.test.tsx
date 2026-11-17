// Publicar, retirar y volver a borrador desde el banco (C02, HU-24.2, CU-21, RF-G09): la acción según la
// etapa de cada pregunta, de a una, los avisos y la llamada a la API.
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { accionDe, avisoDeEtapa } from '../../estado/acciones-banco';
import { primeraLlamada, responderUnaVez } from '../../pruebas/sesion';
import { dibujarTabla, filaDe, preguntaEnEtapa } from '../../pruebas/tabla-banco';
import { cambiarEtapa } from '../../servicios/preguntas';
import { TablaBanco } from './TablaBanco';

afterEach(() => vi.unstubAllGlobals());

const PREGUNTAS = [
  preguntaEnEtapa(1, 'aprobada', 'Aprobada'),
  preguntaEnEtapa(2, 'publicada', 'Publicada'),
  preguntaEnEtapa(3, 'retirada', 'Retirada'),
  preguntaEnEtapa(4, 'en_revision', 'En revisión'),
  preguntaEnEtapa(5, 'en_desempate', 'En desempate'),
];

describe('la acción de cada etapa en el banco (HU-24.2)', () => {
  it('«Publicar» en las aprobadas, «Retirar» en las publicadas y «Volver a borrador» en las retiradas', () => {
    const html = dibujarTabla(PREGUNTAS, null);

    expect(filaDe(html, 1)).toContain('>Publicar</button>');
    expect(filaDe(html, 2)).toContain('>Retirar</button>');
    expect(filaDe(html, 3)).toContain('>Volver a borrador</button>');
    expect(filaDe(html, 4)).not.toContain('<button');
    expect(filaDe(html, 5)).not.toContain('<button');
  });

  it('mientras se hace una, todas esperan; la hecha lo indica hasta que el banco se recarga', () => {
    const publicando = dibujarTabla(PREGUNTAS, 1);
    const hechas = dibujarTabla(PREGUNTAS, null, [2, 3]);

    expect(filaDe(publicando, 1)).toContain('disabled="">Publicando…</button>');
    expect(filaDe(publicando, 2)).toContain('disabled="">Retirar</button>');
    expect(filaDe(hechas, 2)).toContain('disabled="">Retirada</button>');
    expect(filaDe(hechas, 3)).toContain('disabled="">En borrador</button>');
    expect(filaDe(hechas, 1)).toMatch(/<button type="button" class="boton">Publicar<\/button>/);
  });

  it('una acción hecha no bloquea la siguiente de esa pregunta cuando el banco se recarga', () => {
    // La 2 se publicó (2:publicar) y el banco recargado la trae publicada: «Retirar» queda disponible.
    const html = renderToString(
      <MemoryRouter>
        <TablaBanco
          preguntas={PREGUNTAS}
          acciones={{ enCurso: null, hechas: new Set(['2:publicar']), ejecutar: () => undefined }}
        />
      </MemoryRouter>,
    );

    expect(filaDe(html, 2)).toMatch(/<button type="button" class="boton">Retirar<\/button>/);
  });

  it('la acción sale de la etapa; una editable siempre se envía a revisión', () => {
    expect(accionDe({ editable: true, estado: { codigo: 'borrador', nombre: 'Borrador' } })).toBe(
      'enviar',
    );
    expect(accionDe({ editable: false, estado: { codigo: 'aprobada', nombre: 'Aprobada' } })).toBe(
      'publicar',
    );
    expect(
      accionDe({ editable: false, estado: { codigo: 'rechazada', nombre: 'Rechazada' } }),
    ).toBeNull();
  });
});

describe('avisos y API (HU-24 esc. 1 y 2)', () => {
  it('el aviso dice en qué quedó la pregunta y si llega a la app', () => {
    expect(avisoDeEtapa('publicar', 84)).toBe('La pregunta 84 quedó publicada: ya llega a la app.');
    expect(avisoDeEtapa('retirar', 84)).toBe(
      'La pregunta 84 quedó retirada: ya no llega a la app.',
    );
    expect(avisoDeEtapa('borrador', 84)).toBe(
      'La pregunta 84 volvió a borrador: puedes corregirla y enviarla a revisión.',
    );
  });

  it.each(['publicar', 'retirar', 'borrador'] as const)(
    '%s llama a la API de la pregunta',
    async (cambio) => {
      const respuesta = { id: 84, estado: { codigo: 'publicada', nombre: 'Publicada' } };
      responderUnaVez({ data: respuesta, error: null, meta: null });

      expect(await cambiarEtapa(84, cambio)).toEqual(respuesta);
      expect(primeraLlamada()).toMatchObject({
        url: `/admin/preguntas/84/${cambio}`,
        metodo: 'POST',
      });
    },
  );
});
