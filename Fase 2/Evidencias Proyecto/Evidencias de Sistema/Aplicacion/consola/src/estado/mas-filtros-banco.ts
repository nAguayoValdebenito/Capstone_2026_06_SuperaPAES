// «Más filtros (n)» del banco (C02): eje, contenido, habilidad, origen y dificultad asignada quedan en una
// zona plegable. Cuenta los que están activos y, si hay alguno al entrar, la zona empieza abierta.
import { useCallback, useState } from 'react';
import type { FiltrosBanco } from '../tipos';

const DENTRO: readonly (keyof FiltrosBanco)[] = [
  'eje',
  'contenido',
  'habilidad',
  'origen',
  'dificultad',
];

export const filtrosActivosDentro = (filtros: FiltrosBanco) =>
  DENTRO.filter((campo) => filtros[campo] !== undefined).length;

export function useMasFiltros(filtros: FiltrosBanco) {
  const activos = filtrosActivosDentro(filtros);
  const [abierto, setAbierto] = useState(activos > 0);
  const alternar = useCallback(() => setAbierto((actual) => !actual), []);
  return { abierto, alternar, activos };
}
