// Formulario de una estructura de C08 (CU-31 paso 3): los campos, la suma del reparto por eje mientras se
// escribe y si cuadra con la cantidad de preguntas. Si no cuadra, «Guardar estructura» queda deshabilitado
// y la suma visible explica por qué; el servidor sigue validando igual (4.a).
import { useState, type FormEvent } from 'react';
import type { EdicionEstructura, Estructura } from '../tipos/evaluaciones';
import {
  camposDe,
  edicionDe,
  sumaDelReparto,
  type CamposEstructura,
} from '../utilidades/evaluaciones';

export function useFormularioEstructura(
  estructura: Estructura,
  alGuardar: (datos: EdicionEstructura) => void,
) {
  const [campos, setCampos] = useState(() => camposDe(estructura));
  const conReparto = estructura.reparto.length > 0;
  const total = Number(campos.maximo);
  const suma = sumaDelReparto(Object.values(campos.cantidades).map(Number));
  const cuadra = !conReparto || suma === total;

  const cambiar = (cambio: Partial<CamposEstructura>) =>
    setCampos((actual) => ({ ...actual, ...cambio }));
  const cambiarCantidad = (id: number, valor: string) =>
    setCampos((actual) => ({ ...actual, cantidades: { ...actual.cantidades, [id]: valor } }));
  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    if (cuadra) alGuardar(edicionDe(estructura, campos));
  };

  return { campos, conReparto, total, suma, cuadra, cambiar, cambiarCantidad, enviar };
}
