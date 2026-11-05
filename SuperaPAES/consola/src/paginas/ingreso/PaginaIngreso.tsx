// C00 · Iniciar sesión en la consola (DAS 7.2). Se muestra fuera del diseño general, sin menú, con el
// logo (DAS 7.5). Con una sesión activa lleva a la sección de entrada del rol; la sesión provisional
// de desarrollo no tiene token, así que con ella el formulario sigue disponible.
import type { FormEvent } from 'react';
import { Navigate } from 'react-router';
import { esSesionProvisional, useSesion } from '../../estado/contexto-sesion';
import { useIngreso, type EstadoIngreso } from '../../estado/ingreso';
import { INICIO_POR_ROL } from '../../rutas/secciones';
import type { Credenciales } from '../../tipos';
import { ACCESOS_DEMO, CLAVE_DEMO } from './accesos-demo';

function leerCredenciales(formulario: HTMLFormElement): Credenciales {
  const datos = new FormData(formulario);
  const texto = (campo: string) => {
    const valor = datos.get(campo);
    return typeof valor === 'string' ? valor : '';
  };
  return { correo: texto('correo').trim(), contrasena: texto('contrasena') };
}

/** Solo en desarrollo: entrar a la demostración con un toque, sin escribir las credenciales. */
function AccesosDemo({
  deshabilitado,
  alElegir,
}: {
  deshabilitado: boolean;
  alElegir: (credenciales: Credenciales) => void;
}) {
  if (ACCESOS_DEMO.length === 0) return null;
  return (
    <section className="ingreso__demo" aria-label="Accesos de demostración">
      <p>Entrar a la demostración como:</p>
      {ACCESOS_DEMO.map(({ etiqueta, correo }) => (
        <button
          key={correo}
          type="button"
          className="boton"
          disabled={deshabilitado}
          onClick={() => alElegir({ correo, contrasena: CLAVE_DEMO })}
        >
          {etiqueta}
        </button>
      ))}
    </section>
  );
}

export function FormularioIngreso({
  estado,
  alEnviar,
}: {
  estado: EstadoIngreso;
  alEnviar: (credenciales: Credenciales) => void;
}) {
  const enviando = estado.tipo === 'enviando';
  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    alEnviar(leerCredenciales(evento.currentTarget));
  };

  return (
    <form className="ingreso__formulario" onSubmit={enviar} aria-busy={enviando}>
      <h1>Iniciar sesión</h1>
      <label className="campo">
        Correo
        <input name="correo" type="email" autoComplete="username" maxLength={150} required />
      </label>
      <label className="campo">
        Contraseña
        <input name="contrasena" type="password" autoComplete="current-password" required />
      </label>
      {estado.tipo === 'fallido' && (
        <p className="ingreso__error" role="alert">
          {estado.mensaje}
        </p>
      )}
      <button className="boton boton--primario" type="submit" disabled={enviando}>
        {enviando ? 'Ingresando…' : 'Ingresar'}
      </button>
      <AccesosDemo deshabilitado={enviando} alElegir={alEnviar} />
    </form>
  );
}

export function PaginaIngreso() {
  const { usuario } = useSesion();
  const { estado, enviar } = useIngreso();

  if (usuario && !esSesionProvisional(usuario)) {
    return <Navigate to={INICIO_POR_ROL[usuario.rol]} replace />;
  }

  return (
    <main className="ingreso">
      <img
        className="ingreso__logo"
        src="/logo_supera_paes.png"
        alt="Supera PAES"
        width={991}
        height={823}
      />
      <FormularioIngreso estado={estado} alEnviar={(credenciales) => void enviar(credenciales)} />
    </main>
  );
}
