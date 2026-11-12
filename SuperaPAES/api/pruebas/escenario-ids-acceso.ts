/** Cuerpos de registro e ingreso para el escenario de contratos HTTP. */
export function cuerpoParaAcceso(ruta: string): Record<string, unknown> | undefined {
  if (ruta.endsWith('/registro'))
    return {
      nombre: 'Ana',
      correo: 'ana@ejemplo.cl',
      contrasena: 'Clave-larga-123',
      declaraTenerCatorceAnios: true,
      documentosAceptados: [1, 2],
    };
  if (ruta.endsWith('/ingreso'))
    return {
      correo: 'ana@ejemplo.cl',
      contrasena: 'Clave-larga-123',
    };
  return undefined;
}
