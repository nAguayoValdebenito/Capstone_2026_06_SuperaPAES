// Edición de la mezcla global de dificultad en C09 (D1, RN-09, HU-64): una fila por dificultad con
// mínimo, objetivo y máximo. Las reglas se avisan mientras se escribe, las mismas que revisa la API
// (mínimo ≤ objetivo ≤ máximo; objetivos suman 100; mínimos ≤ 100 ≤ máximos); la API decide al guardar.
import { useState } from 'react';
import { guardarMezclaDificultad } from '../servicios/temario';
import type { DificultadLista } from '../tipos/temario';
import { mensajeDeError } from './usuarios-internos';

export interface FilaMezcla {
  codigo: string;
  nombre: string;
  minimo: number;
  objetivo: number;
  maximo: number;
}

export type CampoMezcla = 'minimo' | 'objetivo' | 'maximo';

const suma = (filas: readonly FilaMezcla[], campo: CampoMezcla) =>
  filas.reduce((total, fila) => total + (Number.isFinite(fila[campo]) ? fila[campo] : 0), 0);

const esPorcentaje = (valor: number) => Number.isInteger(valor) && valor >= 0 && valor <= 100;

/** Los problemas de la mezcla, para mostrarlos antes de guardar; vacío si se puede guardar. */
export function problemasDeMezcla(filas: readonly FilaMezcla[]): string[] {
  const problemas: string[] = [];
  for (const fila of filas) {
    const { minimo, objetivo, maximo } = fila;
    if (![minimo, objetivo, maximo].every(esPorcentaje)) {
      problemas.push(`En «${fila.nombre}» escribe números enteros de 0 a 100.`);
    } else if (minimo > objetivo || objetivo > maximo) {
      problemas.push(
        `En «${fila.nombre}» el mínimo no puede pasar del objetivo ni este del máximo.`,
      );
    }
  }
  const objetivos = suma(filas, 'objetivo');
  if (objetivos !== 100)
    problemas.push(`Los objetivos deben sumar 100 (suman ${String(objetivos)}).`);
  if (suma(filas, 'minimo') > 100) problemas.push('Los mínimos no pueden sumar más de 100.');
  if (suma(filas, 'maximo') < 100) problemas.push('Los máximos deben sumar al menos 100.');
  return problemas;
}

const aFilas = (dificultades: readonly DificultadLista[]): FilaMezcla[] =>
  dificultades.map(({ codigo, nombre, minimo, objetivo, maximo }) => ({
    codigo,
    nombre,
    minimo,
    objetivo,
    maximo,
  }));

/** El estado de la edición: abre con los valores vigentes, valida y guarda; `alGuardar` recarga C09. */
export function useMezclaDificultad(
  dificultades: readonly DificultadLista[],
  alGuardar: () => void,
) {
  const [filas, cambiarFilas] = useState<FilaMezcla[] | null>(null);
  const [guardando, cambiarGuardando] = useState(false);
  const [error, cambiarError] = useState<string | null>(null);
  const [guardada, cambiarGuardada] = useState(false);

  const abrir = () => {
    cambiarFilas(aFilas(dificultades));
    cambiarError(null);
    cambiarGuardada(false);
  };
  const cancelar = () => cambiarFilas(null);
  const cambiar = (codigo: string, campo: CampoMezcla, valor: number) =>
    cambiarFilas((actuales) =>
      (actuales ?? []).map((fila) => (fila.codigo === codigo ? { ...fila, [campo]: valor } : fila)),
    );
  const problemas = filas ? problemasDeMezcla(filas) : [];

  const guardar = () => {
    if (!filas || problemas.length > 0) return;
    cambiarGuardando(true);
    cambiarError(null);
    guardarMezclaDificultad(
      filas.map(({ codigo, minimo, objetivo, maximo }) => ({ codigo, minimo, objetivo, maximo })),
    )
      .then(
        () => {
          cambiarFilas(null);
          cambiarGuardada(true);
          alGuardar();
        },
        (problema: unknown) => cambiarError(mensajeDeError(problema).mensaje),
      )
      .finally(() => cambiarGuardando(false));
  };

  return { filas, problemas, guardando, error, guardada, abrir, cancelar, cambiar, guardar };
}

export type EdicionMezcla = ReturnType<typeof useMezclaDificultad>;
export { suma as sumaDeMezcla };
