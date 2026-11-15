// El CSS global va primero: así los estilos propios de cada página, que se cargan con ella, pueden
// ajustarlo sin pelear por el orden. Antes van solo las fuentes (@font-face), alojadas con la consola
// para que la política de seguridad de contenido (vercel.json) no tenga que permitir otro origen.
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import '@fontsource/figtree/700.css';
import '@fontsource/figtree/800.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/stix-two-text/400.css';
import '@fontsource/stix-two-text/400-italic.css';
import '@fontsource/stix-two-text/600.css';
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
