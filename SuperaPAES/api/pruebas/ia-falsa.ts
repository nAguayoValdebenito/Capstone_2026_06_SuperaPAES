// Proveedor de IA falso e inyectable para las pruebas del generador (HU-16 a HU-18): nunca llama a un
// proveedor real. Por defecto devuelve una propuesta válida y distinta cada vez, que respeta la ficha de la
// instrucción (la habilidad que pide y la cantidad de alternativas del esquema). Cada prueba puede cambiar
// la respuesta de una llamada con `respuestas`, o hacer que falle.
import { vi } from 'vitest';
import type {
  PreguntaPropuesta,
  ProveedorIA,
  ResultadoGeneracion,
  SolicitudGeneracion,
} from '../adaptadores/ia/proveedor.js';

type Respuesta =
  ResultadoGeneracion | Error | ((s: SolicitudGeneracion, n: number) => ResultadoGeneracion);

/** La habilidad que pide la instrucción: «Habilidad: Resolver problemas (RP).». */
export function habilidadPedida(solicitud: SolicitudGeneracion): string {
  return /Habilidad: .*?\(([A-Z]+)\)\./u.exec(solicitud.instruccion)?.[1] ?? 'RP';
}

/** Una propuesta válida de M1: la clave $5$ coincide con el resultado de la resolución. */
export function propuestaValida(solicitud: SolicitudGeneracion, n: number): PreguntaPropuesta {
  const alternativas = solicitud.formato?.alternativas ?? 4;
  const letras = ['A', 'B', 'C', 'D', 'E'].slice(0, alternativas);
  return {
    enunciado: `¿Cuál es el valor de $x$ si $x + ${String(n)} = ${String(n + 5)}$ (caso ${String(n)})?`,
    resolucion: `Se resta $${String(n)}$ a ambos lados: $x = 5$.`,
    habilidad: habilidadPedida(solicitud),
    alternativas: letras.map((letra, i) => ({
      letra: letra as 'A' | 'B' | 'C' | 'D' | 'E',
      texto: i === 1 ? '$5$' : `$${String(6 + i)}$`,
      esCorrecta: i === 1,
      explicacion:
        i === 1 ? 'Con ese valor se cumple la igualdad.' : `Error de cálculo número ${String(i)}.`,
    })),
    explicacion: 'Se resta el mismo número a ambos lados de la igualdad.',
    dificultadSugerida: 'media',
  };
}

export function resultadoValido(solicitud: SolicitudGeneracion, n: number): ResultadoGeneracion {
  return {
    proveedor: 'deepseek',
    modelo: 'modelo-falso',
    preguntas: [propuestaValida(solicitud, n)],
    usoTokens: { entrada: 300, salida: 600, total: 900 },
    tokensUsados: 900,
  };
}

export function crearIaFalsa(
  opciones: { nombre?: ProveedorIA['nombre']; usa?: ProveedorIA['usa'] } = {},
) {
  const llamadas: SolicitudGeneracion[] = [];
  const respuestas: Respuesta[] = [];
  let contador = 0;
  const generarPreguntas = vi.fn((solicitud: SolicitudGeneracion): Promise<ResultadoGeneracion> => {
    llamadas.push(solicitud);
    contador += 1;
    const siguiente = respuestas.shift();
    if (siguiente instanceof Error) return Promise.reject(siguiente);
    if (typeof siguiente === 'function') return Promise.resolve(siguiente(solicitud, contador));
    return Promise.resolve(siguiente ?? resultadoValido(solicitud, contador));
  });
  const proveedor: ProveedorIA = {
    nombre: opciones.nombre ?? 'deepseek',
    usa: opciones.usa ?? ['deepseek'],
    generarPreguntas,
  };
  return {
    proveedor,
    generarPreguntas,
    llamadas,
    /** Encola la respuesta de las próximas llamadas, en orden; después vuelve a la válida. */
    encolar: (...nuevas: Respuesta[]) => respuestas.push(...nuevas),
    reiniciar() {
      llamadas.length = 0;
      respuestas.length = 0;
      contador = 0;
      generarPreguntas.mockClear();
    },
  };
}
