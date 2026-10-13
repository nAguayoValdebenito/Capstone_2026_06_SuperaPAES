// Proveedor de IA simulado: devuelve siempre la misma pregunta, para desarrollo y pruebas.
import type { ProveedorIA, ResultadoGeneracion } from './proveedor.js';

export class ProveedorIASimulado implements ProveedorIA {
  readonly nombre = 'simulado';

  generarPreguntas(): Promise<ResultadoGeneracion> {
    return Promise.resolve({
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
          dificultadSugerida: 'facil',
        },
      ],
    });
  }
}
