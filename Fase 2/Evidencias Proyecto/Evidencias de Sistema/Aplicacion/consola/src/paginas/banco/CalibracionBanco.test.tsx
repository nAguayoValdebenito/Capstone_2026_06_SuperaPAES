// C02 con la calibración (HU-26.2 y HU-53): las confirmadas sobre la tabla, con Retirar, y la columna de
// respuestas con intentos, acierto y tiempo de cada pregunta.
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { AccionesDelBanco } from '../../estado/acciones-banco';
import { preguntaDelBanco } from '../../pruebas/banco';
import type { ConfirmadaCalibracion } from '../../tipos/calibracion';
import { ConfirmadasCalibracion } from './ConfirmadasCalibracion';
import { TablaBanco } from './TablaBanco';

const dibujar = (elemento: ReactElement) => renderToString(<MemoryRouter>{elemento}</MemoryRouter>);

const CONFIRMADA: ConfirmadaCalibracion = {
  preguntaId: '205',
  enunciado: '¿Qué proceso explica la migración campo-ciudad?',
  prueba: 'Historia y Ciencias Sociales',
  contenido: 'Urbanización en Chile',
  dificultad: { codigo: 'facil', nombre: 'Fácil', aciertoEsperadoMin: 70, aciertoEsperadoMax: 100 },
  intentos: 32,
  aciertos: 8,
  porcentajeAcierto: 25,
  tiempoPromedioSeg: 50,
  confirmaciones: 2,
  descartes: 1,
  confirmadaEn: '2026-11-13T15:00:00.000Z',
};

const acciones = (cambios: Partial<AccionesDelBanco> = {}): AccionesDelBanco => ({
  enCurso: null,
  hechas: new Set(),
  ejecutar: vi.fn(),
  ...cambios,
});

describe('C02 · confirmadas en calibración (HU-26.2)', () => {
  it('muestra cada confirmada con su acierto y rango en texto, las decisiones y Retirar', () => {
    const html = dibujar(
      <ConfirmadasCalibracion
        carga={{ tipo: 'lista', datos: [CONFIRMADA] }}
        acciones={acciones()}
      />,
    );

    expect(html).toContain('Confirmadas en calibración (1)');
    expect(html).toContain('href="/banco/205"');
    expect(html).toContain('Fácil: 25 % · esperado 70–100 %, bajo el rango · 32 intentos');
    expect(html).toContain('2 docentes confirmaron · 1 la descartó');
    expect(html).toMatch(/<button type="button" class="boton">Retirar<\/button>/);
  });

  it('una ya retirada no se vuelve a retirar', () => {
    const html = dibujar(
      <ConfirmadasCalibracion
        carga={{ tipo: 'lista', datos: [CONFIRMADA] }}
        acciones={acciones({ hechas: new Set(['205:retirar']) })}
      />,
    );

    expect(html).toMatch(/disabled="">Retirada<\/button>/);
  });

  it('sin confirmadas, o mientras carga, no muestra nada; el error de la API sí', () => {
    expect(dibujar(<ConfirmadasCalibracion carga={{ tipo: 'lista', datos: [] }} />)).toBe('');
    expect(dibujar(<ConfirmadasCalibracion carga={{ tipo: 'cargando' }} />)).toBe('');
    expect(
      dibujar(
        <ConfirmadasCalibracion
          carga={{ tipo: 'fallida', codigo: 'ERROR_INTERNO', mensaje: 'Falló.' }}
        />,
      ),
    ).toContain('Falló.');
  });
});

describe('C02 · estadísticas de cada pregunta (HU-53)', () => {
  it('con estadísticas, suma la columna Respuestas; sin respuestas lo dice', () => {
    const html = dibujar(
      <TablaBanco
        preguntas={[preguntaDelBanco({ id: 7 }), preguntaDelBanco({ id: 8 })]}
        estadisticas={
          new Map([
            [
              '7',
              {
                preguntaId: '7',
                intentos: 40,
                aciertos: 11,
                porcentajeAcierto: 27.5,
                tiempoPromedioSeg: 55,
              },
            ],
          ])
        }
      />,
    );

    expect(html).toContain('<th scope="col">Respuestas</th>');
    expect(html).toContain('40 intentos · 27,5 % · 55 s');
    expect(html).toContain('<td>Sin respuestas</td>');
  });

  it('sin estadísticas, la tabla queda como antes', () => {
    expect(dibujar(<TablaBanco preguntas={[preguntaDelBanco()]} />)).not.toContain('Respuestas');
  });
});
