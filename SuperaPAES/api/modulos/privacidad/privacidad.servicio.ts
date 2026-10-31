// Reglas de negocio del módulo privacidad: solicitudes de derechos sobre datos personales (Ley
// 21.719), exportación y borrado de la cuenta con seudonimización.
// Es la única puerta de entrada al módulo: los demás módulos usan este servicio, nunca su repositorio.
import type { Reloj } from '../../comun/reloj.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { CuentasServicio, DocumentoAceptado } from '../cuentas/index.js';
import type { EvaluacionesServicio } from '../evaluaciones/index.js';
import type { SuscripcionesServicio } from '../suscripciones/index.js';
import type { PrivacidadRepositorio } from './privacidad.repositorio.js';

export interface DependenciasPrivacidadServicio {
  bd: Ejecutor;
  unidadDeTrabajo: UnidadDeTrabajo;
  cuentas: CuentasServicio;
  /** La descarga de datos pide las evaluaciones con sus respuestas (HU-07.1). */
  evaluaciones: Pick<EvaluacionesServicio, 'exportarEvaluaciones'>;
  /** Antes de borrar la cuenta, la app avisa de la suscripción vigente (HU-08.2, RN-34). */
  suscripciones: Pick<SuscripcionesServicio, 'vigenteDe'>;
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

/** Mis datos (A39) y «Borrar mi cuenta» (A42 y A42b). */
export interface EstadoDeLaCuenta {
  /** La suscripción activa o en mora que la tienda sigue cobrando; `null` si no hay (A42). */
  suscripcionVigente: Awaited<ReturnType<SuscripcionesServicio['vigenteDe']>>;
  /** Términos y privacidad, la última versión aceptada sin revocar de cada uno (CU-14 paso 2). */
  documentosAceptados: DocumentoAceptado[];
}

export interface PrivacidadServicio {
  /**
   * HU-07.1 (RF-A18, CU-14 3.a, CP-26): la cuenta, los documentos aceptados, el perfil, las
   * evaluaciones con sus respuestas y resultados, y los puntajes del estudiante de la sesión
   * (acceso y portabilidad). Nunca la contraseña ni datos de otros estudiantes.
   */
  exportarDatos(estudianteId: string): Promise<DatosDelEstudiante>;
  /**
   * HU-08.1 (RF-A18, RNF-09, CU-14 paso 6): borra la cuenta del estudiante de la sesión, aunque tenga
   * una suscripción vigente (RN-34; el aviso lo da la app). Sus evaluaciones y respuestas quedan
   * seudonimizadas y su sesión se cierra.
   */
  borrarCuenta(estudianteId: string): Promise<{ eliminadaEn: Date }>;
  /**
   * CU-14 paso 2: las versiones aceptadas de los términos y de la privacidad, que muestra Mis datos
   * (A39). HU-08.2 (CU-14 paso 4 y alternativo 4.a): con una suscripción activa o en mora, la app
   * muestra A42b, que avisa que la tienda seguirá cobrando (RN-34).
   */
  estadoDeLaCuenta(estudianteId: string): Promise<EstadoDeLaCuenta>;
}

export function crearPrivacidadServicio(
  dependencias: DependenciasPrivacidadServicio,
): PrivacidadServicio {
  const { cuentas, evaluaciones, suscripciones, reloj } = dependencias;
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
    borrarCuenta: (estudianteId) => cuentas.eliminarCuenta(estudianteId),
    estadoDeLaCuenta: async (estudianteId) => {
      return {
        suscripcionVigente: await suscripciones.vigenteDe(estudianteId),
        documentosAceptados: await cuentas.documentosAceptadosDe(estudianteId),
      };
    },
  };
}
