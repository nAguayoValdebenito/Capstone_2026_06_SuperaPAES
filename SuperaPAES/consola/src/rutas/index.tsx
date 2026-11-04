// Definición de rutas de la consola a partir de SECCIONES. La raíz lleva al inicio de cada rol.
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { DisenoGeneral } from '../componentes/DisenoGeneral';
import { useSesion } from '../estado/contexto-sesion';
import { PaginaImportar } from '../paginas/importar/PaginaImportar';
import { PaginaIngreso } from '../paginas/ingreso/PaginaIngreso';
import { PaginaInvitar } from '../paginas/invitar/PaginaInvitar';
import { PaginaDocumentoLegal } from '../paginas/legales/PaginaDocumentoLegal';
import { PaginaNoEncontrada } from '../paginas/no-encontrada/PaginaNoEncontrada';
import { PaginaRestablecerContrasena } from '../paginas/restablecer-contrasena/PaginaRestablecerContrasena';
import { PaginaVerificarCorreo } from '../paginas/verificar-correo/PaginaVerificarCorreo';
import { RutaProtegida } from './RutaProtegida';
import { INICIO_POR_ROL, SECCIONES } from './secciones';

// C03 se descarga al abrirla: su vista previa trae KaTeX y sus fuentes (HU-12.4).
const PaginaPregunta = lazy(() =>
  import('../paginas/pregunta/PaginaPregunta').then((m) => ({ default: m.PaginaPregunta })),
);

// C04 (HU-13.2): importar preguntas. Se abre desde el banco y vuelve a él; no va en el menú.
const IMPORTAR = (
  <RutaProtegida roles={['admin']}>
    <PaginaImportar />
  </RutaProtegida>
);

// C03 (HU-12.3): crear o editar una pregunta. Se abre desde el banco; no va en el menú.
const PREGUNTA = (
  <RutaProtegida roles={['admin']}>
    <Suspense fallback={<p aria-live="polite">Cargando la pregunta…</p>}>
      <PaginaPregunta />
    </Suspense>
  </RutaProtegida>
);

function RedirigirAlInicio() {
  const { usuario } = useSesion();
  return <Navigate to={usuario ? INICIO_POR_ROL[usuario.rol] : '/ingreso'} replace />;
}

export function RutasConsola() {
  return (
    <Routes>
      <Route path="/ingreso" element={<PaginaIngreso />} />
      {/* Pública: confirma el enlace del correo del estudiante y lo invita a volver a la app. */}
      <Route path="/verificar-correo" element={<PaginaVerificarCorreo />} />
      {/* Pública: la abre el estudiante con el enlace del correo de recuperación (A05, HU-06). */}
      <Route path="/restablecer-contrasena" element={<PaginaRestablecerContrasena />} />
      {/* Pública: la abre el link de invitación que comparte el estudiante (W01 y W02, HU-46). */}
      <Route path="/invitar/:codigo" element={<PaginaInvitar />} />
      {/* Públicas: los textos legales vigentes, cuya dirección piden las tiendas (HU-34.4). Sin key:
          pasar de una a otra no vuelve a pedir los textos. */}
      <Route path="/terminos" element={<PaginaDocumentoLegal tipo="terminos" />} />
      <Route path="/privacidad" element={<PaginaDocumentoLegal tipo="privacidad" />} />
      <Route path="/" element={<RedirigirAlInicio />} />
      <Route element={<DisenoGeneral />}>
        {SECCIONES.map(({ ruta, roles, Pagina }) => (
          <Route
            key={ruta}
            path={ruta}
            element={
              <RutaProtegida roles={roles}>
                <Pagina />
              </RutaProtegida>
            }
          />
        ))}
        <Route path="/banco/importar" element={IMPORTAR} />
        {['/banco/nueva', '/banco/:id'].map((ruta) => (
          <Route key={ruta} path={ruta} element={PREGUNTA} />
        ))}
        <Route path="*" element={<PaginaNoEncontrada />} />
      </Route>
    </Routes>
  );
}
