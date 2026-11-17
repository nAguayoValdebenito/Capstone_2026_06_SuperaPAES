// «Ver los datos como tabla» del gráfico de C01 · Panel: si la tabla del gráfico está a la vista.
import { useCallback, useState } from 'react';

export function useVerDatosComoTabla() {
  const [abierta, setAbierta] = useState(false);
  const alternar = useCallback(() => setAbierta((actual) => !actual), []);
  return { abierta, alternar };
}
