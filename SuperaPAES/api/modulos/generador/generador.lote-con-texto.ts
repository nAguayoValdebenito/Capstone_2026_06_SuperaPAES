// Un lote con texto de lectura (HU-18.1 y HU-18.2, CU-17): primero se pide el texto (hasta 3 intentos, cada uno
// revisado) y después una pregunta por ficha apoyada en él, rotando Localizar, Interpretar y Evaluar. El texto y
// sus preguntas se guardan juntos al final, en una sola transacción: si el proceso muere antes, no queda un texto
// huérfano ni preguntas sueltas, y el siguiente turno parte de cero. Lo que sí se anota al instante es el gasto de
// cada llamada, porque es dinero real y cuenta para el tope mensual.
import type { ResultadoGeneracion } from '../../adaptadores/ia/proveedor.js';
import { mensajeDeError, registro } from '../../comun/registro.js';
import type { PropuestaDeIa } from '../preguntas/index.js';
import {
  cierreTrasFalla,
  consumoDe,
  guardableDe,
  guardarAvance,
  revisar,
} from './generador.avance.js';
import type { Ficha } from './generador.fichas.js';
import {
  anotarDescarte,
  anotarFalla,
  anotarTextoDescartado,
  leerMotivos,
  type CierreDeLote,
  type MotivosDelLote,
} from './generador.motivos.js';
import type {
  DependenciasProcesador,
  FallaDeLaIa,
  TextoGenerado,
  Turno,
} from './generador.procesador.tipos.js';
import { recorrerFichas, type Registrador } from './generador.tandas.js';
import { revisarTexto, tipoDeTextoDe } from './generador.texto.js';
import { motivoParaParar, pedirTexto } from './generador.turno.js';

/** Intentos para conseguir un texto que pase la revisión antes de rendirse con el lote. */
export const INTENTOS_DE_TEXTO = 3;

/** Lo que el lote lleva en memoria hasta guardar todo junto al final. */
interface Acumulado {
  propuestas: PropuestaDeIa[];
  descartadas: number;
  motivos: MotivosDelLote;
}

/** Anota solo el gasto de una llamada (los conteos y los motivos van al final). */
async function anotarGasto(
  d: DependenciasProcesador,
  turno: Turno,
  resultado: ResultadoGeneracion,
): Promise<void> {
  const consumo = consumoDe(resultado, turno.precios);
  await guardarAvance(d, turno, { validas: 0, descartadas: 0, ...consumo, anotar: (m) => m });
}

/** Revisa el texto que llegó y, si es válido, lo entrega con su tipo; si no, anota por qué se descartó. */
function aceptarTexto(
  turno: Turno,
  acum: Acumulado,
  resultado: ResultadoGeneracion,
): TextoGenerado | null {
  const texto = resultado.texto;
  const problemas = texto
    ? revisarTexto(texto)
    : [{ motivo: 'texto_invalido' as const, detalle: 'La IA no devolvió ningún texto.' }];
  if (texto && problemas.length === 0) {
    return { ...texto, tipo: tipoDeTextoDe(turno.contenido.eje.nombre) };
  }
  acum.motivos = anotarTextoDescartado(acum.motivos, problemas);
  return null;
}

/** Pide el texto hasta 3 veces; devuelve el aceptado, o el motivo por el que el lote no puede seguir. */
async function obtenerTexto(
  d: DependenciasProcesador,
  turno: Turno,
  acum: Acumulado,
): Promise<TextoGenerado | CierreDeLote> {
  for (let intento = 0; intento < INTENTOS_DE_TEXTO; intento++) {
    const parar = await motivoParaParar(d, turno);
    if (parar) return parar;
    const respuesta = await pedirTexto(d, turno);
    if (respuesta.tipo === 'falla') {
      acum.motivos = anotarFalla(acum.motivos, respuesta.codigo);
      const cierre = cierreTrasFalla(turno, respuesta);
      if (cierre) return cierre;
      continue;
    }
    turno.fallasSeguidas = 0;
    await anotarGasto(d, turno, respuesta.resultado);
    const texto = aceptarTexto(turno, acum, respuesta.resultado);
    if (texto) return texto;
  }
  return 'texto_invalido';
}

