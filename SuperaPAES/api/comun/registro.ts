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

/**
 * Solo la clase y el código del error (por ejemplo «error:23505»), nunca su mensaje: el mensaje de un error de
 * la base puede traer texto de las filas, como el de un lote de la IA.
 */
export function claseDeError(error: unknown): string {
  if (!(error instanceof Error)) return 'desconocido';
  const codigo = (error as { code?: unknown }).code;
  return typeof codigo === 'string' || typeof codigo === 'number'
    ? `${error.name}:${String(codigo)}`
    : error.name;
}
