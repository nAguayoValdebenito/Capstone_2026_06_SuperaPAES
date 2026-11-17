// Datos que los middleware agregan a la petición de Express.
import type { RolCuentaInterna } from '../roles.js';

declare global {
  namespace Express {
    interface Request {
      /** Usuario de la consola autenticado (lo completa autenticarAdmin). */
      usuarioInterno?: { id: string; rol: RolCuentaInterna };
      /** Estudiante autenticado (lo completa autenticarApp). */
      estudiante?: { id: string };
      /** Bytes originales de un cuerpo JSON, para verificar los avisos firmados de las tiendas. */
      cuerpoCrudo?: Buffer;
    }
  }
}

export {};
