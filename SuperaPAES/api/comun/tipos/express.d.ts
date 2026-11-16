// Datos que los middleware agregan a la petición de Express.
import type { RolCuentaInterna } from '../roles.js';

declare global {
  namespace Express {
    interface Request {
      /**
       * Usuario de la consola autenticado (lo completa autenticarAdmin). `sid` es su sesión
       * (app.token_sesion): cambiar la contraseña cierra las demás y conserva esta.
       */
      usuarioInterno?: { id: string; rol: RolCuentaInterna; sid: string };
      /** Estudiante autenticado (lo completa autenticarApp). */
      estudiante?: { id: string };
      /** Bytes originales de un cuerpo JSON, para verificar los avisos firmados de las tiendas. */
      cuerpoCrudo?: Buffer;
    }
  }
}

export {};
