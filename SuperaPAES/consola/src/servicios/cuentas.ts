// Llamadas a /api/v1/admin/cuentas (módulo cuentas de la API): el ingreso del personal interno y su sesión.
// Cada función usa solicitarAdmin() de ../api/cliente.
import { solicitarAdmin } from '../api/cliente';
import type { Credenciales, SesionIniciada } from '../tipos';
import type { EstudianteConsola } from '../tipos/estudiantes';

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

/** C15: la búsqueda exacta por correo, sin distinguir mayúsculas. */
export async function buscarEstudiantes(correo: string): Promise<EstudianteConsola[]> {
  const consulta = new URLSearchParams({ correo }).toString();
  const { data } = await solicitarAdmin<EstudianteConsola[]>(`/cuentas/estudiantes?${consulta}`);
  return data;
}

/** CU-02b: confirma la cuenta cuando el correo de verificación no llega. Queda en la auditoría. */
export async function confirmarCorreoEstudiante(id: number): Promise<EstudianteConsola> {
  const { data } = await solicitarAdmin<EstudianteConsola>(
    `/cuentas/estudiantes/${String(id)}/confirmar-correo`,
    { method: 'POST' },
  );
  return data;
}
