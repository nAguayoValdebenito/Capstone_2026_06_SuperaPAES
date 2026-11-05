// Cuentas de prueba de la base local de demostración, para entrar con un toque. Solo existen en desarrollo: la
// condición va aquí, con los datos adentro, para que la compilación de producción no los lleve.
export const CLAVE_DEMO = import.meta.env.DEV ? 'clave-para-probar-local' : '';

export const ACCESOS_DEMO: readonly { etiqueta: string; correo: string }[] = import.meta.env.DEV
  ? [
      { etiqueta: 'Administrador', correo: 'admin@ejemplo.cl' },
      { etiqueta: 'Docente 1', correo: 'docente1@ejemplo.cl' },
      { etiqueta: 'Docente 2', correo: 'docente2@ejemplo.cl' },
      { etiqueta: 'Docente 3', correo: 'docente3@ejemplo.cl' },
      { etiqueta: 'Docente 4', correo: 'docente4@ejemplo.cl' },
    ]
  : [];
