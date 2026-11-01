// El productor de la cola de generación (CU-17 pasos 1 y 2, HU-16.2): valida el pedido contra el temario,
// comprueba los topes y los precios, registra el lote pendiente con su auditoría y responde de inmediato.
// La IA se llama después, desde el worker (DAS 4.1.2: nunca durante una petición que espera el usuario).
import type { ProveedorIA } from '../../adaptadores/ia/proveedor.js';
import {
  ErrorNoEncontrado,
  ErrorPrecioIaNoConfigurado,
  ErrorTopeDiarioIa,
  ErrorTopeMensualIa,
  ErrorValidacion,
} from '../../comun/errores.js';
import type { Reloj } from '../../comun/reloj.js';
import type { Ejecutor, UnidadDeTrabajo } from '../../db/transaccion.js';
import type { AdministracionServicio } from '../administracion/index.js';
import type { ContenidoParaGenerar, TemarioServicio } from '../temario/index.js';
import { leerPrecios } from './generador.costo.js';
import { VERSION_INSTRUCCIONES } from './generador.instrucciones.js';
import type { FilaLote, LotesRepositorio } from './generador.lotes.repositorio.js';
import type { DatosNuevoLote, DatosNuevoLoteHttp, LoteDto } from './generador.tipos.js';

/** HU-18.1: con un texto de lectura, las preguntas cubren Localizar, Interpretar y Evaluar. */
export const MINIMO_PREGUNTAS_CON_TEXTO = 3;
const LARGO_MAXIMO_MODELO = 50;
const TIPO_DE_PREGUNTA = 'seleccion_multiple';

export interface DependenciasProductor {
  unidadDeTrabajo: UnidadDeTrabajo;
  reloj: Reloj;
  lotes: LotesRepositorio;
  temario: Pick<TemarioServicio, 'contenidoParaGenerar'>;
  administracion: Pick<
    AdministracionServicio,
    | 'obtenerParametroEntero'
    | 'obtenerParametroNumero'
    | 'obtenerParametroTexto'
    | 'registrarAuditoria'
  >;
  ia: Pick<ProveedorIA, 'nombre' | 'usa'>;
}

export function aLoteDto(fila: FilaLote): LoteDto {
  return {
    id: fila.id,
    estado: fila.estado,
    contenidoId: fila.contenidoId,
    cantidad: fila.cantidad,
    conTexto: fila.conTexto,
    validas: fila.validas,
    descartadas: fila.descartadas,
    procesadas: fila.validas + fila.descartadas,
    modelo: fila.modelo,
    versionInstrucciones: fila.versionInstrucciones,
    tokensUsados: fila.tokensUsados,
    costoUsd: fila.costoUsd,
    motivos: fila.motivosDescarte,
    creadoEn: fila.creadoEn,
  };
}

function errorDeCampo(ruta: string, mensaje: string, motivo: string): ErrorValidacion {
  return new ErrorValidacion([{ lugar: 'cuerpo', ruta, mensaje, motivo }], mensaje);
}

function validarContenido(contenido: ContenidoParaGenerar | null): ContenidoParaGenerar {
  if (contenido === null) {
    throw errorDeCampo('contenidoId', 'El contenido no existe.', 'contenido_inexistente');
  }
  if (!contenido.activo) {
    throw errorDeCampo('contenidoId', 'El contenido no está activo.', 'contenido_inactivo');
  }
  if (!contenido.prueba.tiposPregunta.includes(TIPO_DE_PREGUNTA)) {
    throw errorDeCampo(
      'contenidoId',
      'La prueba no admite selección múltiple.',
      'tipo_no_admitido',
    );
  }
  return contenido;
}

/** Valida el pedido contra el contenido y la prueba (RN-08): lanza un ErrorValidacion con su motivo. */
function validarPedido(
  datos: DatosNuevoLoteHttp,
  contenido: ContenidoParaGenerar | null,
  maximo: number,
): void {
  const valido = validarContenido(contenido);
  if (datos.cantidad > maximo) {
    throw errorDeCampo(
      'cantidad',
      `Se pueden pedir hasta ${String(maximo)} preguntas por lote.`,
      'cantidad_excedida',
    );
  }
  validarTexto(datos, valido);
}

