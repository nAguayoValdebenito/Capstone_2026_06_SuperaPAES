// Esquemas zod de entrada del módulo evaluaciones. Se usan con validar() en las rutas.
import { z } from 'zod';
import { codigoConsulta, idConsulta, numeroDePagina } from '../../comun/consultas.js';
import { idDeCuerpo, idDeRuta } from '../../comun/identificadores.js';

const identificador = z.number().int().positive().max(32767);
const identificadorContenido = z.number().int().positive().max(2147483647);
export const esquemaInicioMini = z.strictObject({ pruebaId: identificador });
/** La prueba de la que se consulta la disponibilidad del diagnóstico o del mini-ensayo. */
export const esquemaDisponibilidad = z.strictObject({
  pruebaId: z.coerce.number().int().positive().max(32767),
});

export const esquemaInicioPractica = z
  .strictObject({
    pruebaId: identificador,
    ejeId: identificador.optional(),
    contenidoId: identificadorContenido.optional(),
    habilidadId: identificador.optional(),
    dificultadId: identificador.optional(),
    cantidad: z.number().int().positive(),
  })
  .superRefine((datos, contexto) => {
    if (
      [datos.ejeId, datos.contenidoId, datos.habilidadId].filter((x) => x !== undefined).length > 1
    ) {
      contexto.addIssue({
        code: 'custom',
        path: ['ejeId'],
        message: 'Elige solo un eje, contenido o habilidad.',
        params: { motivo: 'alcances_incompatibles' },
      });
    }
  });

/** HU-39.1: el repaso de una prueba o de uno de sus ejes. La cantidad la definen las falladas. */
export const esquemaInicioRepaso = z.strictObject({
  pruebaId: identificador,
  ejeId: identificador.optional(),
});

/** HU-62.1: los filtros del historial (CU-30 paso 3): prueba y tipo, opcionales, por páginas. */
export const esquemaHistorial = z.strictObject({
  pruebaId: idConsulta(32_767).optional(),
  tipo: codigoConsulta.optional(),
  grupo: z.enum(['practicas', 'evaluaciones']).optional(),
  pagina: numeroDePagina(1, 100_000),
  porPagina: numeroDePagina(20, 50),
});

export const esquemaIdPractica = z.object({ id: idDeRuta });
/** GET /evaluaciones/{id}/resultado y /revision (HU-61.1), de cualquier tipo de evaluación. */
export const esquemaIdEvaluacion = z.object({ id: idDeRuta });
/** POST /evaluaciones/{id}/items/{item}/respuesta (DAS 1.13, Figura 17). */
export const esquemaIdsItem = z.object({ id: idDeRuta, item: idDeRuta });
// No es strictObject a propósito: un campo de más (por ejemplo esCorrecta) se descarta y nunca se usa.
// La corrección la hace el servidor (RN-06).
export const esquemaRespuesta = z.object({ alternativaId: idDeCuerpo });

/** C08: la prueba cuya configuración se mira. */
export const esquemaPruebaConfiguracion = z.strictObject({
  pruebaId: z.coerce.number().int().positive().max(32767),
});

export const esquemaIdEstructura = z.object({ id: idDeRuta });

const cantidadEstructura = z.number().int().min(0).max(500);

/** CU-31 paso 3: los valores y cuántas preguntas lleva cada fila del reparto. */
export const esquemaEstructura = z.strictObject({
  cantidadMin: cantidadEstructura.min(1),
  cantidadMax: cantidadEstructura.min(1),
  noPuntuables: cantidadEstructura,
  duracionMin: z.number().int().min(1).max(600).nullable(),
  textos: z.number().int().min(1).max(50).nullable(),
  usosGratisMes: z.number().int().min(0).max(100),
  reparto: z
    .array(
      z.strictObject({
        id: identificadorContenido,
        cantidad: cantidadEstructura.min(1),
      }),
    )
    .max(50),
});

/** CU-31 paso 5: la tabla del DEMRE de una prueba, con su año y su proceso de admisión. */
export const esquemaNuevaTabla = z.strictObject({
  pruebaId: identificador,
  procesoId: identificador,
  anioAdmision: z.number().int().min(2023).max(2100),
  electivoAreaId: identificador.nullable(),
  publicadaEn: z.iso.date('La fecha de publicación no es válida.'),
  filas: z
    .array(
      z.strictObject({
        correctas: z.number().int().min(0).max(200),
        puntaje: z.number().int().min(100).max(1000),
      }),
    )
    .min(1)
    .max(201),
});

export type ConsultaPrueba = z.infer<typeof esquemaPruebaConfiguracion>;
export type DatosEstructura = z.infer<typeof esquemaEstructura>;
export type DatosTablaConversion = z.infer<typeof esquemaNuevaTabla>;
export type DatosInicioPractica = z.infer<typeof esquemaInicioPractica>;
export type DatosInicioRepaso = z.infer<typeof esquemaInicioRepaso>;
export type DatosHistorial = z.infer<typeof esquemaHistorial>;
export type DatosRespuestaPregunta = z.infer<typeof esquemaRespuesta>;
