// Esquemas zod de entrada del módulo revision. Se usan con validar() en las rutas.
import { z } from 'zod';
import { idDeRuta } from '../../comun/identificadores.js';

/** HU-21: la pregunta que se envía a revisión. */
export const esquemaIdPregunta = z.strictObject({ id: idDeRuta });
