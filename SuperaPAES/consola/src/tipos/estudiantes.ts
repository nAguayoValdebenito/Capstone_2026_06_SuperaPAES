// C15 · Estudiantes (HU-05 esc. 4, CU-02b): lo que entrega /admin/cuentas/estudiantes.
export interface EstudianteConsola {
  id: number;
  nombre: string;
  correo: string;
  correoVerificado: boolean;
  creadoEn: string;
}
