// @vitest-environment jsdom
// Acciones en lote del banco clic tras clic (C02): cada clic procesa las 10 siguientes del filtro, vuelve
// a contar y el botón sigue ahí para el próximo lote; sin ninguna, queda deshabilitado pero visible.
import { act, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { useAccionesEnLote } from '../../estado/acciones-lote-banco';
import { api, esperar, pulsar, usarPantallaDePrueba } from '../../pruebas/interaccion';
import type { FiltrosBanco } from '../../tipos';
import { BotonesEnLote } from './AccionesEnLote';

const pantalla = usarPantallaDePrueba();
const FILTROS: FiltrosBanco = { prueba: 2 };

/** El banco mínimo: los botones con el hook real y el aviso; terminar recarga (vuelve a contar). */
function Banco() {
  const [vuelta, setVuelta] = useState(0);
  const lote = useAccionesEnLote(FILTROS, vuelta, () => setVuelta((actual) => actual + 1));
  return (
    <>
      <BotonesEnLote acciones={lote} />
      {lote.aviso && <p id="aviso">{lote.aviso.texto}</p>}
    </>
  );
}

const boton = (inicio: string) =>
  [...pantalla.contenedor.querySelectorAll('button')].find((b) =>
    b.textContent.startsWith(inicio),
  )!;
const aviso = () => pantalla.contenedor.querySelector('#aviso')?.textContent;
const conteo = (paraRevision: number, paraPublicar: number) => ({
  cuerpo: { data: { paraRevision, paraPublicar }, error: null, meta: null },
});
const envios = (cantidad: number) => ({
  cuerpo: {
    data: {
      enviadas: Array.from({ length: cantidad }, (_, i) => ({
        preguntaId: i + 1,
        ronda: 1,
        version: 1,
        revisores: [],
      })),
      noEnviadas: [],
    },
    error: null,
    meta: null,
  },
});
const publicadas = (cantidad: number) => ({
  cuerpo: {
    data: { publicadas: Array.from({ length: cantidad }, (_, i) => i + 1), noPublicadas: [] },
    error: null,
    meta: null,
  },
});

async function dibujar() {
  act(() => pantalla.raiz.render(<Banco />));
  await esperar();
}

describe('acciones en lote clic tras clic', () => {
  it('envía a revisión de 10 en 10 hasta que no queda ninguna, sin que el botón desaparezca', async () => {
    const llamadas = api(
      conteo(23, 0),
      envios(10),
      conteo(13, 0),
      envios(10),
      conteo(3, 0),
      envios(3),
      conteo(0, 0),
    );
    await dibujar();
    expect(boton('Enviar a revisión').textContent).toBe('Enviar a revisión (10)');

    await pulsar(boton('Enviar a revisión'));
    expect(aviso()).toBe('10 preguntas enviadas a revisión.');
    expect(boton('Enviar a revisión').textContent).toBe('Enviar a revisión (10)');

    await pulsar(boton('Enviar a revisión'));
    expect(boton('Enviar a revisión').textContent).toBe('Enviar a revisión (3)');

    await pulsar(boton('Enviar a revisión'));
    expect(aviso()).toBe('3 preguntas enviadas a revisión.');
    expect(boton('Enviar a revisión').textContent).toBe('Enviar a revisión (0)');
    expect(boton('Enviar a revisión').disabled).toBe(true);
    expect(boton('Aceptar y publicar').textContent).toBe('Aceptar y publicar (0)');
    expect(llamadas.filter((l) => l.metodo === 'POST').map((l) => l.ruta)).toEqual([
      '/admin/revision/preguntas/lote?prueba=2',
      '/admin/revision/preguntas/lote?prueba=2',
      '/admin/revision/preguntas/lote?prueba=2',
    ]);
  });

  it('acepta y publica de 10 en 10, con confirmación en cada clic', async () => {
    const llamadas = api(conteo(0, 12), publicadas(10), conteo(0, 2), publicadas(2), conteo(0, 0));
    await dibujar();

    for (const quedan of [10, 2]) {
      expect(boton('Aceptar y publicar').textContent).toBe(
        `Aceptar y publicar (${String(quedan)})`,
      );
      await pulsar(boton('Aceptar y publicar'));
      const confirmar = [...pantalla.contenedor.querySelectorAll('dialog button')].find(
        (b) => b.textContent === 'Aceptar y publicar',
      ) as HTMLButtonElement;
      await pulsar(confirmar);
      expect(aviso()).toBe(`${String(quedan)} preguntas publicadas.`);
    }

    expect(boton('Aceptar y publicar').textContent).toBe('Aceptar y publicar (0)');
    expect(boton('Aceptar y publicar').disabled).toBe(true);
    expect(llamadas.filter((l) => l.metodo === 'POST')).toHaveLength(2);
  });
});
