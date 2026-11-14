// D04 · Calibración (HU-26.3): carga, error con reintento, vacío, cada pregunta con su dificultad, el
// acierto con su rango en texto (no solo la barra), intentos y tiempo, las dos decisiones con su
// confirmación, que Escape cierra sin enviar, y las llamadas a la API.
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  alPresionarTecla,
  textoDeAcierto,
  textoDeConfirmacion,
  textoDeEstadistica,
  textoDeResultado,
  textoDeTiempo,
  type EstadoCalibracion,
} from '../../estado/calibracion';
import { primeraLlamada, responderUnaVez } from '../../pruebas/sesion';
import { estadisticasDePreguntas } from '../../servicios/evaluaciones';
import { decidirCalibracion, listarCalibracion, listarConfirmadas } from '../../servicios/revision';
import type { ItemCalibracion } from '../../tipos/calibracion';
import { ConfirmarDecision } from './ConfirmarDecision';
import { VistaCalibracion } from './PaginaCalibracion';

afterEach(() => vi.unstubAllGlobals());

const MEDIA = { codigo: 'media', nombre: 'Media', aciertoEsperadoMin: 40, aciertoEsperadoMax: 70 };

const ITEM: ItemCalibracion = {
  preguntaId: '205',
  enunciado: '¿Qué proceso explica la migración campo-ciudad?',
  prueba: 'Historia y Ciencias Sociales',
  contenido: 'Urbanización en Chile',
  dificultad: MEDIA,
  intentos: 40,
  aciertos: 11,
  porcentajeAcierto: 27.5,
  tiempoPromedioSeg: 65,
  confirmaciones: 1,
  descartes: 0,
};

function estado(cambios: Partial<EstadoCalibracion> = {}): EstadoCalibracion {
  return {
    carga: { tipo: 'lista', datos: [ITEM] },
    reintentar: vi.fn(),
    pendiente: null,
    abrir: vi.fn(),
    cancelar: vi.fn(),
    confirmar: vi.fn(),
    mensaje: null,
    enCurso: false,
    ...cambios,
  };
}

const dibujar = (e: EstadoCalibracion) => renderToString(<VistaCalibracion estado={e} />);

describe('D04 · estados de la bandeja', () => {
  it('muestra que carga, y el error de la API con Reintentar', () => {
    const cargando = dibujar(estado({ carga: { tipo: 'cargando' } }));
    const fallida = dibujar(
      estado({ carga: { tipo: 'fallida', codigo: 'ERROR_INTERNO', mensaje: 'Falló la bandeja.' } }),
    );

    expect(cargando).toContain('Cargando preguntas…');
    expect(fallida).toContain('Falló la bandeja.');
    expect(fallida).toContain('ERROR_INTERNO');
    expect(fallida).toContain('Reintentar');
    expect(fallida).not.toContain('<table');
  });

  it('sin preguntas lo dice', () => {
    const html = dibujar(estado({ carga: { tipo: 'lista', datos: [] } }));

    expect(html).toContain('No hay preguntas para calibrar.');
    expect(html).not.toContain('<table');
  });

  it('anuncia el resultado de la decisión', () => {
    const html = dibujar(estado({ mensaje: { tipo: 'exito', texto: 'Listo.' } }));

    expect(html).toMatch(/role="status"[^>]*>Listo\./);
  });
});

describe('D04 · cada pregunta (HU-26 esc. 1, RN-15)', () => {
  it('muestra la pregunta, su dificultad, intentos, tiempo y cuántos decidieron', () => {
    const html = dibujar(estado());

    expect(html).toContain('aria-label="Preguntas para calibrar"');
    expect(html).toContain('P-205');
    expect(html).toContain('Historia y Ciencias Sociales · Urbanización en Chile');
    expect(html).toContain('<span class="etiqueta">Media</span>');
    expect(html).toContain('<td>40</td>');
    expect(html).toContain('1 min 5 s');
    expect(html).toContain('1 docente confirmó');
  });

  it('el acierto se lee en texto, con el rango y si cae bajo o sobre él; la barra es decorativa', () => {
    const html = dibujar(estado());

    expect(html).toContain('27,5 % · esperado 40–70 %, bajo el rango');
    expect(html).toMatch(/class="calibracion__barra" aria-hidden="true"/);
    expect(html).toContain('left:40%;width:30%');
    expect(html).toContain('calibracion__marca--bajo-el-rango');
  });

  it('ofrece las dos decisiones como botones', () => {
    const html = dibujar(estado());

    expect(html).toMatch(/<button type="button" class="boton">No corresponde<\/button>/);
    expect(html).toMatch(/<button type="button" class="boton">Está bien<\/button>/);
  });
});

