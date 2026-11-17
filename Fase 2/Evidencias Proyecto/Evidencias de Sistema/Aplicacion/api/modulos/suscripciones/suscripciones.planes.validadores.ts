// HU-52.1: edición de planes existentes. Los identificadores de las opciones vienen de la base.
import { z } from 'zod';
import { idDeRuta } from '../../comun/identificadores.js';

const identificador = z.number().int().positive().max(32767);
const producto = z.string().trim().min(1).max(100);

export const esquemaIdPlan = z.object({ id: idDeRuta.pipe(identificador) });
export const esquemaEditarPlan = z
  .object({
    nombre: z.string().trim().min(1).max(60),
    alcanceId: identificador,
    periodicidadId: identificador,
    precioClp: z.number().int().positive().max(2147483647),
    productos: z.object({ google_play: producto, app_store: producto }).strict(),
    activo: z.boolean(),
  })
  .strict();

export type DatosEditarPlan = z.infer<typeof esquemaEditarPlan>;
