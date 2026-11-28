import { useState } from 'react';
import { reintentarDesempates } from '../servicios/revision';
import { mensajeDeError } from './usuarios-internos';

export function useReintentoDesempates() {
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  async function reintentar() {
    if (ocupado) return;
    setOcupado(true);
    setMensaje('');
    try {
      const { procesadas } = await reintentarDesempates();
      setMensaje(
        `Se revisaron ${String(procesadas)} rondas pendientes. Los casos sin docentes con cupo siguen esperando. Actualiza la lista para ver los cambios.`,
      );
    } catch (error) {
      setMensaje(mensajeDeError(error).mensaje);
    } finally {
      setOcupado(false);
    }
  }
  return { ocupado, mensaje, reintentar };
}
