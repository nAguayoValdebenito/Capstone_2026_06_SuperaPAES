import { z } from 'zod';
import { idDeRuta, idDeCuerpo } from '../../comun/identificadores.js';

export const esquemaConsultaSaldo = z
  .strictObject({
    desde: z.iso.date().optional(),
    hasta: z.iso.date().optional(),
    pagina: z.coerce.number().int().min(1).max(100_000).default(1),
    porPagina: z.coerce.number().int().min(1).max(50).default(20),
  })
  .refine(({ desde, hasta }) => !desde || !hasta || desde <= hasta, {
    message: 'La fecha inicial no puede ser posterior a la final.',
    path: ['hasta'],
  });
export const esquemaDocenteSaldo = z.strictObject({ docenteId: idDeRuta });
export const esquemaNuevaTarifa = z.strictObject({
  montoClp: z.number().int().min(1).max(700),
  vigenteDesde: z.iso.datetime({ offset: true }).optional(),
  ultimaTarifaId: idDeCuerpo,
});
export type ConsultaSaldo = z.output<typeof esquemaConsultaSaldo>;
export type NuevaTarifa = z.output<typeof esquemaNuevaTarifa>;
