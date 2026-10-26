// Esquemas zod de entrada del módulo evaluaciones. Se usan con validar() en las rutas.
import { z } from 'zod';
import { idDeRuta } from '../../comun/identificadores.js';

const identificador = z.number().int().positive().max(32767);
const identificadorContenido = z.number().int().positive().max(2147483647);

export const esquemaInicioPractica = z
  .strictObject({
    pruebaId: identificador,
    ejeId: identificador.optional(),
    contenidoId: identificadorContenido.optional(),
    habilidadId: identificador.optional(),
    dificultadId: identificador.optional(),
    cantidad: z.number().int().positive(),
  })
  .superRefine((datos, contexto) => {
    if (
      [datos.ejeId, datos.contenidoId, datos.habilidadId].filter((x) => x !== undefined).length > 1
    ) {
      contexto.addIssue({
        code: 'custom',
        path: ['ejeId'],
        message: 'Elige solo un eje, contenido o habilidad.',
        params: { motivo: 'alcances_incompatibles' },
      });
    }
  });

export const esquemaIdPractica = z.object({ id: idDeRuta });
export type DatosInicioPractica = z.infer<typeof esquemaInicioPractica>;
