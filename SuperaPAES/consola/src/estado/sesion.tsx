// Proveedor del estado de sesión del usuario interno: inicia y cierra la sesión, entrega el token al
// cliente de la API, lo renueva cuando vence y vuelve al ingreso si la API rechaza la sesión (401).
// También sabe si la cuenta debe cambiar la contraseña que le asignó el administrador: lo dice el
// ingreso o una respuesta 403 CAMBIO_CONTRASENA_PENDIENTE de la API.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  configurarAlExigirCambioContrasena,
  configurarAlRechazarSesion,
  configurarRenovacion,
  configurarToken,
} from '../api/cliente';
import { cerrar, renovar } from '../servicios/cuentas';
import type { SesionIniciada, UsuarioInterno } from '../tipos';
import {
  abrirSesion,
  borrarSesion,
  cambioPendienteGuardado,
  guardarCambioPendiente,
  leerSesionGuardada,
  usuarioGuardado,
} from './almacen-sesion';
import { ContextoSesion } from './contexto-sesion';

// El token se lee del almacén en cada petición. Se configura al cargar el módulo y no en un efecto,
// porque los efectos de las páginas corren antes que los del proveedor y su primera petición
// saldría sin token.
configurarToken(() => leerSesionGuardada()?.tokenAcceso ?? null);

/**
 * La marca de cambio de contraseña pendiente, en el estado y en la sesión guardada. Un 403
 * CAMBIO_CONTRASENA_PENDIENTE de la API la pone (se registra en un efecto, como el 401).
 */
function useCambioPendiente() {
  const [cambioPendiente, cambiarCambioPendiente] = useState(cambioPendienteGuardado);
  const marcarCambio = useCallback((pendiente: boolean) => {
    guardarCambioPendiente(pendiente);
    cambiarCambioPendiente(pendiente);
  }, []);
  const marcarContrasenaCambiada = useCallback(() => marcarCambio(false), [marcarCambio]);
  useEffect(() => {
    configurarAlExigirCambioContrasena(() => marcarCambio(true));
    return () => configurarAlExigirCambioContrasena(() => undefined);
  }, [marcarCambio]);
  return { cambioPendiente, cambiarCambioPendiente, marcarContrasenaCambiada };
}

export function ProveedorSesion({
  sesionInicial,
  children,
}: {
  sesionInicial: UsuarioInterno | null;
  children: ReactNode;
}) {
  const [usuario, cambiarUsuario] = useState(() => usuarioGuardado() ?? sesionInicial);
  const { cambioPendiente, cambiarCambioPendiente, marcarContrasenaCambiada } =
    useCambioPendiente();

  const iniciarSesion = useCallback(
    (sesion: SesionIniciada) => {
      const nuevo = abrirSesion(sesion);
      if (nuevo) cambiarUsuario(nuevo);
      // La marca la trae el ingreso; si no se guardó la sesión, queda la que había.
      cambiarCambioPendiente(cambioPendienteGuardado());
      return nuevo !== null;
    },
    [cambiarCambioPendiente],
  );

  // La API ya no acepta la sesión: basta con olvidarla en el navegador.
  const olvidarSesion = useCallback(() => {
    borrarSesion();
    cambiarUsuario(null);
    cambiarCambioPendiente(false);
  }, [cambiarCambioPendiente]);

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
    () => ({ usuario, iniciarSesion, cerrarSesion, cambioPendiente, marcarContrasenaCambiada }),
    [usuario, iniciarSesion, cerrarSesion, cambioPendiente, marcarContrasenaCambiada],
  );
  return <ContextoSesion value={valor}>{children}</ContextoSesion>;
}
