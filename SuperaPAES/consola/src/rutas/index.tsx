// Definición de rutas de la consola a partir de SECCIONES. La raíz lleva al inicio de cada rol.
import { Navigate, Route, Routes } from 'react-router';
import { DisenoGeneral } from '../componentes/DisenoGeneral';
import { useSesion } from '../estado/contexto-sesion';
import { PaginaIngreso } from '../paginas/ingreso/PaginaIngreso';
import { PaginaInvitar } from '../paginas/invitar/PaginaInvitar';
import { PaginaNoEncontrada } from '../paginas/no-encontrada/PaginaNoEncontrada';
import { PaginaPregunta } from '../paginas/pregunta/PaginaPregunta';
import { PaginaRestablecerContrasena } from '../paginas/restablecer-contrasena/PaginaRestablecerContrasena';
import { RutaProtegida } from './RutaProtegida';
import { INICIO_POR_ROL, SECCIONES } from './secciones';

function RedirigirAlInicio() {
  const { usuario } = useSesion();
  return <Navigate to={usuario ? INICIO_POR_ROL[usuario.rol] : '/ingreso'} replace />;
}

export function RutasConsola() {
  return (
    <Routes>
      <Route path="/ingreso" element={<PaginaIngreso />} />
      {/* Pública: la abre el estudiante con el enlace del correo de recuperación (A05, HU-06). */}
      <Route path="/restablecer-contrasena" element={<PaginaRestablecerContrasena />} />
      {/* Pública: la abre el link de invitación que comparte el estudiante (W01 y W02, HU-46). */}
      <Route path="/invitar/:codigo" element={<PaginaInvitar />} />
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
        {/* C03 (HU-12.3): crear o editar una pregunta. Se abre desde el banco; no va en el menú. */}
        {['/banco/nueva', '/banco/:id'].map((ruta) => (
          <Route
            key={ruta}
            path={ruta}
            element={
              <RutaProtegida roles={['admin']}>
                <PaginaPregunta />
              </RutaProtegida>
            }
          />
        ))}
        <Route path="*" element={<PaginaNoEncontrada />} />
      </Route>
    </Routes>
  );
}