/** HU-18: el texto de lectura solo va en la prueba que lo exige, y con preguntas para las tres habilidades. */
function validarTexto(datos: DatosNuevoLoteHttp, contenido: ContenidoParaGenerar): void {
  if (datos.conTexto && !contenido.prueba.requiereTexto) {
    throw errorDeCampo('conTexto', 'Esta prueba no lleva texto de lectura.', 'texto_no_aplica');
  }
  if (!datos.conTexto && contenido.prueba.requiereTexto) {
    throw errorDeCampo(
      'conTexto',
      `${contenido.prueba.nombre} lleva siempre un texto de lectura.`,
      'texto_obligatorio',
    );
  }
  if (datos.conTexto && datos.cantidad < MINIMO_PREGUNTAS_CON_TEXTO) {
    throw errorDeCampo(
      'cantidad',
      `Un texto de lectura necesita al menos ${String(MINIMO_PREGUNTAS_CON_TEXTO)} preguntas para cubrir las habilidades Localizar, Interpretar y Evaluar.`,
      'texto_minimo_preguntas',
    );
  }
}

async function modeloInicial(d: DependenciasProductor): Promise<string> {
  const modelo =
    d.ia.nombre === 'deepseek'
      ? await d.administracion.obtenerParametroTexto('modelo_ia')
      : d.ia.nombre;
  return modelo.slice(0, LARGO_MAXIMO_MODELO);
}

/** RNF-03: los topes diario y mensual; si ya se alcanzaron, no se pide nada a la IA. */
async function comprobarTopes(
  d: DependenciasProductor,
  cantidad: number,
  tx: Ejecutor,
): Promise<void> {
  const ahora = d.reloj();
  const maximoDiario = await d.administracion.obtenerParametroEntero('tope_diario_ia');
  const usadas = await d.lotes.usoDiario(ahora, tx);
  if (usadas + cantidad > maximoDiario) throw new ErrorTopeDiarioIa(usadas, cantidad, maximoDiario);
  const maximoMensual = await d.administracion.obtenerParametroNumero('tope_mensual_ia_usd');
  const { gastado, sinCosto } = await d.lotes.gastoMensual(ahora, tx);
  if (sinCosto) throw new ErrorPrecioIaNoConfigurado();
  if (gastado >= maximoMensual) throw new ErrorTopeMensualIa(gastado, maximoMensual);
}

export interface Productor {
  /** `creado` es falso si ya había un lote pendiente igual del mismo administrador. */
  crearLote(
    solicitanteId: string,
    datos: DatosNuevoLoteHttp,
  ): Promise<{ lote: LoteDto; creado: boolean }>;
  obtenerLote(id: string): Promise<LoteDto>;
  listarLotes(
    pagina: number,
    porPagina: number,
  ): Promise<{
    lotes: LoteDto[];
    paginacion: { pagina: number; porPagina: number; total: number };
  }>;
}

export function crearProductor(d: DependenciasProductor): Productor {
  async function crear(solicitanteId: string, datos: DatosNuevoLoteHttp) {
    const maximo = await d.administracion.obtenerParametroEntero('max_preguntas_lote');
    validarPedido(datos, await d.temario.contenidoParaGenerar(datos.contenidoId), maximo);
    return d.unidadDeTrabajo.enTransaccion(async (tx) => {
      await d.lotes.bloquearCreacion(tx);
      const existente = await d.lotes.pendienteIgual({ ...datos, solicitanteId }, tx);
      if (existente) return { lote: aLoteDto(existente), creado: false };
      await leerPrecios(d.administracion, d.ia.usa);
      await comprobarTopes(d, datos.cantidad, tx);
      const nuevo: DatosNuevoLote = {
        ...datos,
        solicitanteId,
        modelo: await modeloInicial(d),
        versionInstrucciones: VERSION_INSTRUCCIONES,
        ahora: d.reloj(),
      };
      const fila = await d.lotes.crear(nuevo, tx);
      await d.administracion.registrarAuditoria(
        {
          usuarioId: solicitanteId,
          accion: 'solicitar_lote_ia',
          entidad: 'lote_generacion',
          entidadId: fila.id,
          antes: null,
          despues: {
            ...datos,
            modelo: nuevo.modelo,
            versionInstrucciones: nuevo.versionInstrucciones,
          },
        },
        tx,
      );
      return { lote: aLoteDto(fila), creado: true };
    });
  }

  return {
    crearLote: crear,
    async obtenerLote(id) {
      const fila = await d.lotes.obtener(id);
      if (fila === null) throw new ErrorNoEncontrado('El lote no existe.');
      return aLoteDto(fila);
    },
    async listarLotes(pagina, porPagina) {
      const { filas, total } = await d.lotes.listar(porPagina, (pagina - 1) * porPagina);
      return { lotes: filas.map(aLoteDto), paginacion: { pagina, porPagina, total } };
    },
  };
}
