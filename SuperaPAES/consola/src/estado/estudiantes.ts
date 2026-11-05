// C15 · Estudiantes: busca por correo y confirma la cuenta cuando el correo de verificación no llega
// (CU-02b). Si dos búsquedas se cruzan, solo vale la última.
import { useRef, useState } from 'react';
import { buscarEstudiantes, confirmarCorreoEstudiante } from '../servicios/cuentas';
import type { EstudianteConsola } from '../tipos/estudiantes';
import { mensajeDeError } from './usuarios-internos';

export type BusquedaEstudiantes =
  { tipo: 'inicial' } | { tipo: 'buscando' } | { tipo: 'lista'; estudiantes: EstudianteConsola[] };

/** La lista con el estudiante recién confirmado en su lugar. */
export function conEstudiante(
  estudiantes: readonly EstudianteConsola[],
  confirmado: EstudianteConsola,
): EstudianteConsola[] {
  return estudiantes.map((actual) => (actual.id === confirmado.id ? confirmado : actual));
}

export function useEstudiantes() {
  const [busqueda, setBusqueda] = useState<BusquedaEstudiantes>({ tipo: 'inicial' });
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const ultima = useRef(0);

  const buscar = async (correo: string) => {
    const turno = (ultima.current += 1);
    setBusqueda({ tipo: 'buscando' });
    setError(null);
    setAviso(null);
    try {
      const estudiantes = await buscarEstudiantes(correo);
      if (turno === ultima.current) setBusqueda({ tipo: 'lista', estudiantes });
    } catch (causa) {
      if (turno !== ultima.current) return;
      setBusqueda({ tipo: 'inicial' });
      setError(mensajeDeError(causa).mensaje);
    }
  };

  const confirmar = async (id: number) => {
    setConfirmando(id);
    setError(null);
    setAviso(null);
    try {
      const confirmado = await confirmarCorreoEstudiante(id);
      setBusqueda((actual) =>
        actual.tipo === 'lista'
          ? { ...actual, estudiantes: conEstudiante(actual.estudiantes, confirmado) }
          : actual,
      );
      setAviso('Cuenta confirmada. El cambio quedó registrado en la auditoría.');
    } catch (causa) {
      setError(mensajeDeError(causa).mensaje);
    } finally {
      setConfirmando(null);
    }
  };

  return { busqueda, confirmando, error, aviso, buscar, confirmar };
}
