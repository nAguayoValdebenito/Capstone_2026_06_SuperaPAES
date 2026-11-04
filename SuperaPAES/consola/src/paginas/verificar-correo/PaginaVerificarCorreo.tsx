// Verificar correo (HU-05.4, CU-02): página pública de la consola que abre el enlace del correo de
// verificación. Lee el token de /verificar-correo?token=… y verifica al abrirse, sin pedir sesión. El estudiante
// la abre en el teléfono o en un computador, así que usa el mismo diseño que Nueva contraseña (A05).
import { useSearchParams } from 'react-router';
import {
  MENSAJES_VERIFICACION,
  useVerificacionCorreo,
  type EstadoVerificacion,
} from '../../estado/verificar-correo';
import { Aviso } from '../restablecer-contrasena/PaginaRestablecerContrasena';
import '../restablecer-contrasena/restablecer-contrasena.css';

export function ResultadoVerificacion({
  estado,
  alReintentar,
}: {
  estado: EstadoVerificacion;
  alReintentar?: () => void;
}) {
  switch (estado.tipo) {
    case 'verificando':
      return <h1 role="status">Verificando tu correo…</h1>;
    case 'verificado':
      return (
        <Aviso tono="exito" titulo="Correo verificado" texto={MENSAJES_VERIFICACION.verificado} />
      );
    case 'ya_verificado':
      return (
        <Aviso
          tono="exito"
          titulo="Tu correo ya estaba verificado"
          texto={MENSAJES_VERIFICACION.yaVerificado}
        />
      );
    case 'no_vigente':
      return (
        <Aviso
          tono="error"
          titulo="Este enlace ya no sirve"
          texto={estado.mensaje}
          extra={MENSAJES_VERIFICACION.pedirOtro}
        />
      );
    case 'fallido':
      return (
        <>
          <Aviso tono="error" titulo="No pudimos verificar tu correo" texto={estado.mensaje} />
          {alReintentar && (
            <button className="restablecer__boton" type="button" onClick={alReintentar}>
              Reintentar
            </button>
          )}
        </>
      );
  }
}

function Verificacion({ token }: { token: string }) {
  const { estado, reintentar } = useVerificacionCorreo(token);
  return <ResultadoVerificacion estado={estado} alReintentar={reintentar} />;
}

export function PaginaVerificarCorreo() {
  const [parametros] = useSearchParams();
  const token = parametros.get('token')?.trim() ?? '';

  return (
    <main className="restablecer">
      {token ? (
        <Verificacion key={token} token={token} />
      ) : (
        <Aviso
          tono="error"
          titulo="Enlace incompleto"
          texto={MENSAJES_VERIFICACION.enlaceIncompleto}
          extra={MENSAJES_VERIFICACION.pedirOtro}
        />
      )}
    </main>
  );
}
