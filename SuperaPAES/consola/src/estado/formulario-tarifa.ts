import { useState, type SubmitEvent } from 'react';
import type { NuevaTarifa, TarifaRevision } from '../tipos/saldo';

export function useFormularioTarifa(
  tarifas: TarifaRevision[],
  guardar: (datos: NuevaTarifa) => Promise<void>,
) {
  const [monto, setMonto] = useState('');
  const [desde, setDesde] = useState('');
  const [error, setError] = useState('');
  async function enviar(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault();
    const valor = Number(monto);
    const ultima = tarifas[0];
    if (!Number.isInteger(valor) || valor < 1 || valor > 700 || !ultima) {
      setError('Escribe un monto entero entre 1 y 700 pesos.');
      return;
    }
    setError('');
    await guardar({
      montoClp: valor,
      ultimaTarifaId: ultima.id,
      ...(desde ? { vigenteDesde: new Date(desde).toISOString() } : {}),
    });
  }
  return { monto, desde, error, setMonto, setDesde, enviar };
}
