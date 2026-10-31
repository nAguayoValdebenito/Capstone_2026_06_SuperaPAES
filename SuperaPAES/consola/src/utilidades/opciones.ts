// Opciones de un selector a partir de listas del temario (por id) o de listas de opciones (por código).

export interface OpcionSelector {
  valor: string;
  texto: string;
}

export const deTemario = (items: readonly { id: number; nombre: string }[]): OpcionSelector[] =>
  items.map((item) => ({ valor: String(item.id), texto: item.nombre }));

export const deLista = (items: readonly { codigo: string; nombre: string }[]): OpcionSelector[] =>
  items.map((item) => ({ valor: item.codigo, texto: item.nombre }));

/** Del valor del selector a un id: vacío es undefined. */
export const numero = (valor: string) => (valor === '' ? undefined : Number(valor));
