// Llamada pública a /api/v1/app/cuentas/verificacion (módulo cuentas de la API): la página Verificar correo
// confirma el correo de un estudiante con el enlace que recibió (HU-05.4, CU-02). No usa la sesión de la
// consola: quien abre el enlace es el estudiante.
import { solicitarPublica } from '../api/cliente';

interface ResultadoVerificacion {
  verificado: boolean;
  /** El correo ya estaba verificado antes de abrir el enlace. */
  yaVerificado: boolean;
}

export async function verificarCorreo(token: string): Promise<ResultadoVerificacion> {
  const { data } = await solicitarPublica<ResultadoVerificacion>(
    '/app/cuentas/verificacion/enlace',
    {
      method: 'POST',
      body: JSON.stringify({ token }),
    },
  );
  return data;
}
