// C00 · Iniciar sesión en la consola (DAS 7.2). Se muestra fuera del diseño general, sin menú, en la hoja
// de acta con el logo y su nombre (DAS 7.5). Con una sesión activa lleva a la sección de entrada del rol; la sesión provisional
// de desarrollo no tiene token, así que con ella el formulario sigue disponible.
import type { FormEvent } from 'react';
import { Navigate } from 'react-router';
import { esSesionProvisional, useSesion } from '../../estado/contexto-sesion';
import { useIngreso, type EstadoIngreso } from '../../estado/ingreso';
import { INICIO_POR_ROL } from '../../rutas/secciones';
import type { Credenciales } from '../../tipos';
import { ACCESOS_DEMO, CLAVE_DEMO } from './accesos-demo';
import { HojaActa } from './HojaActa';
import './ingreso.css';

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
    <section className="ingreso__accesos" aria-label="Accesos de demostración">
      <p>Entrar a la demostración como:</p>
      <div className="ingreso__accesos-botones">
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
      </div>
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
    <form className="ingreso__caja" onSubmit={enviar} aria-busy={enviando}>
      <div>
        <h1>Iniciar sesión</h1>
        <p className="ingreso__bajada">Usa la cuenta que te creó un administrador.</p>
      </div>
      <label className="campo">
        Correo
        <input name="correo" type="email" autoComplete="username" maxLength={150} required />
      </label>
      <label className="campo">
        Contraseña
        <input name="contrasena" type="password" autoComplete="current-password" required />
      </label>
      {estado.tipo === 'fallido' && (
        <p className="campo__error" role="alert">
          {estado.mensaje}
        </p>
      )}
      <button className="boton boton--primario ingreso__entrar" type="submit" disabled={enviando}>
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
    <HojaActa clase="ingreso-hoja" subtitulo="Consola del equipo">
      <FormularioIngreso estado={estado} alEnviar={(credenciales) => void enviar(credenciales)} />
    </HojaActa>
  );
}
