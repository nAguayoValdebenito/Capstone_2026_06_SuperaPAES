// Llamadas de la búsqueda global (Ctrl K, D5): preguntas por ID o texto del enunciado y el conteo de
// avisos de error pendientes del menú (D3). Cada función usa solicitarAdmin() de ../api/cliente.
import { solicitarAdmin } from '../api/cliente';

export interface PreguntaEncontrada {
  id: number;
  resumen: string;
  prueba: { codigo: string };
  estado: { codigo: string; nombre: string };
}

/** Hasta `limite` preguntas cuyo ID o enunciado coincide con el texto (sin distinguir tildes). */
export async function buscarPreguntas(
  texto: string,
  senal: AbortSignal,
  limite = 6,
): Promise<PreguntaEncontrada[]> {
  const consulta = new URLSearchParams({ texto, limite: String(limite) });
  const { data } = await solicitarAdmin<PreguntaEncontrada[]>(
    `/preguntas/busqueda?${consulta.toString()}`,
    { signal: senal },
  );
  return data;
}

/** Cuántos avisos de error siguen pendientes, en todo el banco. */
export async function contarAvisosPendientes(senal: AbortSignal): Promise<number> {
  const { data } = await solicitarAdmin<{ pendientes: number }>('/preguntas/avisos/pendientes', {
    signal: senal,
  });
  return data.pendientes;
}
