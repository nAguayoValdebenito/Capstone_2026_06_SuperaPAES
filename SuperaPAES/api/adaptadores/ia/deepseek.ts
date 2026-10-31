// DeepSeek: instrucción preparada por el generador, modelo leído de configuración al pedirla.
import { z } from 'zod';
import { ErrorIANoDisponible, ErrorIARespuestaInvalida } from '../../comun/errores.js';
import { crearPresupuestoIA, LIMITES_IA, solicitarIA, type PresupuestoIA } from './http.js';
import type { ProveedorIA, ResultadoGeneracion, SolicitudGeneracion } from './proveedor.js';
import {
  conUsoTokens,
  cuentaTokens,
  exigirModelo,
  FORMATO_JSON_IA,
  leerPreguntas,
  leerSobre,
} from './respuesta.js';

const esquemaSobre = z.object({
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().nullable() }),
        finish_reason: z.string(),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: cuentaTokens,
      completion_tokens: cuentaTokens,
      total_tokens: cuentaTokens,
    })
    .optional(),
});

interface OpcionesDeepSeek {
  claveApi: string;
  obtenerModeloPrincipal(): Promise<string>;
}

function interpretarDeepSeek(datos: unknown, modelo: string): ResultadoGeneracion {
  const sobre = leerSobre(esquemaSobre, datos);
  const opcion = sobre.choices[0];
  if (opcion?.finish_reason !== 'stop') throw new ErrorIARespuestaInvalida();
  return {
    proveedor: 'deepseek',
    modelo: sobre.model ?? modelo,
    preguntas: leerPreguntas(opcion.message.content),
    ...conUsoTokens(
      sobre.usage && {
        ...(sobre.usage.prompt_tokens !== undefined && { entrada: sobre.usage.prompt_tokens }),
        ...(sobre.usage.completion_tokens !== undefined && {
          salida: sobre.usage.completion_tokens,
        }),
        ...(sobre.usage.total_tokens !== undefined && { total: sobre.usage.total_tokens }),
      },
    ),
  };
}

export class ProveedorIADeepSeek implements ProveedorIA {
  readonly nombre = 'deepseek';

  constructor(private readonly opciones: OpcionesDeepSeek) {}

  generarPreguntas(solicitud: SolicitudGeneracion): Promise<ResultadoGeneracion> {
    return this.generarConPresupuesto(solicitud, crearPresupuestoIA());
  }

  async generarConPresupuesto(
    solicitud: SolicitudGeneracion,
    presupuesto: PresupuestoIA,
  ): Promise<ResultadoGeneracion> {
    let modelo: string;
    try {
      modelo = exigirModelo(await this.opciones.obtenerModeloPrincipal());
    } catch {
      throw new ErrorIANoDisponible();
    }
    return solicitarIA(
      {
        proveedor: this.nombre,
        url: 'https://api.deepseek.com/chat/completions',
        cabeceras: { Authorization: `Bearer ${this.opciones.claveApi}` },
        cuerpo: {
          model: modelo,
          stream: false,
          max_tokens: LIMITES_IA.maxTokens,
          thinking: { type: 'disabled' },
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: FORMATO_JSON_IA },
            { role: 'user', content: solicitud.instruccion },
          ],
        },
        interpretar: (datos) => interpretarDeepSeek(datos, modelo),
      },
      presupuesto,
    );
  }
}
