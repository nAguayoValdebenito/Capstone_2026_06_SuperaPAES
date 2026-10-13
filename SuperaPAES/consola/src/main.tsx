import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { SESION_DESARROLLO } from './estado/contexto-sesion';
import './estilos/global.css';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Falta el elemento #raiz en index.html');

createRoot(raiz).render(
  <StrictMode>
    <BrowserRouter>
      <App sesionInicial={SESION_DESARROLLO} />
    </BrowserRouter>
  </StrictMode>,
);
