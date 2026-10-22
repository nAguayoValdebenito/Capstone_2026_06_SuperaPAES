// Formato del código de invitación (RN-33, CHECK de app.estudiante.codigo_invitacion): 6 letras
// mayúsculas o números, sin 0, O, 1 ni I. Lo usan el registro (cuentas) y el canje (cupo-invitaciones).
import { z } from 'zod';

export const codigoInvitacion = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z2-9]{6}$/, 'El código de invitación tiene 6 letras o números.');
