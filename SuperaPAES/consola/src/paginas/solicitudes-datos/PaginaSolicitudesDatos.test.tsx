// @vitest-environment jsdom
// Solicitudes de datos C14 (HU-55.2) con interacción real: el hook useSolicitudesDatos, los componentes y
// el cliente HTTP son los de verdad; solo se reemplaza fetch, que responde como la API.
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  api,
  escribirEn,
  esperar,
  pulsar,
  tecla,
  usarPantallaDePrueba,
  type RespuestaFalsa,
} from '../../pruebas/interaccion';
import type { SolicitudDeDatos } from '../../tipos/solicitudes-datos';
import { PaginaSolicitudesDatos } from './PaginaSolicitudesDatos';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const RUTA = '/admin/privacidad/solicitudes';
const PENDIENTE = { codigo: 'pendiente', nombre: 'Pendiente' };

const solicitud = (id: number, cambios: Partial<SolicitudDeDatos> = {}): SolicitudDeDatos => ({
  id,
  tipo: { codigo: 'rectificacion', nombre: 'Rectificación' },
  detalle: 'Mi nombre quedó mal escrito.',
  estado: PENDIENTE,
  solicitadoEn: '2026-10-11T15:00:00.000Z',
  venceEn: '2026-11-10T15:00:00.000Z',
  diasRestantes: -2,
  vencida: true,
  respondidoEn: null,
  respuesta: null,
  atendidoPor: null,
  estudiante: { id: 84, nombre: 'Ana Ejemplo', correo: 'ana@ejemplo.cl', cuentaEliminada: false },
  ...cambios,
});

const VENCIDA = solicitud(31);
const A_TIEMPO = solicitud(32, {
  tipo: { codigo: 'acceso', nombre: 'Acceso' },
  detalle: null,
  venceEn: '2026-11-28T15:00:00.000Z',
  diasRestantes: 16,
  vencida: false,
  estudiante: { id: 85, nombre: 'Beto Ejemplo', correo: 'beto@ejemplo.cl', cuentaEliminada: false },
});

const bandeja = (
  solicitudes: SolicitudDeDatos[],
  pendientes = solicitudes.length,
): RespuestaFalsa => ({
  cuerpo: {
    data: { solicitudes, pendientes },
    error: null,
    meta: { pagina: 1, porPagina: 20, total: solicitudes.length },
  },
});
const error = (estado: number, codigo: string, mensaje: string): RespuestaFalsa => ({
  cuerpo: { data: null, error: { codigo, mensaje }, meta: null },
  estado,
});

const pantalla = usarPantallaDePrueba();

async function montar() {
  act(() => pantalla.raiz.render(<PaginaSolicitudesDatos />));
  await esperar();
}

const texto = () => pantalla.contenedor.textContent ?? '';
const campo = () => pantalla.contenedor.querySelector<HTMLTextAreaElement>('#solicitud-respuesta');
const dialogo = () => pantalla.contenedor.querySelector<HTMLElement>('[role="alertdialog"]');
const aviso = () => pantalla.contenedor.querySelector('.aviso')?.textContent;
const boton = (etiqueta: string, dentro: ParentNode = pantalla.contenedor) =>
  [...dentro.querySelectorAll('button')].find((b) => b.textContent === etiqueta)!;
const filas = () =>
  [...pantalla.contenedor.querySelectorAll('tbody tr')].map((fila) => fila.textContent);

const escribir = (valor: string) => escribirEn(campo()!, valor);

