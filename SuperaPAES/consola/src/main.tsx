// El CSS global va primero: así los estilos propios de cada página, que se cargan con ella, pueden
// ajustarlo sin pelear por el orden.
import './estilos/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { SESION_DESARROLLO } from './estado/contexto-sesion';
import { aplicarTemaGuardado } from './estado/tema';

aplicarTemaGuardado();

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Falta el elemento #raiz en index.html');

createRoot(raiz).render(
  <StrictMode>
    <BrowserRouter>
      <App sesionInicial={SESION_DESARROLLO} />
    </BrowserRouter>
  </StrictMode>,
);
