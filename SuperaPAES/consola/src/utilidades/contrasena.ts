// Requisitos de la contraseña (RN-31), para avisar en el formulario antes de enviar. La API vuelve a
// validarla con su componente común, que también rechazará las contraseñas comunes (HU-01.4).

export const REQUISITOS_CONTRASENA =
  'De 8 a 72 caracteres, sin exigir símbolos, mayúsculas ni números. No puede ser igual al correo.';

const MAXIMO_BYTES = 72;

/** El requisito que falta, o null si la contraseña cumple RN-31. */
export function problemaContrasena(texto: string, correo: string): string | null {
  const largo = [...texto].length;
  if (largo < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (largo > 72 || new TextEncoder().encode(texto).length > MAXIMO_BYTES) {
    return 'La contraseña es demasiado larga.';
  }
  if (texto.trim().toLowerCase() === correo.trim().toLowerCase()) {
    return 'La contraseña no puede ser igual al correo.';
  }
  return null;
}
