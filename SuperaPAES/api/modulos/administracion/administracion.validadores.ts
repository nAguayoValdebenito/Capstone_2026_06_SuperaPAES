// Esquemas zod de entrada del módulo administracion. Se usan con validar() en las rutas.
import { z } from 'zod';
import { refinarContrasena } from '../../comun/contrasenas.js';
import { ROLES_CUENTA_INTERNA } from '../../comun/roles.js';

const nombre = z.string().trim().min(1, 'Escribe el nombre.').max(100);

const correo = z
  .email('Ingresa un correo válido.')
  .max(150)
  .transform((valor) => valor.toLowerCase());

const rol = z.enum(ROLES_CUENTA_INTERNA, 'El rol debe ser admin o docente.');

/** Ids de contenido.area, sin repetir y en orden. */
const areas = z
  .array(z.int().positive().max(32_767))
  .max(20)
  .transform((ids) => [...new Set(ids)].sort((a, b) => a - b));

/** RF-C02 y CU-23: el administrador escribe la contraseña inicial, que cumple RN-31. */
export const esquemaCrearUsuarioInterno = z
  .strictObject({ nombre, correo, rol, areas: areas.default([]), contrasena: z.string() })
  .superRefine(refinarContrasena);

/**
 * CU-23 3.a: se cambian el nombre, el rol y las áreas, o se asigna una contraseña nueva (RN-31; el
 * servicio la compara con el correo de la cuenta). El correo no se edita.
 */
export const esquemaEditarUsuarioInterno = z
  .strictObject({
    nombre: nombre.optional(),
    rol: rol.optional(),
    areas: areas.optional(),
    contrasena: z.string().optional(),
  })
  .refine((cambios) => Object.values(cambios).some((valor) => valor !== undefined), {
    message: 'Indica al menos un cambio.',
  });

export const esquemaIdUsuarioInterno = z.strictObject({
  id: z.string().regex(/^[1-9]\d{0,17}$/, 'El identificador no es válido.'),
});

export type DatosCrearUsuarioInterno = z.output<typeof esquemaCrearUsuarioInterno>;
export type DatosEditarUsuarioInterno = z.output<typeof esquemaEditarUsuarioInterno>;
export type ParametrosUsuarioInterno = z.output<typeof esquemaIdUsuarioInterno>;
