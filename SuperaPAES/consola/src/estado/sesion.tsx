// Proveedor del estado de sesión del usuario interno: inicia y cierra la sesión, entrega el token al
// cliente de la API, lo renueva cuando vence y vuelve al ingreso si la API rechaza la sesión (401).
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { configurarAlRechazarSesion, configurarRenovacion, configurarToken } from '../api/cliente';
import { cerrar, renovar } from '../servicios/cuentas';
import type { SesionIniciada, UsuarioInterno } from '../tipos';
import { abrirSesion, borrarSesion, leerSesionGuardada, usuarioGuardado } from './almacen-sesion';
import { ContextoSesion } from './contexto-sesion';

// El token se lee del almacén en cada petición. Se configura al cargar el módulo y no en un efecto,
// porque los efectos de las páginas corren antes que los del proveedor y su primera petición
// saldría sin token.
configurarToken(() => leerSesionGuardada()?.tokenAcceso ?? null);

export function ProveedorSesion({
  sesionInicial,
  children,
}: {
  sesionInicial: UsuarioInterno | null;
  children: ReactNode;
}) {
  const [usuario, cambiarUsuario] = useState(() => usuarioGuardado() ?? sesionInicial);

  const iniciarSesion = useCallback((sesion: SesionIniciada) => {
    const nuevo = abrirSesion(sesion);
    if (nuevo) cambiarUsuario(nuevo);
    return nuevo !== null;
  }, []);

  // La API ya no acepta la sesión: basta con olvidarla en el navegador.
  const olvidarSesion = useCallback(() => {
    borrarSesion();
    cambiarUsuario(null);
  }, []);

  // Cerrar sesión (CU-03) también la cierra en la API, para que su credencial de renovación no sirva.
  const cerrarSesion = useCallback(() => {
    const guardada = leerSesionGuardada();
    olvidarSesion();
    if (guardada) cerrar(guardada.tokenRenovacion).catch(() => undefined);
  }, [olvidarSesion]);

  // El token renovado trae el rol que la cuenta tiene hoy: si cambió, el menú y las rutas se ajustan.
  const renovarSesion = useCallback(async () => {
    const guardada = leerSesionGuardada();
    if (!guardada) return false;
    const nuevo = abrirSesion(await renovar(guardada.tokenRenovacion));
    if (nuevo) cambiarUsuario(nuevo);
    return nuevo !== null;
  }, []);

  // Un 401 llega después de montar, así que basta con registrar la renovación y el cierre en un efecto.
  useEffect(() => {
    configurarRenovacion(renovarSesion);
    configurarAlRechazarSesion(olvidarSesion);
    return () => {
      configurarRenovacion(() => Promise.resolve(false));
      configurarAlRechazarSesion(() => undefined);
    };
  }, [renovarSesion, olvidarSesion]);

  const valor = useMemo(
    () => ({ usuario, iniciarSesion, cerrarSesion }),
    [usuario, iniciarSesion, cerrarSesion],
  );
  return <ContextoSesion value={valor}>{children}</ContextoSesion>;
}
