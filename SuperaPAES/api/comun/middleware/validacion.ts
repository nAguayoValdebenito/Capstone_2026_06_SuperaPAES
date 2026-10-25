// Valida cuerpo, parámetros y consulta con esquemas zod antes de llegar al controlador.
import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { ErrorValidacion } from '../errores.js';

interface Esquemas {
  cuerpo?: z.ZodType;
  parametros?: z.ZodType;
  consulta?: z.ZodType;
}

/** Problema de un campo: dónde, qué y, si el esquema lo indica, un motivo que la app puede leer. */
export interface ProblemaDeCampo {
  lugar: string;
  ruta: string;
  mensaje: string;
  motivo?: string;
}

/** Un refinamiento puede indicar su motivo en params (por ejemplo contrasena_comun, RN-31). */
function motivoDe(problema: z.core.$ZodIssue): { motivo?: string } {
  const params =
    problema.code === 'custom' ? (problema.params as { motivo?: unknown } | undefined) : undefined;
  return typeof params?.motivo === 'string' ? { motivo: params.motivo } : {};
}

export function validar(esquemas: Esquemas): RequestHandler {
  return (req, res, next) => {
    const problemas: ProblemaDeCampo[] = [];
    const revisar = (lugar: string, esquema: z.ZodType | undefined, valor: unknown) => {
      if (!esquema) return valor;
      const resultado = esquema.safeParse(valor);
      if (resultado.success) return resultado.data;
      for (const problema of resultado.error.issues) {
        problemas.push({
          lugar,
          ruta: problema.path.join('.'),
          mensaje: problema.message,
          ...motivoDe(problema),
        });
      }
      return valor;
    };

    const cuerpo: unknown = revisar('cuerpo', esquemas.cuerpo, req.body);
    const parametros = revisar('parametros', esquemas.parametros, req.params);
    // En Express 5 req.query es de solo lectura: la consulta validada queda en res.locals.
    const consulta = revisar('consulta', esquemas.consulta, req.query);

    if (problemas.length > 0) {
      next(new ErrorValidacion(problemas));
      return;
    }
    req.body = cuerpo;
    req.params = parametros as typeof req.params;
    res.locals.consulta = consulta;
    next();
  };
}
