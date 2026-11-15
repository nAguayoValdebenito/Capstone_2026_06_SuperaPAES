// Avisos de error del estudiante (HU-37, RF-A16, CU-13, A23): elige un motivo y escribe un comentario.
// Evaluaciones comprueba que el ítem es del estudiante y entrega la pregunta y la versión que vio; aquí
// se aplican los límites (decisión D4 de docs/planes/hu-37-avisar-error.md) y se guarda el aviso
// pendiente, dentro de la transacción que abrió evaluaciones.
import { ErrorConflicto, ErrorDemasiadosIntentos, ErrorValidacion } from '../../comun/errores.js';
import type { Ejecutor } from '../../db/transaccion.js';
import {
  crearAvisosAppRepositorio,
  type AvisoNuevo,
  type AvisosAppRepositorio,
} from './preguntas.avisos-app.repositorio.js';
import type { Opcion } from './preguntas.repositorio.js';

/** Protección técnica contra el abuso, como los límites de intentos del ingreso (D4). */
const MAXIMO_AVISOS_POR_DIA = 10;
const HORAS_DEL_LIMITE = 24;

/** El aviso guardado, con la fecha en ISO. */
export interface AvisoRegistrado {
  id: string;
  motivo: Opcion;
  estado: Opcion;
  creadoEn: string;
}

export interface AvisosDeEstudiantes {
  /** A23: los motivos que puede elegir el estudiante. */
  motivosDeAvisoApp(): Promise<Opcion[]>;
  /**
   * HU-37: guarda el aviso pendiente. 400 si el motivo no existe; 409 si ya tiene uno pendiente de
   * esa pregunta; 429 si superó los avisos del día.
   */
  registrarAvisoDeEstudiante(aviso: AvisoNuevo, tx: Ejecutor): Promise<AvisoRegistrado>;
}

function motivoInvalido(): ErrorValidacion {
  const mensaje = 'El motivo no existe.';
  return new ErrorValidacion([{ lugar: 'cuerpo', ruta: 'motivo', mensaje }], mensaje);
}

async function registrar(
  repositorio: AvisosAppRepositorio,
  aviso: AvisoNuevo,
  tx: Ejecutor,
): Promise<AvisoRegistrado> {
  await repositorio.bloquearEstudiante(aviso.estudianteId, tx);
  if (await repositorio.tienePendiente(aviso.estudianteId, aviso.preguntaId, tx)) {
    throw new ErrorConflicto('Ya nos avisaste de un error en esta pregunta. Lo estamos revisando.');
  }
  const recientes = await repositorio.contarRecientes(aviso.estudianteId, HORAS_DEL_LIMITE, tx);
  if (recientes >= MAXIMO_AVISOS_POR_DIA) throw new ErrorDemasiadosIntentos();
  const guardado = await repositorio.insertar(aviso, tx);
  if (!guardado) throw motivoInvalido();
  return { ...guardado, creadoEn: new Date(guardado.creadoEn).toISOString() };
}

export interface DependenciasAvisosApp {
  /** Solo para pruebas: reemplaza al de crearAvisosAppRepositorio(bd). */
  repositorioAvisosApp?: AvisosAppRepositorio;
}

export function crearAvisosDeEstudiantes(
  dependencias: DependenciasAvisosApp & { bd: Ejecutor },
): AvisosDeEstudiantes {
  const repositorio =
    dependencias.repositorioAvisosApp ?? crearAvisosAppRepositorio(dependencias.bd);
  return {
    motivosDeAvisoApp: () => repositorio.motivosActivos(),
    registrarAvisoDeEstudiante: (aviso, tx) => registrar(repositorio, aviso, tx),
  };
}
