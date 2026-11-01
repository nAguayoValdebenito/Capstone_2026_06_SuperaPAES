// Proveedor de IA simulado: devuelve siempre la misma pregunta, para desarrollo y pruebas.
import type { ProveedorIA, ResultadoGeneracion, SolicitudGeneracion } from './proveedor.js';

function textoSimulado(): ResultadoGeneracion {
  const parrafo =
    'La ciudad había crecido junto al río durante siglos, y sus habitantes aprendieron a leer el agua como quien lee un libro: ' +
    'sabían cuándo subiría, cuándo traería barro fértil y cuándo era mejor guardar las barcas. ';
  return {
    proveedor: 'simulado',
    modelo: 'simulado',
    tokensUsados: 0,
    costoUsd: 0,
    preguntas: [],
    texto: { titulo: 'La ciudad y el río', contenido: parrafo.repeat(4).trim() },
  };
}

export class ProveedorIASimulado implements ProveedorIA {
  readonly nombre = 'simulado';
  readonly usa = [] as const;

  generarPreguntas(solicitud?: SolicitudGeneracion): Promise<ResultadoGeneracion> {
    if (solicitud?.salida === 'texto') return Promise.resolve(textoSimulado());
    return Promise.resolve({
      proveedor: 'simulado',
      modelo: 'simulado',
      tokensUsados: 0,
      costoUsd: 0,
      preguntas: [
        {
          enunciado: '¿Cuál es el valor de $x$ en la ecuación $2x + 3 = 11$?',
          alternativas: [
            {
              letra: 'A',
              texto: '$3$',
              esCorrecta: false,
              explicacion: 'Con $x = 3$ se obtiene $2 \\cdot 3 + 3 = 9$, no $11$.',
            },
            {
              letra: 'B',
              texto: '$4$',
              esCorrecta: true,
              explicacion: 'Con $x = 4$ se obtiene $2 \\cdot 4 + 3 = 11$.',
            },
            {
              letra: 'C',
              texto: '$7$',
              esCorrecta: false,
              explicacion: 'Resulta de restar $11 - 4$; no despeja $x$.',
            },
            {
              letra: 'D',
              texto: '$8$',
              esCorrecta: false,
              explicacion: 'Es el valor de $2x$, falta dividir por $2$.',
            },
          ],
          explicacion:
            'Se resta $3$ a ambos lados ($2x = 8$) y se divide por $2$, por lo que $x = 4$.',
          resolucion: 'Se resta $3$ a ambos lados ($2x = 8$) y se divide por $2$: $x = 4$.',
          habilidad: 'RP',
          dificultadSugerida: 'facil',
        },
      ],
    });
  }
}