describe('D04 · confirmación de la decisión', () => {
  it('explica qué pasa al confirmar y al descartar', () => {
    const confirmar = renderToString(
      <ConfirmarDecision
        pendiente={{ item: ITEM, dificultadCorresponde: false }}
        enCurso={false}
        alConfirmar={vi.fn()}
        alCancelar={vi.fn()}
      />,
    );
    const descartar = renderToString(
      <ConfirmarDecision
        pendiente={{ item: ITEM, dificultadCorresponde: true }}
        enCurso
        alConfirmar={vi.fn()}
        alCancelar={vi.fn()}
      />,
    );

    expect(confirmar).toContain('role="alertdialog"');
    expect(confirmar).toContain('¿Confirmas que la dificultad no corresponde?');
    expect(confirmar).toContain('nueva revisión con dos docentes');
    expect(descartar).toContain('¿La dificultad está bien?');
    expect(descartar).toContain('saldrá de tu bandeja');
    expect(descartar).toMatch(/disabled="">Guardando…/);
  });

  it('se muestra sobre la tabla cuando hay una decisión pendiente', () => {
    const html = dibujar(estado({ pendiente: { item: ITEM, dificultadCorresponde: false } }));

    expect(html).toContain('aria-labelledby="calibracion-titulo"');
  });

  it('Escape cancela sin enviar; otras teclas no hacen nada', () => {
    const cancelar = vi.fn();

    alPresionarTecla('Enter', cancelar);
    expect(cancelar).not.toHaveBeenCalled();
    alPresionarTecla('Escape', cancelar);
    expect(cancelar).toHaveBeenCalledOnce();
  });
});

describe('D04 · textos', () => {
  it('arma el acierto, el tiempo, las estadísticas del banco y los mensajes', () => {
    expect(textoDeAcierto(85, MEDIA)).toBe('85 % · esperado 40–70 %, sobre el rango');
    expect(textoDeAcierto(null, MEDIA)).toBe('Sin respuestas');
    expect(textoDeTiempo(55)).toBe('55 s');
    expect(textoDeTiempo(120)).toBe('2 min');
    expect(textoDeTiempo(null)).toBe('—');
    expect(
      textoDeEstadistica({
        preguntaId: '1',
        intentos: 1,
        aciertos: 1,
        porcentajeAcierto: 100,
        tiempoPromedioSeg: 20,
      }),
    ).toBe('1 intento · 100 % · 20 s');
    expect(textoDeEstadistica(undefined)).toBe('Sin respuestas');
    expect(textoDeConfirmacion(false, ITEM)).toContain('podrá retirarla');
    expect(textoDeResultado(true, '205')).toBe('Descartaste P-205: la dificultad se mantiene.');
  });
});

describe('D04 · llamadas a la API', () => {
  it('lista la bandeja y las confirmadas', async () => {
    responderUnaVez({ data: [ITEM], error: null, meta: { total: 1 } });
    expect(await listarCalibracion()).toEqual([ITEM]);
    expect(primeraLlamada().url).toBe('/admin/revision/calibracion');

    vi.unstubAllGlobals();
    responderUnaVez({ data: [], error: null, meta: { total: 0 } });
    await listarConfirmadas();
    expect(primeraLlamada().url).toBe('/admin/revision/calibracion/confirmadas');
  });

  it('decide con POST y solo si la dificultad corresponde', async () => {
    responderUnaVez({ data: {}, error: null, meta: null });

    await decidirCalibracion('205', false);

    expect(primeraLlamada()).toEqual({
      url: '/admin/revision/calibracion/205',
      metodo: 'POST',
      cuerpo: JSON.stringify({ dificultadCorresponde: false }),
    });
  });

  it('pide las estadísticas de la página del banco y no llama sin preguntas', async () => {
    expect(await estadisticasDePreguntas([])).toEqual([]);

    responderUnaVez({ data: [], error: null, meta: null });
    await estadisticasDePreguntas([3, 8]);
    expect(primeraLlamada().url).toBe('/admin/evaluaciones/estadisticas?preguntas=3,8');
  });
});
