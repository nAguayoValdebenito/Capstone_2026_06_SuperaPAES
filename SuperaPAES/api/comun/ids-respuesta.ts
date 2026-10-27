// Único contrato de serialización de ids HTTP. Cada ruta enumera sus campos, incluso listas/anidados.
// Al agregar un campo o una ruta con ids, se registra aquí y se actualiza la prueba del inventario.

/** Ids del perfil del estudiante (HU-29.1): sus pruebas, el electivo, la prueba a reforzar y las áreas. */
const CAMPOS_PERFIL = [
  'data.pruebas[]',
  'data.electivoId',
  'data.pruebaReforzarId',
  'data.areasCarrera[]',
] as const;

export const CAMPOS_ID_POR_RUTA: Readonly<Record<string, readonly string[]>> = {
  'POST /api/v1/app/cuentas/registro': ['data.estudiante.id'],
  'POST /api/v1/app/cuentas/ingreso': ['data.estudiante.id'],
  'GET /api/v1/app/cuentas/documentos-legales/vigentes': ['data[].id'],
  'GET /api/v1/app/cuentas/perfil': CAMPOS_PERFIL,
  'PUT /api/v1/app/cuentas/perfil': CAMPOS_PERFIL,
  'POST /api/v1/app/cuentas/perfil/confirmar-curso': CAMPOS_PERFIL,
  'GET /api/v1/app/temario/opciones-perfil': [
    'data.pruebas[].id',
    'data.pruebas[].electivos[].id',
    'data.areasCarrera[].id',
    'data.areasCarrera[].pruebasSugeridas[]',
    'data.areasCarrera[].electivoSugeridoId',
  ],
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
  'GET /api/v1/admin/preguntas/': [
    'data[].id',
    'data[].prueba.id',
    'data[].eje.id',
    'data[].contenido.id',
  ],
  'GET /api/v1/admin/preguntas/filtros': [
    'data.pruebas[].id',
    'data.pruebas[].ejes[].id',
    'data.pruebas[].ejes[].contenidos[].id',
    'data.pruebas[].habilidades[].id',
  ],
  'POST /api/v1/app/evaluaciones/practicas': [
    'data.id',
    'data.pruebaId',
    'data.ejeId',
    'data.contenidoId',
    'data.habilidadId',
    'data.dificultadId',
  ],
  'POST /api/v1/app/evaluaciones/practicas/:id/siguiente': ['data.id', 'data.alternativas[].id'],
  'POST /api/v1/app/evaluaciones/practicas/:id/cerrar': [
    'data.id',
    'data.prueba.id',
    'data.alcance.id',
    'data.dificultad.id',
    'data.ejes[].id',
    'data.habilidades[].id',
  ],
  'GET /api/v1/app/evaluaciones/practicas/:id/resumen': [
    'data.id',
    'data.prueba.id',
    'data.alcance.id',
    'data.dificultad.id',
    'data.ejes[].id',
    'data.habilidades[].id',
  ],
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
