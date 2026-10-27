// Datos del escenario de ids para las rutas de preguntas de la consola (HU-11 y HU-12.1).

const fecha = new Date('2026-01-01T00:00:00.000Z');

/** Banco de preguntas (HU-11): el repositorio entrega el id BIGINT como texto. */
export const paginaBanco = {
  preguntas: [
    {
      id: '84',
      resumen: 'Pregunta',
      prueba: { id: 2, codigo: 'M1', nombre: 'Matemática 1' },
      eje: { id: 3, nombre: 'Álgebra' },
      contenido: { id: 30, nombre: 'Ecuaciones' },
      estado: { codigo: 'borrador', nombre: 'Borrador' },
      origen: 'manual' as const,
      dificultadSugerida: null,
      dificultadAsignada: null,
      posibleAmbigua: false,
      actualizadoEn: fecha.toISOString(),
    },
  ],
  paginacion: { pagina: 1, porPagina: 20, total: 1 },
};
export const filtrosBanco = {
  pruebas: [
    {
      id: 2,
      codigo: 'M1',
      nombre: 'Matemática 1',
      opcionesMin: 4,
      opcionesMax: 4,
      requiereTexto: false,
      ejes: [{ id: 3, nombre: 'Álgebra', contenidos: [{ id: 30, nombre: 'Ecuaciones' }] }],
      habilidades: [{ id: 6, nombre: 'Resolver problemas' }],
      tiposPregunta: [{ codigo: 'seleccion_multiple', nombre: 'Selección múltiple' }],
    },
  ],
  estados: [{ codigo: 'borrador', nombre: 'Borrador' }],
  origenes: [{ codigo: 'manual', nombre: 'Manual' }],
  dificultades: [{ codigo: 'facil', nombre: 'Fácil' }],
};

/** Pregunta del formulario de la consola (HU-12.1): ids BIGINT como texto, como los entrega la base. */
export const preguntaParaEditar = {
  id: '84',
  pruebaId: 2,
  ejeId: 3,
  contenidoId: 30,
  habilidadId: 6,
  tipoPregunta: 'seleccion_multiple',
  dificultadSugerida: null,
  enunciado: 'Pregunta',
  explicacion: 'Explicación',
  textoEstimuloId: '12',
  ordenEnTexto: 1,
  estado: { codigo: 'borrador', nombre: 'Borrador' },
  editable: true,
  version: 1,
  origen: 'manual' as const,
  alternativas: [
    { id: '101', letra: 'A', texto: 'Primera', esCorrecta: true, explicacion: null },
    { id: '102', letra: 'B', texto: 'Segunda', esCorrecta: false, explicacion: null },
  ],
  actualizadoEn: fecha.toISOString(),
};

/** Pregunta que la consola crea o edita (HU-12.1); el servicio es falso, así que basta con el formato. */
export const cuerpoPregunta = {
  pruebaId: 2,
  contenidoId: 30,
  habilidadId: 6,
  tipoPregunta: 'seleccion_multiple',
  enunciado: 'Pregunta',
  explicacion: 'Explicación',
  alternativas: [{ letra: 'A', texto: 'Primera', esCorrecta: true }],
};
