// A05 · Nueva contraseña (DAS 7.2): página pública de la consola que abre el enlace del correo de
// recuperación (HU-06, CU-04), pensada para verse en el teléfono. Como el ingreso, va sin menú y con el
// logo (DAS 7.5). Lee el token de /restablecer-contrasena?token=… y no inicia sesión.
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import {
  MENSAJES_RESTABLECER,
  REQUISITOS_CONTRASENA_NUEVA,
  useRestablecerContrasena,
  type EstadoRestablecer,
} from '../../estado/restablecer-contrasena';

function leerContrasenas(formulario: HTMLFormElement): [string, string] {
  const datos = new FormData(formulario);
  const texto = (campo: string) => {
    const valor = datos.get(campo);
    return typeof valor === 'string' ? valor : '';
  };
  return [texto('contrasena'), texto('repeticion')];
}

export function FormularioRestablecer({
  estado,
  alEnviar,
}: {
  estado: EstadoRestablecer;
  alEnviar: (contrasena: string, repeticion: string) => void;
}) {
  const enviando = estado.tipo === 'enviando';
  const error = estado.tipo === 'fallido' ? estado : null;
  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    alEnviar(...leerContrasenas(evento.currentTarget));
  };

  return (
    <form className="ingreso__formulario" onSubmit={enviar} aria-busy={enviando}>
      <h1>Crea tu contraseña nueva</h1>
      <label className="campo">
        Contraseña nueva
        <input
          name="contrasena"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={error?.deContrasena === true}
          aria-describedby="requisitos-contrasena"
        />
        <span className="campo__ayuda" id="requisitos-contrasena">
          {REQUISITOS_CONTRASENA_NUEVA}
        </span>
      </label>
      <label className="campo">
        Repite la contraseña nueva
        <input name="repeticion" type="password" autoComplete="new-password" required />
      </label>
      {error && (
        <p className={error.deContrasena ? 'campo__error' : 'ingreso__error'} role="alert">
          {error.mensaje}
        </p>
      )}
      <button className="boton boton--primario" type="submit" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Guardar contraseña'}
      </button>
    </form>
  );
}

/** Mensaje en lugar del formulario: listo, enlace incompleto o enlace que ya no sirve. */
function Aviso({ titulo, texto, extra }: { titulo: string; texto: string; extra?: string }) {
  return (
    <section className="ingreso__formulario" role="status">
      <h1>{titulo}</h1>
      <p>{texto}</p>
      {extra && <p>{extra}</p>}
    </section>
  );
}

function Contenido({ token }: { token: string }) {
  const { estado, enviar } = useRestablecerContrasena(token);

  if (estado.tipo === 'restablecida') {
    return <Aviso titulo="Contraseña cambiada" texto={MENSAJES_RESTABLECER.restablecida} />;
  }
  if (estado.tipo === 'fallido' && estado.enlaceNoVigente) {
    return (
      <Aviso
        titulo="Este enlace ya no sirve"
        texto={estado.mensaje}
        extra={MENSAJES_RESTABLECER.pedirOtro}
      />
    );
  }
  return (
    <FormularioRestablecer
      estado={estado}
      alEnviar={(contrasena, repeticion) => void enviar(contrasena, repeticion)}
    />
  );
}

export function PaginaRestablecerContrasena() {
  const [parametros] = useSearchParams();
  const token = parametros.get('token')?.trim() ?? '';

  return (
    <main className="ingreso">
      <img
        className="ingreso__logo"
        src="/logo_supera_paes.png"
        alt="Supera PAES"
        width={991}
        height={823}
      />
      {token ? (
        <Contenido token={token} />
      ) : (
        <Aviso
          titulo="Enlace incompleto"
          texto={MENSAJES_RESTABLECER.enlaceIncompleto}
          extra={MENSAJES_RESTABLECER.pedirOtro}
        />
      )}
    </main>
  );
}