/** Registra cada pregunta en memoria; solo el gasto va a la base al instante. */
function registradorAcumulado(
  d: DependenciasProcesador,
  turno: Turno,
  acum: Acumulado,
): Registrador {
  return {
    falla(falla: FallaDeLaIa) {
      acum.motivos = anotarFalla(acum.motivos, falla.codigo);
      // Sin saldo la llamada no se atendió y no cuenta como pregunta pedida.
      if (!falla.saldoAgotado) acum.descartadas += 1;
      return Promise.resolve(cierreTrasFalla(turno, falla));
    },
    async respuesta(ficha: Ficha, resultado: ResultadoGeneracion) {
      turno.fallasSeguidas = 0;
      await anotarGasto(d, turno, resultado);
      const problemas = revisar(turno, ficha, resultado);
      if (problemas.length > 0) {
        acum.descartadas += 1;
        acum.motivos = anotarDescarte(acum.motivos, problemas);
        return;
      }
      const propuesta = resultado.preguntas[0]!;
      acum.propuestas.push(guardableDe(d, turno, propuesta));
      turno.existentes.push(propuesta.enunciado);
    },
  };
}

/** Guarda el texto con sus preguntas y los conteos del lote en una sola transacción. */
async function guardarTodo(
  d: DependenciasProcesador,
  turno: Turno,
  acum: Acumulado,
): Promise<void> {
  await d.unidadDeTrabajo.enTransaccion(async (tx) => {
    const fila = await d.lotes.obtenerParaActualizar(turno.lote.id, tx);
    if (fila?.estado !== 'pendiente') return;
    if (turno.texto && acum.propuestas.length > 0) {
      const textoEstimuloId = await d.preguntas.guardarTextoDeIa(
        { loteId: turno.lote.id, ...turno.texto },
        tx,
      );
      for (const [i, propuesta] of acum.propuestas.entries()) {
        await d.preguntas.guardarPropuestaDeIa(
          { ...propuesta, textoEstimuloId, ordenEnTexto: i + 1 },
          tx,
        );
      }
    }
    await d.lotes.registrarAvance(
      turno.lote.id,
      {
        validas: acum.propuestas.length,
        descartadas: acum.descartadas,
        tokens: null,
        costoUsd: null,
        modelo: null,
        motivos: acum.motivos,
      },
      tx,
    );
  });
}

/** Si no se pudo guardar el texto con sus preguntas, el lote se cierra sin ellas: no se reintenta pagando de nuevo. */
async function guardarTodoOCerrarSinEllas(
  d: DependenciasProcesador,
  turno: Turno,
  acum: Acumulado,
): Promise<void> {
  try {
    await guardarTodo(d, turno, acum);
  } catch (error) {
    registro.error('No se pudo guardar un texto de la IA con sus preguntas', {
      loteId: turno.lote.id,
      error: mensajeDeError(error),
    });
    await guardarTodo(d, turno, {
      propuestas: [],
      descartadas: acum.propuestas.length + acum.descartadas,
      motivos: anotarFalla(acum.motivos, 'ERROR_AL_GUARDAR'),
    });
  }
}

export async function trabajarConTexto(
  d: DependenciasProcesador,
  turno: Turno,
): Promise<CierreDeLote> {
  const acum: Acumulado = {
    propuestas: [],
    descartadas: 0,
    motivos: leerMotivos(turno.lote.motivosDescarte),
  };
  const texto = await obtenerTexto(d, turno, acum);
  let cierre: CierreDeLote;
  if (typeof texto === 'string') {
    cierre = texto;
  } else {
    turno.texto = texto;
    cierre = await recorrerFichas(d, turno, registradorAcumulado(d, turno, acum));
  }
  await guardarTodoOCerrarSinEllas(d, turno, acum);
  return cierre;
}
