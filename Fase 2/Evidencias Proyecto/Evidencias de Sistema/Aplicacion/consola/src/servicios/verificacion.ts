// Llamada pública a /api/v1/app/cuentas/verificacion (módulo cuentas de la API): la página Verificar correo
// confirma el correo de un estudiante con el enlace que recibió (HU-05.4, CU-02). No usa la sesión de la
// consola: quien abre el enlace es el estudiante.
import { ErrorApi, solicitarPublica } from '../api/cliente';

interface ResultadoVerificacion {
  verificado: true;
  /** El correo ya estaba verificado antes de abrir el enlace. */
  yaVerificado: boolean;
}

function esResultadoVerificacion(valor: unknown): valor is ResultadoVerificacion {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    'verificado' in valor &&
    valor.verificado === true &&
    'yaVerificado' in valor &&
    typeof valor.yaVerificado === 'boolean'
  );
}

export async function verificarCorreo(token: string): Promise<ResultadoVerificacion> {
  const { data } = await solicitarPublica<unknown>('/app/cuentas/verificacion/enlace', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
  if (!esResultadoVerificacion(data)) {
    throw new ErrorApi(200, 'RESPUESTA_INVALIDA', 'No se pudo confirmar la verificación.');
  }
  return data;
}
