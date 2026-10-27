// Reglas de una pregunta al crearla o editarla (HU-12, RF-G02, RN-08). La base solo exige RN-08 al
// enviar a revisión; CP-09 pide rechazar al guardar, así que se revisan aquí, con los datos de cada
// prueba que entrega el temario (nunca con cantidades fijas en el código).
import type { ProblemaDeCampo } from '../../comun/middleware/validacion.js';
import type { PruebaTemario } from '../temario/index.js';
import type { Opcion } from './preguntas.repositorio.js';
import { type AlternativaPregunta, type DatosPregunta, LETRAS } from './preguntas.validadores.js';

const problema = (ruta: string, mensaje: string): ProblemaDeCampo => ({
  lugar: 'cuerpo',
  ruta,
  mensaje,
});

/** RN-08: cuántas alternativas, con letras seguidas desde la A y una sola correcta. */
export function problemasDeAlternativas(
  alternativas: readonly AlternativaPregunta[],
  prueba: PruebaTemario,
): ProblemaDeCampo[] {
  const problemas: ProblemaDeCampo[] = [];
  const { nombre, opcionesMin: minimo, opcionesMax: maximo } = prueba;
  if (alternativas.length < minimo || alternativas.length > maximo) {
    // El modelo solo admite 4 o 5 (CHECK de contenido.prueba): «4 o 5» cubre todos los rangos.
    const cantidad = minimo === maximo ? String(minimo) : `${String(minimo)} o ${String(maximo)}`;
    problemas.push(problema('alternativas', `${nombre} lleva ${cantidad} alternativas.`));
  }
  if (alternativas.some((alternativa, i) => alternativa.letra !== LETRAS[i])) {
    problemas.push(
      problema('alternativas', 'Las alternativas van con letras seguidas desde la A, sin repetir.'),
    );
  }
  const correctas = alternativas.filter((alternativa) => alternativa.esCorrecta).length;
  if (correctas !== 1) {
    const mensaje =
      correctas === 0 ? 'Marca la alternativa correcta.' : 'Marca una sola alternativa correcta.';
    problemas.push(problema('alternativas', mensaje));
  }
  return problemas;
}

/** El contenido, la habilidad y el tipo de pregunta son de la prueba, y la dificultad existe. */
function problemasDelTemario(
  datos: DatosPregunta,
  prueba: PruebaTemario,
  dificultades: readonly Opcion[],
): ProblemaDeCampo[] {
  const problemas: ProblemaDeCampo[] = [];
  const contenidos = prueba.ejes.flatMap((eje) => eje.contenidos);
  if (!contenidos.some((contenido) => contenido.id === datos.contenidoId)) {
    problemas.push(problema('contenidoId', `El contenido no es de ${prueba.nombre}.`));
  }
  if (!prueba.habilidades.some((habilidad) => habilidad.id === datos.habilidadId)) {
    problemas.push(problema('habilidadId', `La habilidad no es de ${prueba.nombre}.`));
  }
  if (!prueba.tiposPregunta.some((tipo) => tipo.codigo === datos.tipoPregunta)) {
    problemas.push(problema('tipoPregunta', `${prueba.nombre} no admite ese tipo de pregunta.`));
  }
  const { dificultadSugerida } = datos;
  if (dificultadSugerida !== null && !dificultades.some((d) => d.codigo === dificultadSugerida)) {
    problemas.push(problema('dificultadSugerida', 'La dificultad no existe.'));
  }
  return problemas;
}

/**
 * Todo lo que falta o no corresponde en la pregunta, para mostrarlo de una vez en el formulario (C03).
 * `existeTexto` dice si el texto de lectura elegido está guardado.
 */
export function problemasDePregunta(
  datos: DatosPregunta,
  prueba: PruebaTemario | undefined,
  dificultades: readonly Opcion[],
  existeTexto: boolean,
): ProblemaDeCampo[] {
  if (!prueba) return [problema('pruebaId', 'La prueba no existe.')];
  const problemas = [
    ...problemasDelTemario(datos, prueba, dificultades),
    ...problemasDeAlternativas(datos.alternativas, prueba),
  ];
  if (prueba.requiereTexto && datos.textoEstimuloId === null) {
    problemas.push(
      problema('textoEstimuloId', `En ${prueba.nombre} cada pregunta va con su texto de lectura.`),
    );
  } else if (datos.textoEstimuloId !== null && !existeTexto) {
    problemas.push(problema('textoEstimuloId', 'El texto de lectura no existe.'));
  }
  return problemas;
}
