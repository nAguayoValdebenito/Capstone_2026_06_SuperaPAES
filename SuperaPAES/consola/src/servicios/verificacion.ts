// HU-05.4: el enlace del correo se confirma sin sesión de la consola.
import { ErrorApi, solicitarPublica } from '../api/cliente';

export interface ResultadoVerificacion {
  verificado: true;
  yaVerificado: boolean;
}

export async function verificarCorreo(token: string): Promise<ResultadoVerificacion> {
  const { data } = await solicitarPublica<ResultadoVerificacion>(
    '/app/cuentas/verificacion/enlace',
    { method: 'POST', body: JSON.stringify({ token }) },
  );
  if (data?.verificado !== true || typeof data.yaVerificado !== 'boolean') {
    throw new ErrorApi(200, 'RESPUESTA_INVALIDA', 'No se pudo confirmar la verificación.');
  }
  return data;
}
