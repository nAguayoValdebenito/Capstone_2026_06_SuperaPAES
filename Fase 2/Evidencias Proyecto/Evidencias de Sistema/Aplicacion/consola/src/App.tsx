// Raíz de la consola: estado de sesión y rutas. El enrutador lo entrega main.tsx (o la prueba).
import { ProveedorSesion } from './estado/sesion';
import { RutasConsola } from './rutas';
import type { UsuarioInterno } from './tipos';

export function App({ sesionInicial }: { sesionInicial: UsuarioInterno | null }) {
  return (
    <ProveedorSesion sesionInicial={sesionInicial}>
      <RutasConsola />
    </ProveedorSesion>
  );
}
