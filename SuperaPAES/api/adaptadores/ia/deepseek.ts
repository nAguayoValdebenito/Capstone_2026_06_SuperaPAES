// Proveedor de IA con DeepSeek (esqueleto: se implementará en la etapa del generador).
import { ErrorNoImplementado } from '../../comun/errores.js';
import type { ProveedorIA, ResultadoGeneracion } from './proveedor.js';

export class ProveedorIADeepSeek implements ProveedorIA {
  readonly nombre = 'deepseek';

  constructor(private readonly claveApi: string) {}

  generarPreguntas(): Promise<ResultadoGeneracion> {
    return Promise.reject(new ErrorNoImplementado('La generación con DeepSeek'));
  }
}
