// @vitest-environment jsdom
import { act } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import {
  api,
  esperar,
  escribirEn,
  pulsar,
  respuestaDeError,
  usarPantallaDePrueba,
} from '../../pruebas/interaccion';
import { PaginaMiSaldo } from './PaginaMiSaldo';
import { PaginaRemuneracion } from './PaginaRemuneracion';
import { seccionesDelRol } from '../../rutas/secciones';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const pantalla = usarPantallaDePrueba();
const detalle = {
  revisionId: 1,
  preguntaId: 22,
  fecha: '2026-11-28T12:00:00Z',
  tipo: 'revision',
  montoClp: 500,
};
const saldo = (filas = [detalle], total = filas.length) => ({
  cuerpo: {
    data: {
      docente: { id: 21, nombre: 'Ana' },
      resumen: { totalClp: 1500, mesClp: 1000, cantidad: 3, cantidadMes: 2 },
      capacidad: { pendientes: 15, completadas: 5, maxPendientes: 20, maxDiarias: 50 },
      detalle: filas,
    },
    error: null,
    meta: { pagina: 1, porPagina: 20, total },
  },
});
const tarifas = {
  tarifas: [
    {
      id: 1,
      montoClp: 500,
      vigenteDesde: '2026-11-28T00:00:00Z',
      creadoEn: '2026-11-28T00:00:00Z',
    },
  ],
  docentes: [{ id: 21, nombre: 'Ana' }],
};
const respuestaTarifas = () => ({ cuerpo: { data: tarifas, error: null, meta: null } });
async function montar(admin = false) {
  act(() =>
    pantalla.raiz.render(
      <MemoryRouter>{admin ? <PaginaRemuneracion /> : <PaginaMiSaldo />}</MemoryRouter>,
    ),
  );
  await esperar();
}
const boton = (texto: string) =>
  [...pantalla.contenedor.querySelectorAll('button')].find((b) => b.textContent === texto)!;

describe('Mi saldo y remuneración docente', () => {
  it('muestra acumulados, detalle y cupos con el menú de cada rol', async () => {
    const llamadas = api(saldo());
    await montar();
    expect(pantalla.contenedor.textContent).toContain('Mi saldo');
    expect(pantalla.contenedor.textContent).toContain('$1.500');
    expect(pantalla.contenedor.textContent).toContain('$1.000');
    expect(pantalla.contenedor.textContent).toContain('Pregunta 22');
    expect(pantalla.contenedor.textContent).toContain('Pendientes: 15 de 20');
    expect(llamadas[0]!.ruta).toBe('/admin/revision/mi-saldo?pagina=1');
    expect(seccionesDelRol('docente').map((s) => s.titulo)).toContain('Mi saldo');
    expect(seccionesDelRol('admin').map((s) => s.titulo)).toContain('Remuneración docente');
    expect(seccionesDelRol('docente').map((s) => s.titulo)).not.toContain('Remuneración docente');
  });
  it('filtra por fechas y limpia los filtros', async () => {
    const llamadas = api(saldo(), saldo([]), saldo());
    await montar();
    escribirEn(pantalla.contenedor.querySelectorAll('input')[0]!, '2026-11-01');
    escribirEn(pantalla.contenedor.querySelectorAll('input')[1]!, '2026-11-28');
    await pulsar(boton('Filtrar'));
    expect(llamadas[1]!.ruta).toContain('desde=2026-11-01&hasta=2026-11-28');
    expect(pantalla.contenedor.textContent).toContain('No hay revisiones remuneradas');
    expect(pantalla.contenedor.textContent).toContain('$1.500');
    await pulsar(boton('Limpiar filtros'));
    expect(llamadas[2]!.ruta).toBe('/admin/revision/mi-saldo?pagina=1');
  });
  it('pagina el detalle y muestra los desempates', async () => {
    const llamadas = api(saldo([detalle], 21), saldo([{ ...detalle, tipo: 'desempate' }], 21));
    await montar();
    await pulsar(boton('Siguiente'));
    expect(llamadas[1]!.ruta).toContain('pagina=2');
    expect(pantalla.contenedor.querySelector('tbody')!.textContent).toContain('Desempate');
  });
  it('muestra error y permite reintentar', async () => {
    api(respuestaDeError(503, 'NO_DISPONIBLE', 'Intenta nuevamente.'), saldo());
    await montar();
    expect(pantalla.contenedor.textContent).toContain('Intenta nuevamente.');
    await pulsar(boton('Reintentar'));
    expect(pantalla.contenedor.textContent).toContain('Pregunta 22');
  });
  it('muestra carga mientras la consulta está pendiente', () => {
    api(saldo());
    act(() => pantalla.raiz.render(<PaginaMiSaldo />));
    expect(pantalla.contenedor.textContent).toContain('Cargando saldo...');
  });
  it('el administrador registra otra tarifa sin cambiar el historial mostrado', async () => {
    const llamadas = api(
      respuestaTarifas(),
      {
        cuerpo: { data: { ...tarifas.tarifas[0], id: 2, montoClp: 600 }, error: null, meta: null },
        estado: 201,
      },
      respuestaTarifas(),
    );
    await montar(true);
    escribirEn(pantalla.contenedor.querySelector('input[type="number"]')!, '600');
    await pulsar(boton('Registrar tarifa'));
    expect(llamadas[1]).toMatchObject({
      metodo: 'POST',
      ruta: '/admin/revision/tarifas',
      cuerpo: { montoClp: 600, ultimaTarifaId: 1 },
    });
    expect(pantalla.contenedor.textContent).toContain('Los montos anteriores se conservan');
    expect(pantalla.contenedor.querySelector('tbody')!.textContent).toContain('$500');
  });
  it('el administrador selecciona un docente para consultar su saldo', async () => {
    const llamadas = api(respuestaTarifas(), saldo());
    await montar(true);
    const selector = pantalla.contenedor.querySelector('select')!;
    act(() => {
      Reflect.set(HTMLSelectElement.prototype, 'value', '21', selector);
      selector.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await esperar();
    expect(llamadas[1]!.ruta).toBe('/admin/revision/saldos/21?pagina=1');
    expect(pantalla.contenedor.textContent).toContain('Saldo de Ana');
  });
});
