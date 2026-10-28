// CU-07a (RN-01, RN-02, RN-04): descontar una pregunta al responder y consultar el cupo del día.
// Lo llama evaluaciones dentro de su transacción, con la fila del estudiante ya bloqueada: el cupo del
// día y el saldo de preguntas extra de un estudiante nunca se cambian en dos respuestas a la vez.
// Orden del descuento: la suscripción que cubre la prueba (no descuenta), el cupo del día y, si se
// agotó, una pregunta extra. Sin ninguna de las tres, CUPO_AGOTADO.
import { ErrorAplicacion } from '../../comun/errores.js';
import type { Ejecutor } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { CupoInvitacionesRepositorio } from './cupo-invitaciones.repositorio.js';

/** Lo que se descontó al responder (contenido.tipo_consumo). */
export type TipoConsumo = 'cupo' | 'bono' | 'suscripcion';

export interface DatosCupo {
  estudianteId: string;
  pruebaId: number;
  /** De cuentas: decide el máximo del día (cupo_verificado o cupo_inicial). */
  correoVerificado: boolean;
  /** Hora del reloj de quien llama: define el día de Chile del cupo. */
  ahora: Date;
}

export interface EstadoCupo {
  maximo: number;
  usadas: number;
  restantes: number;
  saldoExtra: number;
  /** Sin cupo del día, sin saldo y sin una suscripción que cubra la prueba (CU-07b). */
  agotado: boolean;
}

export interface ConsumoReservado {
  tipo: TipoConsumo;
  /**
   * Termina el descuento con la respuesta ya guardada: el movimiento de una pregunta extra exige que
   * el ítem ya tenga el tipo de consumo bono (tg_movimiento_bono). En los otros casos no hace nada.
   */
  confirmar(evaluacionItemId: string): Promise<void>;
}

/** Puerto de suscripciones (RN-04): ¿una suscripción activa o en mora cubre la prueba? */
export interface CoberturaSuscripcion {
  cubrePrueba(estudianteId: string, pruebaId: number, tx: Ejecutor): Promise<boolean>;
}

export interface CupoDiario {
  /** Cupo de hoy y saldo, sin cambiar nada. Si la fila de hoy no existe, la muestra completa. */
  consultarCupo(datos: DatosCupo, tx: Ejecutor): Promise<EstadoCupo>;
  /** HU-33 esc. 1, RF-A09: antes de entregar una pregunta, 409 CUPO_AGOTADO si ya no queda nada. */
  exigirCupoDisponible(datos: DatosCupo, tx: Ejecutor): Promise<void>;
  /**
   * Descuenta una pregunta: crea la fila de hoy si falta y descuenta con una sola sentencia con tope.
   * Si el cupo del día se agotó, reserva una pregunta extra, que se descuenta con confirmar().
   */
  reservarConsumo(datos: DatosCupo, tx: Ejecutor): Promise<ConsumoReservado>;
}

export interface DependenciasCupoDiario {
  repositorio: CupoInvitacionesRepositorio;
  administracion: Pick<AdministracionServicio, 'obtenerParametroEntero'>;
  suscripciones: CoberturaSuscripcion;
}

/** Rechazo del trigger tg_saldo_bono cuando el saldo quedaría bajo cero. */
const SALDO_INSUFICIENTE = 'El saldo de preguntas extra no alcanza';

function cupoAgotado(estado: EstadoCupo): ErrorAplicacion {
  return new ErrorAplicacion(
    409,
    'CUPO_AGOTADO',
    'Ya usaste tus preguntas de hoy y no te quedan preguntas extra.',
    { detalles: estado },
  );
}

function rechazoDeSaldo(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error as { code?: unknown }).code === 'P0001' &&
    error.message.startsWith(SALDO_INSUFICIENTE)
  );
}

/** Máximo de un día que todavía no tiene fila, leído de la configuración (RN-01). */
export function maximoDelDia(
  dependencias: Pick<DependenciasCupoDiario, 'administracion'>,
  correoVerificado: boolean,
) {
  return dependencias.administracion.obtenerParametroEntero(
    correoVerificado ? 'cupo_verificado' : 'cupo_inicial',
  );
}

async function consultar(
  dependencias: DependenciasCupoDiario,
  datos: DatosCupo,
  tx: Ejecutor,
): Promise<EstadoCupo> {
  const { repositorio, suscripciones } = dependencias;
  const fila = await repositorio.leerCupoDelDia(datos.estudianteId, datos.ahora, tx);
  const { maximo, usadas } = fila ?? {
    maximo: await maximoDelDia(dependencias, datos.correoVerificado),
    usadas: 0,
  };
  const saldoExtra = await repositorio.leerSaldoExtra(datos.estudianteId, tx);
  const cubierta = await suscripciones.cubrePrueba(datos.estudianteId, datos.pruebaId, tx);
  const restantes = maximo - usadas;
  return {
    maximo,
    usadas,
    restantes,
    saldoExtra,
    agotado: !cubierta && restantes <= 0 && saldoExtra <= 0,
  };
}

const nadaQueConfirmar = () => Promise.resolve();

async function reservar(
  dependencias: DependenciasCupoDiario,
  datos: DatosCupo,
  tx: Ejecutor,
): Promise<ConsumoReservado> {
  const { repositorio, suscripciones } = dependencias;
  const { estudianteId, ahora } = datos;
  if (await suscripciones.cubrePrueba(estudianteId, datos.pruebaId, tx))
    return { tipo: 'suscripcion', confirmar: nadaQueConfirmar };
  const maximo = await maximoDelDia(dependencias, datos.correoVerificado);
  await repositorio.crearCupoDelDia(estudianteId, ahora, maximo, tx);
  if (await repositorio.descontarCupoDelDia(estudianteId, ahora, tx))
    return { tipo: 'cupo', confirmar: nadaQueConfirmar };
  const estado = await consultar(dependencias, datos, tx);
  if (estado.saldoExtra <= 0) throw cupoAgotado(estado);
  return {
    tipo: 'bono',
    confirmar: async (evaluacionItemId) => {
      try {
        await repositorio.registrarConsumoExtra(estudianteId, evaluacionItemId, ahora, tx);
      } catch (error) {
        // La fila del estudiante está bloqueada, así que no debería pasar; si la base lo rechaza
        // igual, es CUPO_AGOTADO y la transacción se deshace entera.
        if (rechazoDeSaldo(error)) throw cupoAgotado({ ...estado, saldoExtra: 0, agotado: true });
        throw error;
      }
    },
  };
}

export function crearCupoDiario(dependencias: DependenciasCupoDiario): CupoDiario {
  return {
    consultarCupo: (datos, tx) => consultar(dependencias, datos, tx),
    exigirCupoDisponible: async (datos, tx) => {
      const estado = await consultar(dependencias, datos, tx);
      if (estado.agotado) throw cupoAgotado(estado);
    },
    reservarConsumo: (datos, tx) => reservar(dependencias, datos, tx),
  };
}
