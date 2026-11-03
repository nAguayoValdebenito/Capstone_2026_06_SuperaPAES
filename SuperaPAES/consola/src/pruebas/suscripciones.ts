// Datos de la trazabilidad de suscripciones (C16, HU-56) para las pruebas de la consola, con la forma que
// entrega la API.
import type { DetalleSuscripcion, ResumenSuscripciones } from '../tipos/suscripciones';

const opcion = (codigo: string, nombre: string) => ({ codigo, nombre });

export const resumenDePrueba: ResumenSuscripciones = {
  activas: 12,
  enMora: 2,
  altasDelMes: 5,
  cancelacionesDelMes: 1,
  ingresosDelMes: 29900,
  avisosConError: 1,
  porPlanYEstado: [
    { plan: 'Todas las pruebas mensual', estado: opcion('activa', 'Activa'), suscripciones: 9 },
  ],
  meses: [{ mes: '2026-10', pagosAprobados: 10, pagosRechazados: 2, ingresosClp: 29900 }],
  estados: [opcion('activa', 'Activa'), opcion('en_mora', 'En mora')],
  planes: [{ id: 3, nombre: 'Todas las pruebas mensual' }],
};

export const detalleDePrueba: DetalleSuscripcion = {
  id: 12,
  correo: 'estudiante1@correo.cl',
  plan: 'Todas las pruebas mensual',
  tienda: opcion('google_play', 'Google Play'),
  estado: opcion('activa', 'Activa'),
  creadoEn: '2026-09-20T15:00:00.000Z',
  historial: [
    {
      id: 3,
      fecha: '2026-10-18T15:00:00.000Z',
      estadoAnterior: opcion('activa', 'Activa'),
      estadoNuevo: opcion('activa', 'Activa'),
      planAnterior: 'Una prueba mensual',
      planNuevo: 'Todas las pruebas mensual',
      origen: opcion('pasarela', 'Aviso de la tienda'),
      detalle: null,
    },
    {
      id: 2,
      fecha: '2026-09-20T15:05:00.000Z',
      estadoAnterior: opcion('pendiente', 'Pendiente'),
      estadoNuevo: opcion('activa', 'Activa'),
      planAnterior: 'Una prueba mensual',
      planNuevo: 'Una prueba mensual',
      origen: opcion('pasarela', 'Aviso de la tienda'),
      detalle: null,
    },
    {
      id: 1,
      fecha: '2026-09-20T15:00:00.000Z',
      estadoAnterior: null,
      estadoNuevo: opcion('pendiente', 'Pendiente'),
      planAnterior: null,
      planNuevo: 'Una prueba mensual',
      origen: opcion('estudiante', 'Estudiante'),
      detalle: 'Compra iniciada en la app',
    },
  ],
  pagos: [
    {
      id: 21,
      montoClp: 1990,
      estado: opcion('aprobado', 'Aprobado'),
      periodoInicio: '2026-09-20',
      periodoFin: '2026-10-19',
      creadoEn: '2026-09-20T15:05:00.000Z',
    },
  ],
  avisos: [
    {
      id: 31,
      tienda: opcion('google_play', 'Google Play'),
      tipo: 'SUBSCRIPTION_PURCHASED',
      resultado: opcion('procesado', 'Procesado'),
      detalle: null,
      recibidoEn: '2026-09-20T15:05:00.000Z',
    },
  ],
};
