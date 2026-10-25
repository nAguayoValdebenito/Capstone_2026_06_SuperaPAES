// Estudiantes de prueba para las pruebas con PostgreSQL real. El registro llega con el prompt 11 y su
// generador de códigos de invitación también: mientras tanto se insertan directo en app.estudiante,
// con la contraseña cifrada por cifrarContrasena (el mismo componente que usa el ingreso) y un código
// de invitación que cumple la restricción de la tabla (^[A-HJ-NP-Z2-9]{6}$: sin 0, O, 1 ni I).
import { cifrarContrasena } from '../comun/contrasenas.js';
import type { Ejecutor } from '../db/transaccion.js';

/** bcrypt con costo 12 tarda: cada contraseña de prueba se cifra una sola vez por archivo. */
const hashes = new Map<string, Promise<string>>();
export function hashDeContrasena(contrasena: string): Promise<string> {
  const guardado = hashes.get(contrasena) ?? cifrarContrasena(contrasena);
  hashes.set(contrasena, guardado);
  return guardado;
}

const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LARGO_CODIGO = 6;
let siguienteCodigo = 0;

/** Código válido y distinto cada vez, sin azar: una prueba que falle se puede repetir igual. */
export function codigoInvitacionDePrueba(): string {
  let resto = siguienteCodigo++;
  let codigo = '';
  for (let i = 0; i < LARGO_CODIGO; i++) {
    codigo = (ALFABETO_CODIGO[resto % ALFABETO_CODIGO.length] ?? 'A') + codigo;
    resto = Math.floor(resto / ALFABETO_CODIGO.length);
  }
  return codigo;
}

export interface EstudianteDePrueba {
  nombre?: string;
  correo: string;
  contrasena: string;
  correoVerificado?: boolean;
  /** Cuenta eliminada: sus datos quedan seudonimizados y ya no puede entrar. */
  eliminado?: boolean;
}

/** Inserta el estudiante y devuelve su id. */
export async function crearEstudianteDePrueba(
  bd: Ejecutor,
  {
    nombre = 'Eva Estudiante',
    correo,
    contrasena,
    correoVerificado = false,
    eliminado = false,
  }: EstudianteDePrueba,
): Promise<string> {
  const { rows } = await bd.query<{ id: string }>(
    `INSERT INTO app.estudiante (nombre, correo, hash_contrasena, correo_verificado, verificado_en,
                                 codigo_invitacion, creado_en, eliminado_en)
     VALUES ($1, $2, $3, $4, CASE WHEN $4 THEN now() END, $5, now(), CASE WHEN $6 THEN now() END)
     RETURNING id::text AS id`,
    [
      nombre,
      correo,
      await hashDeContrasena(contrasena),
      correoVerificado,
      codigoInvitacionDePrueba(),
      eliminado,
    ],
  );
  const fila = rows[0];
  if (!fila) throw new Error('El INSERT de estudiante no devolvió el id.');
  return fila.id;
}
