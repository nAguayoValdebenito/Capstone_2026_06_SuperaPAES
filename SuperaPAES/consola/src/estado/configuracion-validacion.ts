/** Aviso temprano. La API vuelve a validar y decide si acepta el cambio. */
export function validarEntradaConfiguracion(
  clave: string,
  texto: string,
): { valor: number; error?: never } | { valor?: never; error: string } {
  if (!texto.trim()) return { error: 'Escribe un número válido.' };
  const normalizado = clave === 'tope_mensual_ia_usd' ? texto.replace(',', '.') : texto;
  const valor = Number(normalizado);
  if (!Number.isFinite(valor)) return { error: 'Escribe un número válido.' };
  if (clave !== 'tope_mensual_ia_usd' && !Number.isSafeInteger(valor))
    return { error: 'Escribe un número entero.' };
  const errorRango = validarRango(clave, valor);
  if (errorRango) return { error: errorRango };
  if (clave === 'tope_mensual_ia_usd' && !/^\d+(\.\d{1,2})?$/.test(String(valor)))
    return { error: 'Usa como máximo dos decimales.' };
  return { valor };
}

function validarRango(clave: string, valor: number): string | null {
  if (clave === 'umbral_eje_debil')
    return valor < 0 || valor > 100 ? 'El porcentaje debe estar entre 0 y 100.' : null;
  return valor <= 0 ? 'El valor debe ser mayor que cero.' : null;
}
