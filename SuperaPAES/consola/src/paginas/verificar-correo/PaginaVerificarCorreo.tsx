// Página pública del enlace del correo, HU-05.4 (DAS RN-32 y CU-02).
import { useSearchParams } from 'react-router';
import {
  MENSAJES_VERIFICACION,
  useVerificarCorreo,
  type EstadoVerificacion,
} from '../../estado/verificar-correo';
import './verificar-correo.css';

function IconoResultado({ exito }: { exito: boolean }) {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d={exito ? 'm8 12 3 3 5-6' : 'm9 9 6 6m0-6-6 6'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ResultadoVerificacion({
  estado,
  alReintentar,
}: {
  estado: EstadoVerificacion;
  alReintentar: () => void;
}) {
  if (estado.tipo === 'verificando') {
    return (
      <section className="verificar__resultado" role="status" aria-busy="true">
        <h1>Verificando tu correo…</h1>
        <p>Espera un momento mientras confirmamos el enlace.</p>
      </section>
    );
  }
  const exito = estado.tipo === 'verificado';
  const mensaje = exito
    ? MENSAJES_VERIFICACION[estado.yaVerificado ? 'yaVerificado' : 'exito']
    : estado.mensaje;
  return (
    <section className="verificar__resultado" role={exito ? 'status' : 'alert'}>
      <span className={`verificar__icono verificar__icono--${exito ? 'exito' : 'error'}`}>
        <IconoResultado exito={exito} />
      </span>
      <h1>{exito ? 'Correo verificado' : 'No pudimos verificar tu correo'}</h1>
      <p>{mensaje}</p>
      {!exito &&
        (estado.reintentable ? (
          <button className="verificar__boton" type="button" onClick={alReintentar}>
            Reintentar
          </button>
        ) : (
          <p className="verificar__ayuda">{MENSAJES_VERIFICACION.pedirOtro}</p>
        ))}
    </section>
  );
}

function VerificarEnlace({ token }: { token: string }) {
  const { estado, reintentar } = useVerificarCorreo(token);
  return <ResultadoVerificacion estado={estado} alReintentar={reintentar} />;
}

export function PaginaVerificarCorreo() {
  const [parametros] = useSearchParams();
  const token = parametros.get('token')?.trim() ?? '';
  return (
    <main className="verificar">
      <p className="verificar__marca">SUPERA PAES</p>
      {token ? (
        <VerificarEnlace key={token} token={token} />
      ) : (
        <ResultadoVerificacion
          estado={{
            tipo: 'fallido',
            mensaje: MENSAJES_VERIFICACION.incompleto,
            reintentable: false,
          }}
          alReintentar={() => undefined}
        />
      )}
    </main>
  );
}
