import { solicitarAdmin } from '../api/cliente';
import type { DatosConfiguracion, ParametroConfiguracion } from '../tipos/configuracion';

const RUTA = '/administracion/configuracion';

export async function listarConfiguracion(senal: AbortSignal): Promise<DatosConfiguracion> {
  return (await solicitarAdmin<DatosConfiguracion>(RUTA, { signal: senal })).data;
}

export async function cambiarConfiguracion(
  parametro: ParametroConfiguracion,
  valor: number,
): Promise<ParametroConfiguracion> {
  const { data } = await solicitarAdmin<ParametroConfiguracion>(
    `${RUTA}/${encodeURIComponent(parametro.clave)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ valor, actualizadoEn: parametro.actualizadoEn }),
    },
  );
  return data;
}
