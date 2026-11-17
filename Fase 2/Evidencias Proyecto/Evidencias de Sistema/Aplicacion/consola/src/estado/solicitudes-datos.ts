// Solicitudes de datos (C14, HU-55): la bandeja por estado y página, la solicitud elegida, la respuesta
// obligatoria y su confirmación, y la etiqueta de plazo con texto. Los días que faltan y si venció los
// calcula la API; aquí solo se presentan. Cada acción vuelve a cargar la bandeja y deja un mensaje.
import { useCallback, useRef, useState } from 'react';
import { atenderSolicitud, listarSolicitudes } from '../servicios/privacidad';
import type {
  AtencionSolicitud,
  BandejaSolicitudes,
  EstadoSolicitud,
  SolicitudDeDatos,
} from '../tipos/solicitudes-datos';
import { useCarga, type Carga } from './carga';
import { mensajeDeError } from './usuarios-internos';

/** «Vence pronto» con esta cantidad de días o menos (plan HU-55, D8: solo presentación). */
const DIAS_VENCE_PRONTO = 7;
const LARGO_MAXIMO_RESPUESTA = 2000;

const FECHA_CHILE = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Santiago',
});

export const fechaChilena = (iso: string): string => FECHA_CHILE.format(new Date(iso));

export const textoDeDias = (dias: number): string =>
  `${String(dias)} ${dias === 1 ? 'día' : 'días'}`;

export interface Plazo {
  tipo: 'vencida' | 'pronto' | 'a-tiempo';
  texto: string;
}

/** La etiqueta de plazo de una pendiente, siempre con texto; una atendida no tiene. */
export function plazoDe({ diasRestantes: dias, vencida }: SolicitudDeDatos): Plazo | null {
  if (dias === null) return null;
  if (vencida) {
    return {
      tipo: 'vencida',
      texto: dias < 0 ? `Vencida hace ${textoDeDias(-dias)}` : 'Venció hoy',
    };
  }
  const tipo = dias <= DIAS_VENCE_PRONTO ? 'pronto' : 'a-tiempo';
  return { tipo, texto: dias === 0 ? 'Vence hoy' : `Vence en ${textoDeDias(dias)}` };
}

export function pestanasDeEstado(pendientes: number) {
  return [
    { valor: 'pendiente', texto: `Pendientes (${String(pendientes)})` },
    { valor: 'respondida', texto: 'Respondidas' },
    { valor: 'rechazada', texto: 'Rechazadas' },
  ] as const satisfies readonly { valor: EstadoSolicitud; texto: string }[];
}

/** Quién atendió la solicitud y cuándo, en una sola frase. */
export function quienAtendio({ atendidoPor, respondidoEn }: SolicitudDeDatos): string {
  const quien = atendidoPor ? ` por ${atendidoPor.nombre}` : '';
  const cuando = respondidoEn ? ` el ${fechaChilena(respondidoEn)}` : '';
  return `Atendida${quien}${cuando}.`;
}

/** El estudiante como se muestra: su correo, o «Cuenta eliminada» si borró la cuenta (HU-08). */
export const estudianteDe = ({ estudiante }: SolicitudDeDatos): string =>
  estudiante.cuentaEliminada ? 'Cuenta eliminada' : (estudiante.correo ?? '');

export function validarRespuesta(texto: string): string | null {
  const limpio = texto.trim();
  if (!limpio) return 'Escribe la respuesta al estudiante.';
  if (limpio.length > LARGO_MAXIMO_RESPUESTA)
    return 'La respuesta puede tener hasta 2.000 caracteres.';
  return null;
}

export function textoDeAtencion(estado: AtencionSolicitud): string {
  return estado === 'respondida'
    ? 'Solicitud respondida. El estudiante verá la respuesta en la app.'
    : 'Solicitud rechazada. El estudiante verá el motivo en la app.';
}

/** La solicitud elegida en la bandeja; si no hay elección o ya no está, la primera. */
export function solicitudElegida(
  solicitudes: readonly SolicitudDeDatos[],
  elegida: number | null,
): SolicitudDeDatos | null {
  return solicitudes.find((s) => s.id === elegida) ?? solicitudes[0] ?? null;
}

export interface MensajeAccion {
  tipo: 'exito' | 'error';
  texto: string;
}

/** El texto de la respuesta, su error y la confirmación abierta (responder o rechazar). */
function useRespuesta() {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmacion, setConfirmacion] = useState<AtencionSolicitud | null>(null);
  const escribir = (valor: string) => {
    setTexto(valor);
    if (error) setError(validarRespuesta(valor));
  };
  const pedirConfirmacion = (accion: AtencionSolicitud) => {
    const problema = validarRespuesta(texto);
    setError(problema);
    if (!problema) setConfirmacion(accion);
  };
  const reiniciar = () => {
    setTexto('');
    setError(null);
    setConfirmacion(null);
  };
  return {
    texto,
    error,
    confirmacion,
    escribir,
    pedirConfirmacion,
    cancelar: () => setConfirmacion(null),
    reiniciar,
  };
}

function useAtencion(recargar: () => void, respuesta: ReturnType<typeof useRespuesta>) {
  const [mensaje, setMensaje] = useState<MensajeAccion | null>(null);
  const [enCurso, setEnCurso] = useState(false);
  const ocupado = useRef(false);
  const confirmar = async (id: number) => {
    const accion = respuesta.confirmacion;
    if (accion === null || ocupado.current) return;
    ocupado.current = true;
    setEnCurso(true);
    try {
      await atenderSolicitud(id, accion, respuesta.texto.trim());
      setMensaje({ tipo: 'exito', texto: textoDeAtencion(accion) });
      respuesta.reiniciar();
    } catch (falla) {
      setMensaje({ tipo: 'error', texto: mensajeDeError(falla).mensaje });
      respuesta.cancelar();
    } finally {
      ocupado.current = false;
      setEnCurso(false);
      recargar();
    }
  };
  return { mensaje, setMensaje, enCurso, confirmar };
}

export function useSolicitudesDatos() {
  const [estado, setEstado] = useState<EstadoSolicitud>('pendiente');
  const [pagina, setPagina] = useState(1);
  const [version, setVersion] = useState(0);
  const [elegida, setElegida] = useState<number | null>(null);
  const cargar = useCallback(
    (senal: AbortSignal) => listarSolicitudes(estado, pagina, senal),
    [estado, pagina],
  );
  const carga: Carga<BandejaSolicitudes> = useCarga(cargar, version);
  const recargar = () => setVersion((v) => v + 1);
  const respuesta = useRespuesta();
  const atencion = useAtencion(recargar, respuesta);
  const cambiarEstado = (valor: EstadoSolicitud) => {
    setEstado(valor);
    setPagina(1);
    setElegida(null);
    respuesta.reiniciar();
    atencion.setMensaje(null);
  };
  const elegir = (id: number) => {
    setElegida(id);
    respuesta.reiniciar();
  };
  return {
    estado,
    cambiarEstado,
    carga,
    setPagina,
    elegida,
    elegir,
    reintentar: recargar,
    respuesta,
    mensaje: atencion.mensaje,
    enCurso: atencion.enCurso,
    confirmar: atencion.confirmar,
  };
}

export type EstadoSolicitudesDatos = ReturnType<typeof useSolicitudesDatos>;
