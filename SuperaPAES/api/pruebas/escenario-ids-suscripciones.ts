// Trazabilidad de suscripciones en la consola (HU-56) para el contrato de ids: la lista, el detalle con
// su historial, pagos y avisos, y los avisos con error, con los ids BIGINT como texto, igual que la base.
import { vi } from 'vitest';

const fecha = new Date('2026-10-20T12:00:00.000Z');
const opcion = (codigo: string) => ({ codigo, nombre: codigo });
const fila = {
  id: '7',
  correo: 'ana@ejemplo.cl',
  plan: 'Todas las pruebas mensual',
  tienda: opcion('google_play'),
  estado: opcion('activa'),
  creadoEn: fecha,
};
const aviso = {
  id: '31',
  tienda: opcion('google_play'),
  tipo: 'SUBSCRIPTION_RENEWED',
  resultado: opcion('error'),
  detalle: 'No se encontró la suscripción.',
  recibidoEn: fecha,
};
const paginacion = { pagina: 1, porPagina: 20, total: 1 };

/** Una fila del historial del estudiante (HU-62.1) con su id BIGINT como texto. */
export const filaHistorial = {
  id: '41',
  tipo: opcion('practica'),
  prueba: { id: 2, codigo: 'M1', nombre: 'M1' },
  estado: opcion('entregada'),
  alcance: { tipo: 'prueba' as const, id: 2, nombre: 'M1' },
  dificultad: { id: null, codigo: 'mezcla', nombre: 'Mezcla' },
  cerradaEn: fecha,
  cantidad: 5,
  correctas: 3,
  porcentaje: 60,
  puntaje: null,
  recalculadoEn: null,
};

export const trazabilidadDePrueba = {
  listarSuscripciones: vi.fn(() => Promise.resolve({ suscripciones: [fila], paginacion })),
  detalleSuscripcion: vi.fn(() =>
    Promise.resolve({
      ...fila,
      historial: [
        {
          id: '12',
          fecha,
          estadoAnterior: null,
          estadoNuevo: opcion('pendiente'),
          planAnterior: null,
          planNuevo: fila.plan,
          origen: opcion('estudiante'),
          detalle: null,
        },
      ],
      pagos: [
        {
          id: '21',
          montoClp: 2990,
          estado: opcion('aprobado'),
          periodoInicio: '2026-10-20',
          periodoFin: '2026-11-19',
          creadoEn: fecha,
        },
      ],
      avisos: [{ ...aviso, resultado: opcion('procesado'), detalle: null }],
    }),
  ),
  avisosConError: vi.fn(() =>
    Promise.resolve({ avisos: [{ ...aviso, suscripcionId: '7' }], paginacion }),
  ),
};
