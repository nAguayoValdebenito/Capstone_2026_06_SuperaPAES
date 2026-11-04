// Aviso de renovación anual en la tarea horaria (HU-45.3, CU-12 4.c, DAS 4.3.3 y 4.5.5). El envío queda en
// contenido.auditoria con la suscripción y su fin de período: así avisa una vez por período, y el año siguiente
// vuelve a avisar. Sin esa fila se reintenta a la hora siguiente. Si el correo sale y falla el registro, se
// repite: es preferible un correo doble a no avisar. El SMTP corre fuera de una transacción, para no retener
// una conexión del pool mientras espera (A-01).
import type { ProveedorCorreo } from '../../adaptadores/fabrica.js';
import { ErrorNoEncontrado } from '../../comun/errores.js';
import { registro } from '../../comun/registro.js';
import type { Reloj } from '../../comun/reloj.js';
import type { CandadosDeSesion } from '../../db/candados.js';
import type { Ejecutor } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { CuentasServicio } from '../cuentas/index.js';
import { gestionEnTienda } from './suscripciones.gestion-tienda.js';
import { mensajeDeRenovacion } from './suscripciones.renovacion.correo.js';
import {
  crearRenovacionRepositorio,
  type RenovacionPorAvisar,
  type RenovacionRepositorio,
} from './suscripciones.renovacion.repositorio.js';

/**
 * Correos por ejecución. Brevo admite 300 al día (4.5.5), y el flujo de GitHub Actions corta la llamada a los
 * 90 s, así que 25 envíos por hora caben holgados. El resto queda para la hora siguiente.
 */
export const TOPE_POR_EJECUCION = 25;

/** Bajo el rango de los lotes del generador y lejos de los de transacción (hashtext, 32 bits). */
const CANDADO_AVISOS = (1n << 62n) - 1n;

export interface DependenciasAvisoRenovacion {
  administracion: Pick<AdministracionServicio, 'registrarAuditoria' | 'existeAuditoria'>;
  /** Cuentas se crea después de suscripciones: solo se pide al enviar. */
  cuentas: () => Pick<CuentasServicio, 'exportarCuenta'>;
  correo: ProveedorCorreo;
  /** Dos ejecuciones a la vez no pueden avisar dos veces a la misma suscripción. */
  candados: CandadosDeSesion;
}

export interface EntornoAvisoRenovacion {
  bd: Ejecutor;
  reloj: Reloj;
  avisoRenovacion?: DependenciasAvisoRenovacion;
  paqueteGooglePlay?: string;
}

export interface ResultadoRenovacion {
  enviados: number;
  fallidos: number;
}

type Desenlace = keyof ResultadoRenovacion | 'omitido';

async function avisarUna(
  { bd, paqueteGooglePlay }: EntornoAvisoRenovacion,
  { administracion, cuentas, correo }: DependenciasAvisoRenovacion,
  renovacion: RenovacionPorAvisar,
): Promise<Desenlace> {
  const { id, estudianteId, tienda, idProducto, periodoFin } = renovacion;
  const envio = {
    accion: 'avisar_renovacion',
    entidad: 'suscripcion',
    entidadId: id,
    despues: { periodoFin: periodoFin.toISOString() },
  };
  try {
    if (await administracion.existeAuditoria(envio)) return 'omitido';
    const { cuenta } = await cuentas().exportarCuenta(estudianteId);
    await correo.enviar(
      mensajeDeRenovacion({
        ...renovacion,
        nombre: cuenta.nombre,
        para: cuenta.correo,
        gestionUrl: gestionEnTienda(tienda, idProducto, paqueteGooglePlay),
      }),
    );
    await administracion.registrarAuditoria({ ...envio, usuarioId: null, antes: null }, bd);
    return 'enviados';
  } catch (error) {
    if (error instanceof ErrorNoEncontrado) return 'omitido';
    registro.error('No se pudo enviar el aviso de renovación', {
      tienda,
      error: error instanceof Error ? error.name : 'desconocido',
    });
    return 'fallidos';
  }
}

async function avisarTodas(
  entorno: EntornoAvisoRenovacion,
  dependencias: DependenciasAvisoRenovacion,
  repositorio: Pick<RenovacionRepositorio, 'porAvisar'>,
): Promise<ResultadoRenovacion> {
  const resultado: ResultadoRenovacion = { enviados: 0, fallidos: 0 };
  for (const renovacion of await repositorio.porAvisar(entorno.reloj())) {
    if (resultado.enviados + resultado.fallidos >= TOPE_POR_EJECUCION) break;
    const desenlace = await avisarUna(entorno, dependencias, renovacion);
    if (desenlace !== 'omitido') resultado[desenlace] += 1;
  }
  return resultado;
}

/** Devuelve la tarea que envía los avisos pendientes; un error de una no detiene a las demás. */
export function crearAvisoRenovacion(
  entorno: EntornoAvisoRenovacion,
  repositorio: Pick<RenovacionRepositorio, 'porAvisar'> = crearRenovacionRepositorio(entorno.bd),
): () => Promise<ResultadoRenovacion> {
  return async () => {
    const dependencias = entorno.avisoRenovacion;
    if (!dependencias) return { enviados: 0, fallidos: 0 };
    const turno = await dependencias.candados.conCandado(CANDADO_AVISOS, () =>
      avisarTodas(entorno, dependencias, repositorio),
    );
    return turno.tomado ? turno.valor : { enviados: 0, fallidos: 0 };
  };
}
