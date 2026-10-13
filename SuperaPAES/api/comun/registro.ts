// Registro estructurado: una línea JSON por evento, en un solo formato para toda la API.

type Campos = Record<string, unknown>;

export const registro = {
  info(mensaje: string, campos: Campos = {}): void {
    console.log(JSON.stringify({ nivel: 'info', mensaje, ...campos }));
  },
  error(mensaje: string, campos: Campos = {}): void {
    console.error(JSON.stringify({ nivel: 'error', mensaje, ...campos }));
  },
};

/** Mensaje legible de cualquier valor lanzado, para registrarlo sin su traza completa. */
export function mensajeDeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
