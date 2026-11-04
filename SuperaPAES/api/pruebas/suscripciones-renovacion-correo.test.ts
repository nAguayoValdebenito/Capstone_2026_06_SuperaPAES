// HU-45.3 (CU-12 4.c, RN-05): el texto del aviso de renovación anual, con la fecha, el monto y cómo cancelar.
import { describe, expect, it } from 'vitest';
import { mensajeDeRenovacion } from '../modulos/suscripciones/suscripciones.renovacion.correo.js';

const DATOS = {
  nombre: 'Ana',
  para: 'ana@ejemplo.cl',
  plan: 'Todas las pruebas anual',
  periodoFin: new Date('2027-03-01T15:00:00.000Z'),
  montoClp: 23_990,
  tienda: 'google_play',
  gestionUrl: 'https://play.google.com/store/account/subscriptions?sku=x&package=y',
} as const;

describe('correo del aviso de renovación (HU-45.3)', () => {
  it('trae la fecha, el monto, la tienda y el enlace para cancelar', () => {
    const { para, asunto, texto } = mensajeDeRenovacion(DATOS);

    expect(para).toBe('ana@ejemplo.cl');
    expect(asunto).toBe('Tu plan anual de Supera PAES se renueva el 1 de marzo de 2027');
    expect(texto).toContain('Hola, Ana:');
    expect(texto).toContain('Tu plan Todas las pruebas anual se renueva el 1 de marzo de 2027.');
    expect(texto).toContain('Google Play cobrará $23.990.');
    expect(texto).toContain('Si cambiaste de plan, el monto puede ser distinto.');
    expect(texto).toContain(DATOS.gestionUrl);
  });

  it('la fecha es la de Chile, aunque en UTC ya sea el día siguiente', () => {
    const { asunto } = mensajeDeRenovacion({
      ...DATOS,
      periodoFin: new Date('2027-03-01T02:00:00.000Z'),
    });

    expect(asunto).toContain('el 28 de febrero de 2027');
  });

  it('nombra a la App Store cuando la compra es de ahí', () => {
    const { texto } = mensajeDeRenovacion({ ...DATOS, tienda: 'app_store' });

    expect(texto).toContain('La App Store cobrará $23.990.');
    expect(texto).toContain('en la gestión de suscripciones de la App Store');
    expect(texto).not.toContain('Google Play');
  });
});
