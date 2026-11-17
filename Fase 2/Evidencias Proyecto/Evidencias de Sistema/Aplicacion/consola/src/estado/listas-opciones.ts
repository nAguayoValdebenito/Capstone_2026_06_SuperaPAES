// C09 (HU-64.1): carga de las listas de opciones, la lista elegida, el reintento y los textos del
// comportamiento de cada tipo de evaluación.
import { useState } from 'react';
import { consultarListasOpciones } from '../servicios/temario';
import type { ListasOpciones, TipoEvaluacionLista } from '../tipos/temario';
import { useCarga } from './carga';

export type ListaOpciones = keyof ListasOpciones;

export const LISTAS_OPCIONES: readonly { valor: ListaOpciones; texto: string }[] = [
  { valor: 'dificultades', texto: 'Dificultades' },
  { valor: 'areasCarrera', texto: 'Áreas de carrera' },
  { valor: 'tiposEvaluacion', texto: 'Tipos de evaluación' },
  { valor: 'motivosAviso', texto: 'Motivos de aviso' },
  { valor: 'tiposPregunta', texto: 'Tipos de pregunta' },
  { valor: 'tiposTexto', texto: 'Tipos de texto' },
];

type Rasgo = Exclude<keyof TipoEvaluacionLista, 'codigo' | 'nombre' | 'modoArmado'>;

// Cómo se lee cada columna verdadera de contenido.tipo_evaluacion (comentarios del modelo 11.0).
const RASGOS: readonly [Rasgo, string][] = [
  ['correccionInmediata', 'Corrige al responder'],
  ['permiteCambiarRespuesta', 'Permite cambiar respuestas antes de entregar'],
  ['conTiempo', 'Con tiempo límite'],
  ['permiteElegirAlcance', 'El estudiante elige eje, contenido o habilidad'],
  ['permiteElegirDificultad', 'El estudiante elige la dificultad'],
  ['filtraPorNivel', 'Solo contenidos hasta el curso del estudiante'],
  ['entregaPuntaje', 'Entrega puntaje estimado'],
  ['unicaPorAnioEscolar', 'Una vez por prueba y año escolar'],
  ['consumeCupo', 'Descuenta cupo'],
  ['cuentaParaProgreso', 'Cuenta para el progreso'],
];

/** Lo que hace el tipo de evaluación, en el orden de las columnas del modelo. */
export function comportamientoDe(tipo: TipoEvaluacionLista): string[] {
  const textos = RASGOS.filter(([rasgo]) => tipo[rasgo]).map(([, texto]) => texto);
  return tipo.correccionInmediata ? textos : ['Corrige al entregar', ...textos];
}

export function useListasOpciones() {
  const [version, setVersion] = useState(0);
  const [lista, setLista] = useState<ListaOpciones>('dificultades');
  return {
    carga: useCarga(consultarListasOpciones, version),
    lista,
    elegir: setLista,
    reintentar: () => setVersion((v) => v + 1),
  };
}
