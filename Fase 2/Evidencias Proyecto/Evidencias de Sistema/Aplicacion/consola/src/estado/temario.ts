import { useState } from 'react';
import { consultarTemario } from '../servicios/temario';
import type { ContenidoTemarioConsulta, PruebaTemarioConsulta } from '../tipos/temario';
import { useCarga } from './carga';

export interface FiltrosTemario {
  pruebaId: number | null;
  areaId: number | null;
  texto: string;
}

export const FILTROS_TEMARIO: FiltrosTemario = { pruebaId: null, areaId: null, texto: '' };

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim();
}

function coincideContenido(c: ContenidoTemarioConsulta, texto: string): boolean {
  return normalizar([c.nombre, c.descriptores, c.area.nombre, c.curso].join(' ')).includes(texto);
}

function filtrarPrueba(prueba: PruebaTemarioConsulta, filtros: FiltrosTemario) {
  const texto = normalizar(filtros.texto);
  const coincidePrueba = normalizar(
    [
      prueba.nombre,
      prueba.codigo,
      ...prueba.habilidades.map((h) => [h.nombre, h.criterios].join(' ')),
    ].join(' '),
  ).includes(texto);
  return {
    ...prueba,
    ejes: prueba.ejes
      .map((eje) => ({
        ...eje,
        contenidos: eje.contenidos.filter(
          (c) =>
            (filtros.areaId === null || c.area.id === filtros.areaId) &&
            (coincidePrueba ||
              normalizar(eje.nombre).includes(texto) ||
              coincideContenido(c, texto)),
        ),
      }))
      .filter((eje) => eje.contenidos.length > 0 || (!filtros.areaId && !texto)),
  };
}

/** Filtra la consulta recibida; nunca modifica ni reclasifica el temario. */
export function filtrarTemario(pruebas: readonly PruebaTemarioConsulta[], filtros: FiltrosTemario) {
  const filtradas = pruebas
    .filter((p) => filtros.pruebaId === null || p.id === filtros.pruebaId)
    .map((p) => filtrarPrueba(p, filtros));
  return filtros.areaId || filtros.texto.trim()
    ? filtradas.filter((p) => p.ejes.some((e) => e.contenidos.length > 0))
    : filtradas;
}

export function contarTemario(pruebas: readonly PruebaTemarioConsulta[]) {
  return {
    pruebas: pruebas.length,
    ejes: pruebas.reduce((n, p) => n + p.ejes.length, 0),
    contenidos: pruebas.reduce(
      (n, p) => n + p.ejes.reduce((s, e) => s + e.contenidos.length, 0),
      0,
    ),
  };
}

export function useTemario() {
  const [version, setVersion] = useState(0);
  const [filtros, setFiltros] = useState(FILTROS_TEMARIO);
  const carga = useCarga(consultarTemario, version);
  return {
    carga,
    filtros,
    filtrar: (cambios: Partial<FiltrosTemario>) => setFiltros((f) => ({ ...f, ...cambios })),
    limpiar: () => setFiltros(FILTROS_TEMARIO),
    reintentar: () => setVersion((v) => v + 1),
  };
}