describe('bandeja de solicitudes (HU-55 esc. 1)', () => {
  it('avisa que carga y luego muestra las pendientes en el orden de la API, con su plazo en texto', async () => {
    const llamadas = api(bandeja([VENCIDA, A_TIEMPO]));
    act(() => pantalla.raiz.render(<PaginaSolicitudesDatos />));
    expect(texto()).toContain('Cargando solicitudes…');
    await esperar();

    expect(llamadas[0]).toMatchObject({ metodo: 'GET', ruta: `${RUTA}?estado=pendiente` });
    expect(texto()).not.toContain('En construcción');
    expect(boton('Pendientes (2)').getAttribute('aria-pressed')).toBe('true');
    expect(filas()).toHaveLength(2);
    expect(filas()[0]).toContain('10-11-2026');
    expect(filas()[0]).toContain('Vencida hace 2 días');
    expect(filas()[0]).toContain('ana@ejemplo.cl');
    expect(filas()[1]).toContain('Vence en 16 días');
    expect(pantalla.contenedor.querySelector('.plazo--vencida')?.textContent).toBe(
      'Vencida hace 2 días',
    );
  });

  it('sin pendientes lo dice', async () => {
    api(bandeja([]));
    await montar();

    expect(texto()).toContain('No hay solicitudes pendientes.');
    expect(pantalla.contenedor.querySelector('table')).toBeNull();
  });

  it('si la carga falla muestra el error y Reintentar vuelve a pedir la bandeja', async () => {
    const llamadas = api(error(500, 'ERROR_INTERNO', 'Falló la bandeja.'), bandeja([VENCIDA]));
    await montar();
    expect(texto()).toContain('Falló la bandeja.');

    await pulsar(boton('Reintentar'));

    expect(llamadas).toHaveLength(2);
    expect(filas()).toHaveLength(1);
  });

  it('elegir otra fila muestra su detalle; la pestaña Respondidas pide ese estado', async () => {
    const atendida = solicitud(33, {
      estado: { codigo: 'respondida', nombre: 'Respondida' },
      diasRestantes: null,
      vencida: false,
      respondidoEn: '2026-11-12T15:00:00.000Z',
      respuesta: 'Corregimos tu nombre.',
      atendidoPor: { id: 1, nombre: 'Ana Admin' },
    });
    const llamadas = api(bandeja([VENCIDA, A_TIEMPO]), bandeja([atendida], 2));
    await montar();

    await pulsar(boton('Acceso'));
    expect(pantalla.contenedor.querySelector('#solicitud-titulo')?.textContent).toBe(
      'Acceso · beto@ejemplo.cl',
    );
    expect(texto()).toContain('Sin detalle.');

    await pulsar(boton('Respondidas'));
    expect(llamadas[1]?.ruta).toBe(`${RUTA}?estado=respondida`);
    expect(texto()).toContain('Corregimos tu nombre.');
    expect(texto()).toContain('Atendida por Ana Admin el 12-11-2026.');
    expect(campo()).toBeNull();
  });

  it('una cuenta eliminada se muestra sin datos personales y avisa que no verá la respuesta', async () => {
    const eliminada = solicitud(34, {
      estudiante: { id: 90, nombre: null, correo: null, cuentaEliminada: true },
    });
    api(bandeja([eliminada]));
    await montar();

    expect(filas()[0]).toContain('Cuenta eliminada');
    expect(texto()).toContain('La cuenta fue eliminada: el estudiante no podrá ver la respuesta.');
  });
});

describe('responder o rechazar (HU-55 esc. 2)', () => {
  it('sin texto muestra el error junto al campo y no abre la confirmación', async () => {
    const llamadas = api(bandeja([VENCIDA]));
    await montar();

    await pulsar(boton('Responder'));

    expect(campo()?.getAttribute('aria-invalid')).toBe('true');
    const mensaje = document.getElementById('solicitud-respuesta-error');
    expect(mensaje?.textContent).toBe('Escribe la respuesta al estudiante.');
    expect(campo()?.getAttribute('aria-describedby')).toContain('solicitud-respuesta-error');
    expect(dialogo()).toBeNull();
    expect(llamadas).toHaveLength(1);
  });

  it('la confirmación retiene el foco; Escape la cierra sin enviar y devuelve el foco', async () => {
    const llamadas = api(bandeja([VENCIDA]));
    await montar();
    escribir('Corregimos tu nombre.');
    const rechazar = boton('Rechazar');

    await pulsar(rechazar);
    expect(dialogo()?.textContent).toContain('¿Rechazar la solicitud?');
    expect(dialogo()?.textContent).toContain('Corregimos tu nombre.');
    expect(document.activeElement?.textContent).toBe('Cancelar');
    await tecla('Tab', true);
    expect(document.activeElement?.textContent).toBe('Rechazar');
    await tecla('Tab');
    expect(document.activeElement?.textContent).toBe('Cancelar');
    await tecla('Escape');

    expect(dialogo()).toBeNull();
    await vi.waitFor(() => expect(document.activeElement).toBe(rechazar));
    expect(llamadas).toHaveLength(1);
  });

  it('al confirmar guarda la respuesta, avisa y recarga la bandeja', async () => {
    const llamadas = api(
      bandeja([VENCIDA]),
      { cuerpo: { data: {}, error: null, meta: null } },
      bandeja([]),
    );
    await montar();
    escribir('  Corregimos tu nombre.  ');

    await pulsar(boton('Responder'));
    await pulsar(boton('Responder', dialogo()!));

    expect(llamadas[1]).toEqual({
      metodo: 'PATCH',
      ruta: `${RUTA}/31`,
      cuerpo: { estado: 'respondida', respuesta: 'Corregimos tu nombre.' },
    });
    expect(llamadas).toHaveLength(3);
    expect(dialogo()).toBeNull();
    expect(aviso()).toBe('Solicitud respondida. El estudiante verá la respuesta en la app.');
    expect(texto()).toContain('No hay solicitudes pendientes.');
  });

  it('si otro administrador ya la atendió, muestra el aviso de la API y recarga', async () => {
    const llamadas = api(
      bandeja([VENCIDA]),
      error(409, 'CONFLICTO', 'La solicitud ya está «Respondida».'),
      bandeja([]),
    );
    await montar();
    escribir('No corresponde.');

    await pulsar(boton('Rechazar'));
    await pulsar(boton('Rechazar', dialogo()!));

    expect(llamadas[1]?.cuerpo).toEqual({ estado: 'rechazada', respuesta: 'No corresponde.' });
    expect(dialogo()).toBeNull();
    expect(aviso()).toBe('La solicitud ya está «Respondida».');
    expect(llamadas).toHaveLength(3);
  });
});
