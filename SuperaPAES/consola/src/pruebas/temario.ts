// Temario de prueba para el banco y el formulario de preguntas: M1 (4 alternativas), M2 (4 o 5, con
// suficiencia de datos) y Competencia Lectora (4, con texto de lectura).
import type { PruebaTemario } from '../tipos';

const SELECCION = { codigo: 'seleccion_multiple', nombre: 'Selección múltiple' };

/** Reglas de RN-08 de una prueba de 4 alternativas, sin textos y solo con selección múltiple. */
export const CUATRO_ALTERNATIVAS = {
  opcionesMin: 4,
  opcionesMax: 4,
  requiereTexto: false,
  tiposPregunta: [SELECCION],
};

export const M1: PruebaTemario = {
  id: 2,
  codigo: 'M1',
  nombre: 'Competencia Matemática 1',
  ...CUATRO_ALTERNATIVAS,
  ejes: [
    { id: 10, nombre: 'Números', contenidos: [{ id: 100, nombre: 'Enteros' }] },
    { id: 11, nombre: 'Álgebra', contenidos: [{ id: 110, nombre: 'Ecuaciones' }] },
  ],
  habilidades: [{ id: 30, nombre: 'Modelar' }],
};

export const M2: PruebaTemario = {
  id: 3,
  codigo: 'M2',
  nombre: 'Competencia Matemática 2',
  opcionesMin: 4,
  opcionesMax: 5,
  requiereTexto: false,
  tiposPregunta: [SELECCION, { codigo: 'suficiencia_datos', nombre: 'Suficiencia de datos' }],
  ejes: [{ id: 31, nombre: 'Números', contenidos: [{ id: 310, nombre: 'Logaritmos' }] }],
  habilidades: [{ id: 50, nombre: 'Resolver problemas' }],
};

export const CL: PruebaTemario = {
  id: 1,
  codigo: 'CL',
  nombre: 'Competencia Lectora',
  ...CUATRO_ALTERNATIVAS,
  requiereTexto: true,
  ejes: [{ id: 20, nombre: 'Localizar', contenidos: [{ id: 200, nombre: 'Información' }] }],
  habilidades: [{ id: 40, nombre: 'Interpretar' }],
};
