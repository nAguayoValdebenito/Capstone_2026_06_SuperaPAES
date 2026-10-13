// Definición de rutas de la consola a partir de SECCIONES. La raíz lleva al inicio de cada rol.
import { Navigate, Route, Routes } from 'react-router';
import { DisenoGeneral } from '../componentes/DisenoGeneral';
import { useSesion } from '../estado/contexto-sesion';
import { PaginaIngreso } from '../paginas/ingreso/PaginaIngreso';
import { PaginaNoEncontrada } from '../paginas/no-encontrada/PaginaNoEncontrada';
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
        <Route path="*" element={<PaginaNoEncontrada />} />
      </Route>
    </Routes>
  );
}
