// Edición de la mezcla global de dificultad desde C09 (RN-09, RF-C12, HU-64; decisión del equipo del
// 14/11/2026 para el rediseño de la consola). Solo cambia mínimo, objetivo y máximo de las dificultades
// que ya existen: nunca agrega, quita ni renombra una. Las reglas son las de la base (CHECK de cada fila
// y trigger dificultad_suma) más las que hacen posible armar una mezcla: la suma de los mínimos no pasa
// de 100 ni la de los máximos queda bajo 100. El cambio y su auditoría (editar_catalogo) van en la misma
// transacción, con antes y después.
import { ErrorValidacion } from '../../comun/errores.js';
import type { ProblemaDeCampo } from '../../comun/middleware/validacion.js';
import type { UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type {
  DificultadLista,
  MezclaDificultad,
  TemarioListasRepositorio,
} from './temario.listas.repositorio.js';

export interface DependenciasMezcla {
  unidadDeTrabajo: UnidadDeTrabajo;
  listas: TemarioListasRepositorio;
  administracion: Pick<AdministracionServicio, 'registrarAuditoria'>;
}

const problema = (ruta: string, mensaje: string): ProblemaDeCampo => ({
  lugar: 'cuerpo',
  ruta,
  mensaje,
});

const suma = (mezcla: readonly MezclaDificultad[], campo: 'minimo' | 'objetivo' | 'maximo') =>
  mezcla.reduce((total, fila) => total + fila[campo], 0);

/** Cada dificultad: mínimo ≤ objetivo ≤ máximo (los enteros de 0 a 100 los revisa el esquema). */
function problemasDeCadaFila(mezcla: readonly MezclaDificultad[]): ProblemaDeCampo[] {
  return mezcla.flatMap((fila, i) => {
    if (fila.minimo <= fila.objetivo && fila.objetivo <= fila.maximo) return [];
    return [
      problema(
        `dificultades.${String(i)}`,
        `En «${fila.codigo}» el mínimo no puede pasar del objetivo ni el objetivo del máximo.`,
      ),
    ];
  });
}

/** Los objetivos suman 100 y la suma de mínimos y máximos deja armar una mezcla. */
function problemasDeLasSumas(mezcla: readonly MezclaDificultad[]): ProblemaDeCampo[] {
  const problemas: ProblemaDeCampo[] = [];
  const objetivos = suma(mezcla, 'objetivo');
  if (objetivos !== 100) {
    problemas.push(
      problema('dificultades', `Los objetivos deben sumar 100 (suman ${String(objetivos)}).`),
    );
  }
  if (suma(mezcla, 'minimo') > 100) {
    problemas.push(problema('dificultades', 'Los mínimos no pueden sumar más de 100.'));
  }
  if (suma(mezcla, 'maximo') < 100) {
    problemas.push(problema('dificultades', 'Los máximos deben sumar al menos 100.'));
  }
  return problemas;
}

/** Vienen todas las dificultades existentes, una vez cada una, y ninguna otra. */
function problemasDeLosCodigos(
  mezcla: readonly MezclaDificultad[],
  existentes: readonly DificultadLista[],
): ProblemaDeCampo[] {
  const conocidos = new Set(existentes.map((d) => d.codigo));
  const vistos = new Set<string>();
  const problemas: ProblemaDeCampo[] = [];
  mezcla.forEach(({ codigo }, i) => {
    const ruta = `dificultades.${String(i)}.codigo`;
    if (!conocidos.has(codigo))
      problemas.push(problema(ruta, `La dificultad «${codigo}» no existe.`));
    else if (vistos.has(codigo)) problemas.push(problema(ruta, `«${codigo}» viene repetida.`));
    vistos.add(codigo);
  });
  const faltan = [...conocidos].filter((codigo) => !vistos.has(codigo));
  if (faltan.length > 0) {
    problemas.push(problema('dificultades', `Faltan las dificultades: ${faltan.join(', ')}.`));
  }
  return problemas;
}

/** Todos los problemas de la mezcla pedida; una lista vacía si se puede guardar. */
export function problemasDeLaMezcla(
  mezcla: readonly MezclaDificultad[],
  existentes: readonly DificultadLista[],
): ProblemaDeCampo[] {
  return [
    ...problemasDeLosCodigos(mezcla, existentes),
    ...problemasDeCadaFila(mezcla),
    ...problemasDeLasSumas(mezcla),
  ];
}

const soloMezcla = ({ codigo, minimo, objetivo, maximo }: DificultadLista) => ({
  codigo,
  minimo,
  objetivo,
  maximo,
});

/**
 * Guarda la mezcla y la deja en la auditoría en la misma transacción. Devuelve las dificultades como
 * las entrega C09. 400 VALIDACION con todos los problemas si la mezcla no se puede guardar.
 */
export function crearEdicionMezcla(d: DependenciasMezcla) {
  return (autorId: string, mezcla: readonly MezclaDificultad[]): Promise<DificultadLista[]> =>
    d.unidadDeTrabajo.enTransaccion(async (tx) => {
      const antes = await d.listas.reservarDificultades(tx);
      const problemas = problemasDeLaMezcla(mezcla, antes);
      if (problemas.length > 0) {
        throw new ErrorValidacion(problemas, problemas[0]?.mensaje);
      }
      await d.listas.actualizarMezcla(mezcla, tx);
      const despues = await d.listas.dificultades(tx);
      await d.administracion.registrarAuditoria(
        {
          usuarioId: autorId,
          accion: 'editar_catalogo',
          entidad: 'dificultad',
          entidadId: 'mezcla',
          antes: { dificultades: antes.map(soloMezcla) },
          despues: { dificultades: despues.map(soloMezcla) },
        },
        tx,
      );
      return despues;
    });
}
