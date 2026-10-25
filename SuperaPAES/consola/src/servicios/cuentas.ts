// Llamadas a /api/v1/admin/cuentas (módulo cuentas de la API): el ingreso del personal interno y su sesión.
// Cada función usa solicitarAdmin() de ../api/cliente.
import { solicitarAdmin } from '../api/cliente';
import type { Credenciales, SesionIniciada } from '../tipos';

export async function ingresar(credenciales: Credenciales): Promise<SesionIniciada> {
  const { data } = await solicitarAdmin<SesionIniciada>('/cuentas/ingreso', {
    method: 'POST',
    body: JSON.stringify(credenciales),
  });
  return data;
}

/** Cambia la credencial de renovación por una sesión nueva (la anterior deja de servir). */
export async function renovar(tokenRenovacion: string): Promise<SesionIniciada> {
  const { data } = await solicitarAdmin<SesionIniciada>('/cuentas/renovar', {
    method: 'POST',
    body: JSON.stringify({ tokenRenovacion }),
  });
  return data;
}

/** Cierra la sesión en la API: su credencial de renovación deja de servir (CU-03). */
export async function cerrar(tokenRenovacion: string): Promise<void> {
  await solicitarAdmin<{ sesionCerrada: boolean }>('/cuentas/cerrar', {
    method: 'POST',
    body: JSON.stringify({ tokenRenovacion }),
  });
}
