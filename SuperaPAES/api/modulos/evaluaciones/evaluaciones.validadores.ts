// Esquemas zod de entrada del módulo evaluaciones. Se usan con validar() en las rutas.
import { z } from 'zod';
import { idDeCuerpo, idDeRuta } from '../../comun/identificadores.js';

const identificador = z.number().int().positive().max(32767);
const identificadorContenido = z.number().int().positive().max(2147483647);
export const esquemaInicioMini = z.strictObject({ pruebaId: identificador });
export const esquemaDisponibilidadDiagnostico = z.strictObject({
  pruebaId: z.coerce.number().int().positive().max(32767),
});

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
/** GET /evaluaciones/{id}/resultado y /revision (HU-61.1), de cualquier tipo de evaluación. */
export const esquemaIdEvaluacion = z.object({ id: idDeRuta });
/** POST /evaluaciones/{id}/items/{item}/respuesta (DAS 1.13, Figura 17). */
export const esquemaIdsItem = z.object({ id: idDeRuta, item: idDeRuta });
// No es strictObject a propósito: un campo de más (por ejemplo esCorrecta) se descarta y nunca se usa.
// La corrección la hace el servidor (RN-06).
export const esquemaRespuesta = z.object({ alternativaId: idDeCuerpo });
export type DatosInicioPractica = z.infer<typeof esquemaInicioPractica>;
export type DatosRespuestaPregunta = z.infer<typeof esquemaRespuesta>;
