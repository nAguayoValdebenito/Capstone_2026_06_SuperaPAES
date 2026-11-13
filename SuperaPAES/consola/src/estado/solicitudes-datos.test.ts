// Reglas de presentación de C14 (HU-55.2): la etiqueta de plazo con texto (vencida, vence pronto, a
// tiempo), el singular y el plural, las fechas de Chile y la respuesta obligatoria.
import { describe, expect, it } from 'vitest';
import type { SolicitudDeDatos } from '../tipos/solicitudes-datos';
import {
  fechaChilena,
  pestanasDeEstado,
  plazoDe,
  quienAtendio,
  textoDeDias,
  validarRespuesta,
} from './solicitudes-datos';

const solicitud = (cambios: Partial<SolicitudDeDatos> = {}): SolicitudDeDatos => ({
  id: 31,
  tipo: { codigo: 'acceso', nombre: 'Acceso' },
  detalle: null,
  estado: { codigo: 'pendiente', nombre: 'Pendiente' },
  solicitadoEn: '2026-10-11T15:00:00.000Z',
  venceEn: '2026-11-10T15:00:00.000Z',
  diasRestantes: 10,
  vencida: false,
  respondidoEn: null,
  respuesta: null,
  atendidoPor: null,
  estudiante: { id: 84, nombre: 'Ana', correo: 'ana@ejemplo.cl', cuentaEliminada: false },
  ...cambios,
});

describe('etiqueta de plazo (vencida, vence pronto, a tiempo)', () => {
  it.each([
    [-1, true, 'vencida', 'Vencida hace 1 día'],
    [-3, true, 'vencida', 'Vencida hace 3 días'],
    [0, true, 'vencida', 'Venció hoy'],
    [0, false, 'pronto', 'Vence hoy'],
    [1, false, 'pronto', 'Vence en 1 día'],
    [7, false, 'pronto', 'Vence en 7 días'],
    [8, false, 'a-tiempo', 'Vence en 8 días'],
    [16, false, 'a-tiempo', 'Vence en 16 días'],
  ] as const)('%i días (vencida: %s) → %s, «%s»', (dias, vencida, tipo, texto) => {
    expect(plazoDe(solicitud({ diasRestantes: dias, vencida }))).toEqual({ tipo, texto });
  });

  it('una solicitud atendida no tiene plazo', () => {
    const atendida = solicitud({
      estado: { codigo: 'respondida', nombre: 'Respondida' },
      diasRestantes: null,
    });

    expect(plazoDe(atendida)).toBeNull();
  });
});

describe('textos', () => {
  it('usa singular y plural', () => {
    expect(textoDeDias(1)).toBe('1 día');
    expect(textoDeDias(3)).toBe('3 días');
  });

  it('muestra las fechas con día, mes y año en la hora de Chile', () => {
    // 1 de noviembre a las 02:00 UTC todavía es 31 de octubre en Chile.
    expect(fechaChilena('2026-11-01T02:00:00.000Z')).toBe('31-10-2026');
  });

  it('las pestañas cuentan las pendientes', () => {
    expect(pestanasDeEstado(1)[0]).toEqual({ valor: 'pendiente', texto: 'Pendientes (1)' });
    expect(pestanasDeEstado(4).map((p) => p.texto)).toEqual([
      'Pendientes (4)',
      'Respondidas',
      'Rechazadas',
    ]);
  });

  it('dice quién atendió y cuándo', () => {
    const atendida = solicitud({
      respondidoEn: '2026-11-12T15:00:00.000Z',
      atendidoPor: { id: 1, nombre: 'Ana Admin' },
    });

    expect(quienAtendio(atendida)).toBe('Atendida por Ana Admin el 12-11-2026.');
  });
});

describe('respuesta obligatoria', () => {
  it('rechaza el texto vacío o solo con espacios, y el de más de 2.000 caracteres', () => {
    expect(validarRespuesta('   ')).toBe('Escribe la respuesta al estudiante.');
    expect(validarRespuesta('a'.repeat(2001))).toBe(
      'La respuesta puede tener hasta 2.000 caracteres.',
    );
    expect(validarRespuesta(' Listo. ')).toBeNull();
  });
});
