// Gemini por REST; la clave viaja en una cabecera y el modelo procede del entorno.
import { z } from 'zod';
import { ErrorIARespuestaInvalida } from '../../comun/errores.js';
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
  modelVersion: z.string().optional(),
  candidates: z
    .array(
      z.object({
        finishReason: z.string(),
        content: z
          .object({
            parts: z.array(
              z.object({ text: z.string().optional(), thought: z.boolean().optional() }),
            ),
          })
          .optional(),
      }),
    )
    .min(1),
  usageMetadata: z
    .object({
      promptTokenCount: cuentaTokens,
      candidatesTokenCount: cuentaTokens,
      totalTokenCount: cuentaTokens,
    })
    .optional(),
});

interface OpcionesGemini {
  claveApi: string;
  modelo: string;
}

export class ProveedorIAGemini implements ProveedorIA {
  readonly nombre = 'gemini';

  constructor(private readonly opciones: OpcionesGemini) {}

  generarPreguntas(solicitud: SolicitudGeneracion): Promise<ResultadoGeneracion> {
    return this.generarConPresupuesto(solicitud, crearPresupuestoIA());
  }

  async generarConPresupuesto(
    solicitud: SolicitudGeneracion,
    presupuesto: PresupuestoIA,
  ): Promise<ResultadoGeneracion> {
    const modelo = exigirModelo(this.opciones.modelo);
    return solicitarIA(
      {
        proveedor: this.nombre,
        url: `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
        cabeceras: { 'x-goog-api-key': this.opciones.claveApi },
        cuerpo: {
          contents: [{ role: 'user', parts: [{ text: solicitud.instruccion }] }],
          systemInstruction: { parts: [{ text: FORMATO_JSON_IA }] },
          generationConfig: {
            maxOutputTokens: LIMITES_IA.maxTokens,
            responseMimeType: 'application/json',
          },
        },
        interpretar: (datos) => {
          const sobre = leerSobre(esquemaSobre, datos);
          const opcion = sobre.candidates[0];
          if (opcion?.finishReason !== 'STOP') throw new ErrorIARespuestaInvalida();
          const texto =
            opcion.content?.parts
              .filter((parte) => !parte.thought)
              .map((parte) => parte.text ?? '')
              .join('') ?? '';
          return {
            proveedor: this.nombre,
            modelo: sobre.modelVersion ?? modelo,
            preguntas: leerPreguntas(texto),
            ...conUsoTokens(
              sobre.usageMetadata && {
                ...(sobre.usageMetadata.promptTokenCount !== undefined && {
                  entrada: sobre.usageMetadata.promptTokenCount,
                }),
                ...(sobre.usageMetadata.candidatesTokenCount !== undefined && {
                  salida: sobre.usageMetadata.candidatesTokenCount,
                }),
                ...(sobre.usageMetadata.totalTokenCount !== undefined && {
                  total: sobre.usageMetadata.totalTokenCount,
                }),
              },
            ),
          };
        },
      },
      presupuesto,
    );
  }
}
