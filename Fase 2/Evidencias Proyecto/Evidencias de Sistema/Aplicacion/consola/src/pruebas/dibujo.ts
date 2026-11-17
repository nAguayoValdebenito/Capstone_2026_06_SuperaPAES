// El HTML de un componente como lo dibuja el servidor, sin los separadores <!-- --> que React pone
// entre textos, para comparar el texto como se lee.
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';

export const textoDibujado = (elemento: ReactElement) =>
  renderToString(elemento).replaceAll('<!-- -->', '');
