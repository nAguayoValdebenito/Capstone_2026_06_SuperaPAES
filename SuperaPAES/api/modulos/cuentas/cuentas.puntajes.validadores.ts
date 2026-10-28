// Esquemas de los puntajes PAES declarados (HU-41.1, RF-A17, RN-16). El tope del año de admisión
// depende de la fecha, así que lo revisa el servicio.
import { z } from 'zod';
import { idDeCuerpo, idDeRuta } from '../../comun/identificadores.js';

/** Un refinamiento con su motivo (detalles[].motivo), para que la app sepa qué falta. */
const conMotivo = (mensaje: string, motivo: string) => ({ message: mensaje, params: { motivo } });

/** La primera admisión con la PAES fue la de 2023. */
const PRIMERA_ADMISION_PAES = 2023;

const PUNTAJE_FUERA_DE_RANGO = conMotivo('El puntaje va de 100 a 1.000.', 'puntaje_fuera_de_rango');

/** Dar el permiso: el id de la versión del permiso que leyó el estudiante. */
export const esquemaPermisoPuntajes = z.strictObject({ documentoId: idDeCuerpo });

/** RN-16: prueba, año de admisión y puntaje de 100 a 1.000. Si la prueba existe, lo revisa el servicio. */
export const esquemaPuntaje = z.strictObject({
  pruebaId: idDeCuerpo,
  anioAdmision: z
    .number('El año de admisión no es válido.')
    .refine(
      (anio) => Number.isInteger(anio) && anio >= PRIMERA_ADMISION_PAES,
      conMotivo('La PAES se rinde desde la admisión 2023.', 'anio_invalido'),
    ),
  puntaje: z
    .number(PUNTAJE_FUERA_DE_RANGO)
    .refine(
      (puntaje) => Number.isInteger(puntaje) && puntaje >= 100 && puntaje <= 1000,
      PUNTAJE_FUERA_DE_RANGO,
    ),
});

export const esquemaIdPuntaje = z.strictObject({ id: idDeRuta });

export type DatosPermisoPuntajes = z.output<typeof esquemaPermisoPuntajes>;
export type DatosPuntaje = z.output<typeof esquemaPuntaje>;
