import type { Paginacion } from './index';

export interface ConsultaSaldo {
  desde?: string;
  hasta?: string;
}
export interface SaldoDocente {
  docente: { id: number; nombre: string };
  resumen: { totalClp: number; mesClp: number; cantidad: number; cantidadMes: number };
  capacidad: { pendientes: number; completadas: number; maxPendientes: number; maxDiarias: number };
  detalle: {
    revisionId: number;
    preguntaId: number;
    fecha: string;
    tipo: 'revision' | 'desempate';
    montoClp: number;
  }[];
  paginacion: Paginacion;
}
export interface TarifaRevision {
  id: number;
  montoClp: number;
  vigenteDesde: string;
  creadoEn: string;
}
export interface TarifasDocentes {
  tarifas: TarifaRevision[];
  docentes: { id: number; nombre: string }[];
}
export interface NuevaTarifa {
  montoClp: number;
  vigenteDesde?: string;
  ultimaTarifaId: number;
}
