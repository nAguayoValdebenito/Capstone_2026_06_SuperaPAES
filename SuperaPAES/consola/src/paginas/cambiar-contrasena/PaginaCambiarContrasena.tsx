// Cambia tu contraseña: la consola la abre sola mientras la cuenta tenga la contraseña que le asignó el
// administrador (la API responde 403 CAMBIO_CONTRASENA_PENDIENTE a todo lo demás) y desde el menú de la
// cuenta cuando la persona quiera. Va en la hoja de acta de las páginas públicas, con los campos y los
// requisitos de Nueva contraseña (A05). Al guardar vuelve al inicio de su rol.
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import {
  type CampoConError,
  MENSAJES_CAMBIO,
  useCambiarContrasena,
  type DatosCambio,
  type EstadoCambio,
} from '../../estado/cambiar-contrasena';
import { useSesion } from '../../estado/contexto-sesion';
import { INICIO_POR_ROL } from '../../rutas/secciones';
import { HojaActa } from '../ingreso/HojaActa';
import { CampoContrasena, Requisitos } from '../restablecer-contrasena/PaginaRestablecerContrasena';

function leerDatos(formulario: HTMLFormElement): DatosCambio {
  const datos = new FormData(formulario);
  const texto = (campo: string) => {
    const valor = datos.get(campo);
    return typeof valor === 'string' ? valor : '';
  };
  return { actual: texto('actual'), nueva: texto('nueva'), repeticion: texto('repeticion') };
}

/** El error bajo su campo (`actual` o `nueva`) o, sin campo, como aviso general. */
function ErrorDe({ estado, campo }: { estado: EstadoCambio; campo: CampoConError }) {
  if (estado.tipo !== 'fallido' || estado.campo !== campo) return null;
  const clase = campo ? 'restablecer__error' : 'restablecer__aviso restablecer__aviso--error';
  return (
    <p className={clase} role="alert">
      {estado.mensaje}
    </p>
  );
}

export function FormularioCambio({
  estado,
  alEnviar,
}: {
  estado: EstadoCambio;
  alEnviar: (datos: DatosCambio) => void;
}) {
  const enviando = estado.tipo === 'enviando';
  const error = estado.tipo === 'fallido' ? estado : null;
  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    alEnviar(leerDatos(evento.currentTarget));
  };

  return (
    <form className="restablecer__formulario" onSubmit={enviar} aria-busy={enviando}>
      <CampoContrasena
        nombre="actual"
        etiqueta="Contraseña actual"
        conError={error?.campo === 'actual'}
        autocompletar="current-password"
      />
      <ErrorDe estado={estado} campo="actual" />
      <CampoContrasena
        nombre="nueva"
        etiqueta="Nueva contraseña"
        conError={error?.campo === 'nueva'}
        descripcion="requisitos-contrasena"
      />
      <CampoContrasena
        nombre="repeticion"
        etiqueta="Repite la contraseña"
        conError={error?.campo === 'nueva'}
      />
      <ErrorDe estado={estado} campo="nueva" />
      <ErrorDe estado={estado} campo={null} />
      <Requisitos />
      <button className="restablecer__boton" type="submit" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Guardar contraseña'}
      </button>
    </form>
  );
}

export function PaginaCambiarContrasena() {
  const { usuario, cambioPendiente, cerrarSesion } = useSesion();
  const { estado, enviar } = useCambiarContrasena();
  const navegar = useNavigate();

  if (!usuario) return <Navigate to="/ingreso" replace />;
  const inicio = INICIO_POR_ROL[usuario.rol];
  if (estado.tipo === 'cambiada') return <Navigate to={inicio} replace />;
  const salir = () => {
    cerrarSesion();
    void navegar('/ingreso', { replace: true });
  };

  return (
    <HojaActa clase="restablecer" subtitulo="Consola del equipo">
      <h1>Cambia tu contraseña</h1>
      <p className="restablecer__bajada">
        {cambioPendiente ? MENSAJES_CAMBIO.asignada : MENSAJES_CAMBIO.voluntaria}
      </p>
      <FormularioCambio estado={estado} alEnviar={(datos) => void enviar(datos)} />
      <p className="restablecer__pie">
        {cambioPendiente ? (
          <button className="boton-texto" type="button" onClick={salir}>
            Cerrar sesión
          </button>
        ) : (
          <Link className="boton-texto" to={inicio}>
            Volver a la consola
          </Link>
        )}
      </p>
    </HojaActa>
  );
}
