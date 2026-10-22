// Esquemas zod de entrada del módulo cupo-invitaciones. Se usan con validar() en las rutas.
import { z } from 'zod';
import { codigoInvitacion } from '../../comun/codigo-invitacion.js';

export const esquemaCodigoInvitacion = z.strictObject({ codigo: codigoInvitacion });

export type DatosCodigoInvitacion = z.output<typeof esquemaCodigoInvitacion>;
