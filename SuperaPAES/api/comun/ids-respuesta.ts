// Único contrato de serialización de ids HTTP. Cada ruta enumera sus campos, incluso listas/anidados.
// Al agregar un campo o una ruta con ids, se registra aquí y se actualiza la prueba del inventario.
export const CAMPOS_ID_POR_RUTA: Readonly<Record<string, readonly string[]>> = {
  'POST /api/v1/app/cuentas/registro': ['data.estudiante.id'],
  'POST /api/v1/app/cuentas/ingreso': ['data.estudiante.id'],
  'GET /api/v1/app/cuentas/documentos-legales/vigentes': ['data[].id'],
  'POST /api/v1/admin/cuentas/ingreso': ['data.usuario.id'],
  'GET /api/v1/admin/cuentas/yo': ['data.id', 'data.areas[]'],
  'GET /api/v1/admin/cuentas/estudiantes': ['data[].id'],
  'POST /api/v1/admin/cuentas/estudiantes/:id/confirmar-correo': ['data.id'],
  'GET /api/v1/admin/administracion/usuarios-internos': ['data[].id', 'data[].areas[]'],
  'POST /api/v1/admin/administracion/usuarios-internos': ['data.id', 'data.areas[]'],
  'PATCH /api/v1/admin/administracion/usuarios-internos/:id': ['data.id', 'data.areas[]'],
  'POST /api/v1/admin/administracion/usuarios-internos/:id/activar': ['data.id', 'data.areas[]'],
  'POST /api/v1/admin/administracion/usuarios-internos/:id/desactivar': ['data.id', 'data.areas[]'],
  'GET /api/v1/admin/temario/areas': ['data[].id'],
  'POST /api/v1/app/evaluaciones/practicas': [
    'data.id',
    'data.pruebaId',
    'data.ejeId',
    'data.contenidoId',
    'data.habilidadId',
    'data.dificultadId',
  ],
  'POST /api/v1/app/evaluaciones/practicas/:id/siguiente': ['data.id', 'data.alternativas[].id'],
  'POST /api/v1/app/evaluaciones/:id/items/:item/respuesta': [
    'data.alternativaElegidaId',
    'data.alternativaCorrectaId',
    'data.alternativas[].id',
  ],
};

const MAXIMO_ID = BigInt(Number.MAX_SAFE_INTEGER);

function convertirId(valor: unknown): unknown {
  if (valor === null) return null;
  if (typeof valor === 'number') {
    if (!Number.isInteger(valor)) return valor;
    if (!Number.isSafeInteger(valor) || valor <= 0)
      throw new Error('El id de salida no cabe en un entero seguro.');
    return valor;
  }
  if (typeof valor !== 'string' || !/^\d+$/.test(valor)) return valor;
  const entero = BigInt(valor);
  if (entero <= 0n || entero > MAXIMO_ID)
    throw new Error('El id de salida no cabe en un entero seguro.');
  return Number(entero);
}

/** Convierte exclusivamente las rutas de campo enumeradas. `[]` permite listas a cualquier nivel. */
export function serializarIds<T>(datos: T, campos: readonly string[]): T {
  const permitidos = new Set(campos);
  function recorrer(valor: unknown, ruta: string): unknown {
    if (permitidos.has(ruta)) return convertirId(valor);
    if (Array.isArray(valor)) return valor.map((elemento) => recorrer(elemento, `${ruta}[]`));
    if (
      valor !== null &&
      typeof valor === 'object' &&
      Object.getPrototypeOf(valor) === Object.prototype
    )
      return Object.fromEntries(
        Object.entries(valor).map(([clave, dato]) => [clave, recorrer(dato, `${ruta}.${clave}`)]),
      );
    return valor;
  }
  return recorrer(datos, 'data') as T;
}
