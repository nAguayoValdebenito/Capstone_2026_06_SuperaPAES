// Proveedor de IA con Google Gemini (esqueleto: se implementará en la etapa del generador).
import { ErrorNoImplementado } from '../../comun/errores.js';
import type { ProveedorIA, ResultadoGeneracion } from './proveedor.js';

export class ProveedorIAGemini implements ProveedorIA {
  readonly nombre = 'gemini';

  constructor(private readonly claveApi: string) {}

  generarPreguntas(): Promise<ResultadoGeneracion> {
    return Promise.reject(new ErrorNoImplementado('La generación con Gemini'));
  }
}
