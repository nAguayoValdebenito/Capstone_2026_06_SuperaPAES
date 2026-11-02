// Enviar a revisión desde el banco (C02, HU-21, CU-18): la acción solo en las preguntas en borrador u
// observadas, de a una; el aviso con quiénes la revisan y la llamada a la API.
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { avisoDeEnvio } from '../../estado/envio-revision';
import { responderUnaVez } from '../../pruebas/sesion';
import { enviarARevision } from '../../servicios/revision';
import type { PreguntaDelBanco } from '../../tipos';
import { TablaBanco } from './TablaBanco';

afterEach(() => vi.unstubAllGlobals());

const pregunta = (id: number, codigo: string, nombre: string): PreguntaDelBanco => ({
  id,
  resumen: `Pregunta ${String(id)}`,
  prueba: { id: 4, codigo: 'HCS', nombre: 'Historia y Ciencias Sociales' },
  eje: { id: 40, nombre: 'Historia' },
  contenido: { id: 400, nombre: 'Derechos laborales' },
  estado: { codigo, nombre },
  origen: 'manual',
  dificultadSugerida: null,
  dificultadAsignada: null,
  posibleAmbigua: false,
  actualizadoEn: '2026-11-01T12:00:00.000Z',
});

const PREGUNTAS = [
  pregunta(1, 'borrador', 'Borrador'),
  pregunta(2, 'observada', 'Observada'),
  pregunta(3, 'en_revision', 'En revisión'),
  pregunta(4, 'publicada', 'Publicada'),
];

const dibujar = (enviando: number | null) =>
  renderToString(
    <MemoryRouter>
      <TablaBanco preguntas={PREGUNTAS} envio={{ enviando, enviar: () => undefined }} />
    </MemoryRouter>,
  );

/** La fila de la pregunta en el HTML de la tabla. */
const fila = (html: string, id: number) =>
  html.split('<tr>').find((parte) => parte.includes(`Pregunta ${String(id)}<`)) ?? '';

describe('enviar a revisión desde el banco (HU-21)', () => {
  it('ofrece «Enviar a revisión» solo en las preguntas en borrador u observadas', () => {
    const html = dibujar(null);

    expect(fila(html, 1)).toContain('>Enviar a revisión</button>');
    expect(fila(html, 2)).toContain('>Enviar a revisión</button>');
    expect(fila(html, 3)).not.toContain('<button');
    expect(fila(html, 4)).not.toContain('<button');
  });

  it('mientras envía una, todas esperan y la enviada lo indica', () => {
    const html = dibujar(1);

    expect(fila(html, 1)).toContain('disabled="">Enviando…</button>');
    expect(fila(html, 2)).toContain('disabled="">Enviar a revisión</button>');
  });

  it('sin la acción de envío (por ejemplo, en pruebas de solo lectura) la tabla no la muestra', () => {
    const html = renderToString(
      <MemoryRouter>
        <TablaBanco preguntas={PREGUNTAS} />
      </MemoryRouter>,
    );

    expect(html).not.toContain('Enviar a revisión');
  });

  it('el aviso dice qué pregunta quedó en revisión y quiénes la revisan', () => {
    const docente = (id: number, nombre: string) => ({
      asignacionId: id,
      docente: { id, nombre, correo: `${nombre}@superapaes.cl` },
      venceEn: '2026-11-05T12:00:00.000Z',
    });

    expect(
      avisoDeEnvio({
        preguntaId: 84,
        ronda: 1,
        version: 1,
        revisores: [docente(21, 'Ana Pérez'), docente(22, 'Luis Soto')],
      }),
    ).toBe('La pregunta 84 quedó en revisión: la revisan Ana Pérez y Luis Soto.');
  });

  it('llama a la API de revisión con la pregunta', async () => {
    const envio = { preguntaId: 84, ronda: 1, version: 1, revisores: [] };
    responderUnaVez({ data: envio, error: null, meta: null }, 201);

    expect(await enviarARevision(84)).toEqual(envio);
    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(url).toMatch(/\/api\/v1\/admin\/revision\/preguntas\/84$/);
    expect(init?.method).toBe('POST');
  });
});
