// Validación de la consulta (?campo=valor) de los listados de la consola: ids, códigos de una lista de
// opciones y la página. Todo llega como texto por HTTP; tras validarlo, el controlador recibe números.
import { z } from 'zod';

/** Id de la consulta (?prueba=3): un entero positivo escrito como texto, hasta `maximo`. */
export const idConsulta = (maximo: number) =>
  z
    .string()
    .regex(/^[1-9]\d{0,9}$/, 'El identificador no es válido.')
    .transform(Number)
    .pipe(z.number().max(maximo, 'El identificador no es válido.'));

/** Código de una lista de opciones (estado_pregunta, dificultad); el servicio comprueba que exista. */
export const codigoConsulta = z.string().regex(/^[a-z_]{1,15}$/, 'El código no es válido.');

/** Número de página o de filas por página, con su valor por defecto y su máximo. */
export const numeroDePagina = (porDefecto: number, maximo: number) =>
  z
    .string()
    .regex(/^[1-9]\d{0,5}$/, 'Debe ser un número entero positivo.')
    .transform(Number)
    .pipe(z.number().max(maximo, `Puede ser hasta ${String(maximo)}.`))
    .default(porDefecto);
