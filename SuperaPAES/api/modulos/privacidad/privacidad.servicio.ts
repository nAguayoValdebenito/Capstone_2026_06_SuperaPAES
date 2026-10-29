// Reglas de negocio del módulo privacidad: solicitudes de derechos sobre datos personales (Ley
// 21.719), exportación y borrado de la cuenta con seudonimización.
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
import type { Reloj } from '../../comun/reloj.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { CuentasServicio } from '../cuentas/index.js';
import type { EvaluacionesServicio } from '../evaluaciones/index.js';
import type { PrivacidadRepositorio } from './privacidad.repositorio.js';

export interface DependenciasPrivacidadServicio {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  cuentas: CuentasServicio;
  /** La descarga de datos pide las evaluaciones con sus respuestas (HU-07.1). */
  evaluaciones: Pick<EvaluacionesServicio, 'exportarEvaluaciones'>;
  /** Hora actual, para las reglas que dependen del tiempo. */
  reloj: Reloj;
  /** Solo para pruebas: reemplaza al repositorio que se crea con crearPrivacidadRepositorio(bd). */
  repositorio?: PrivacidadRepositorio;
}

type Cuenta = Awaited<ReturnType<CuentasServicio['exportarCuenta']>>;

/** El archivo de «Descargar mis datos» (A39). */
export interface DatosDelEstudiante extends Cuenta {
  generadoEn: Date;
  perfil: Awaited<ReturnType<CuentasServicio['obtenerPerfil']>>;
  evaluaciones: Awaited<ReturnType<EvaluacionesServicio['exportarEvaluaciones']>>;
  /** Los puntajes PAES declarados; vacía sin el permiso (RN-16). */
  puntajes: Awaited<ReturnType<CuentasServicio['obtenerPuntajes']>>['puntajes'];
}

export interface PrivacidadServicio {
  /**
   * HU-07.1 (RF-A18, CU-14 3.a, CP-26): la cuenta, los documentos aceptados, el perfil, las
   * evaluaciones con sus respuestas y resultados, y los puntajes del estudiante de la sesión
   * (acceso y portabilidad). Nunca la contraseña ni datos de otros estudiantes.
   */
  exportarDatos(estudianteId: string): Promise<DatosDelEstudiante>;
}

export function crearPrivacidadServicio(
  dependencias: DependenciasPrivacidadServicio,
): PrivacidadServicio {
  const { cuentas, evaluaciones, reloj } = dependencias;
  return {
    exportarDatos: async (estudianteId) => {
      const generadoEn = reloj();
      const cuenta = await cuentas.exportarCuenta(estudianteId);
      const perfil = await cuentas.obtenerPerfil(estudianteId);
      const { puntajes } = await cuentas.obtenerPuntajes(estudianteId);
      return {
        generadoEn,
        ...cuenta,
        perfil,
        evaluaciones: await evaluaciones.exportarEvaluaciones(estudianteId),
        puntajes,
      };
    },
  };
}
