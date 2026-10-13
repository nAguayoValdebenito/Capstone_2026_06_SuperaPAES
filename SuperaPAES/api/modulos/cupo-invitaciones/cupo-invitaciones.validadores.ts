// Esquemas zod de entrada del módulo cupo-invitaciones. Se usan con validar() en las rutas.
import { z } from 'zod';

export const esquemaCodigoInvitacion = z.strictObject({
  codigo: z.string().trim().min(1).max(12),
});

export type DatosCodigoInvitacion = z.output<typeof esquemaCodigoInvitacion>;
