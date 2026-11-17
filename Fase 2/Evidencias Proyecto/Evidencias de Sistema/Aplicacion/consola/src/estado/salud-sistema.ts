// Consulta el estado de la API y de la base de datos, y la cancela al desmontar.
import { useEffect, useState } from 'react';
import { ErrorApi } from '../api/cliente';
import { obtenerSalud } from '../servicios/salud';
import type { EstadoSalud } from '../tipos';

export type ConsultaSalud =
  | { tipo: 'cargando' }
  | { tipo: 'lista'; salud: EstadoSalud }
  | { tipo: 'fallida'; codigo: string; mensaje: string };

function consultaFallida(error: unknown): ConsultaSalud {
  return error instanceof ErrorApi
    ? { tipo: 'fallida', codigo: error.codigo, mensaje: error.message }
    : { tipo: 'fallida', codigo: 'ERROR_INESPERADO', mensaje: 'Ocurrió un error inesperado.' };
}

export function useSaludSistema(): ConsultaSalud {
  const [consulta, setConsulta] = useState<ConsultaSalud>({ tipo: 'cargando' });

  useEffect(() => {
    const control = new AbortController();
    obtenerSalud(control.signal).then(
      (salud) => setConsulta({ tipo: 'lista', salud }),
      (error: unknown) => {
        if (control.signal.aborted) return;
        setConsulta(consultaFallida(error));
      },
    );
    return () => control.abort();
  }, []);

  return consulta;
}
