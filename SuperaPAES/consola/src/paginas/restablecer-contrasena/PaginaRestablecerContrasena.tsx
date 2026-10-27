// A05 · Nueva contraseña (DAS 7.2): página pública de la consola que abre el enlace del correo de
// recuperación (HU-06, CU-04), pensada para verse en el teléfono. Sigue su boceto en Figma, con el
// sistema de diseño de la app (estilos en restablecer-contrasena.css). Lee el token de
// /restablecer-contrasena?token=… y no inicia sesión.
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import {
  MENSAJES_RESTABLECER,
  useRestablecerContrasena,
  type EstadoRestablecer,
} from '../../estado/restablecer-contrasena';
import './restablecer-contrasena.css';

/** Requisitos de RN-31 que muestra el boceto bajo los campos. */
const REQUISITOS = [
  'De 8 a 72 caracteres',
  'No es una contraseña común, como 12345678',
  'No es igual a tu correo',
] as const;

function leerContrasenas(formulario: HTMLFormElement): [string, string] {
  const datos = new FormData(formulario);
  const texto = (campo: string) => {
    const valor = datos.get(campo);
    return typeof valor === 'string' ? valor : '';
  };
  return [texto('contrasena'), texto('repeticion')];
}

function IconoOjo({ tachado }: { tachado: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      {tachado && <path d="m4 4 16 16" stroke="currentColor" strokeWidth="1.8" />}
    </svg>
  );
}

function IconoCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m5 12.5 4.5 4.5L19 7.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconoAviso({ tono }: { tono: 'exito' | 'error' }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      {tono === 'exito' ? (
        <path d="m8 12.5 3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      ) : (
        <path d="m9 9 6 6m0-6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      )}
    </svg>
  );
}

/** Campo contraseña del sistema de diseño, con el ojo para mostrarla. */
function CampoContrasena({
  nombre,
  etiqueta,
  conError,
  descripcion,
}: {
  nombre: string;
  etiqueta: string;
  conError: boolean;
  descripcion?: string;
}) {
  const [visible, cambiarVisible] = useState(false);
  return (
    <label className="restablecer__campo">
      {etiqueta}
      <span className={`restablecer__entrada${conError ? ' restablecer__entrada--error' : ''}`}>
        <input
          name={nombre}
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          required
          aria-invalid={conError}
          aria-describedby={descripcion}
        />
        <button
          className="restablecer__ojo"
          type="button"
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          onClick={() => cambiarVisible((actual) => !actual)}
        >
          <IconoOjo tachado={visible} />
        </button>
      </span>
    </label>
  );
}

/** Requisitos de RN-31 bajo los campos, como en el boceto. */
function Requisitos() {
  return (
    <section className="restablecer__requisitos" id="requisitos-contrasena">
      <h2>Tu contraseña debe cumplir con:</h2>
      <ul>
        {REQUISITOS.map((requisito) => (
          <li key={requisito}>
            <IconoCheck />
            {requisito}
          </li>
        ))}
      </ul>
      <p className="restablecer__nota">No necesitas símbolos, mayúsculas ni números.</p>
    </section>
  );
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
    <form className="restablecer__formulario" onSubmit={enviar} aria-busy={enviando}>
      <CampoContrasena
        nombre="contrasena"
        etiqueta="Nueva contraseña"
        conError={error?.deContrasena === true}
        descripcion="requisitos-contrasena"
      />
      <CampoContrasena
        nombre="repeticion"
        etiqueta="Repite la contraseña"
        conError={error?.deContrasena === true}
      />
      {error && (
        <p
          className={
            error.deContrasena
              ? 'restablecer__error'
              : 'restablecer__aviso restablecer__aviso--error'
          }
          role="alert"
        >
          {error.mensaje}
        </p>
      )}
      <Requisitos />
      <button className="restablecer__boton" type="submit" disabled={enviando}>
        {enviando ? 'Guardando…' : 'Guardar contraseña'}
      </button>
    </form>
  );
}

/** Resultado en lugar del formulario: listo, enlace incompleto o enlace que ya no sirve. */
function Aviso({
  titulo,
  texto,
  tono,
  extra,
}: {
  titulo: string;
  texto: string;
  tono: 'exito' | 'error';
  extra?: string;
}) {
  return (
    <>
      <h1>{titulo}</h1>
      <p className={`restablecer__aviso restablecer__aviso--${tono}`} role="status">
        <IconoAviso tono={tono} />
        <span>{texto}</span>
      </p>
      {extra && <p className="restablecer__pie">{extra}</p>}
    </>
  );
}

function Contenido({ token }: { token: string }) {
  const { estado, enviar } = useRestablecerContrasena(token);

  if (estado.tipo === 'restablecida') {
    return (
      <Aviso tono="exito" titulo="Contraseña cambiada" texto={MENSAJES_RESTABLECER.restablecida} />
    );
  }
  if (estado.tipo === 'fallido' && estado.enlaceNoVigente) {
    return (
      <Aviso
        tono="error"
        titulo="Este enlace ya no sirve"
        texto={estado.mensaje}
        extra={MENSAJES_RESTABLECER.pedirOtro}
      />
    );
  }
  return (
    <>
      <h1>Crea tu nueva contraseña</h1>
      <p className="restablecer__bajada">Después podrás entrar con ella.</p>
      <FormularioRestablecer
        estado={estado}
        alEnviar={(contrasena, repeticion) => void enviar(contrasena, repeticion)}
      />
      <p className="restablecer__pie">
        Si el enlace ya se usó o venció, pide uno nuevo desde <b>¿Olvidaste tu contraseña?</b> en la
        app.
      </p>
    </>
  );
}

export function PaginaRestablecerContrasena() {
  const [parametros] = useSearchParams();
  const token = parametros.get('token')?.trim() ?? '';

  return (
    <main className="restablecer">
      {token ? (
        <Contenido token={token} />
      ) : (
        <Aviso
          tono="error"
          titulo="Enlace incompleto"
          texto={MENSAJES_RESTABLECER.enlaceIncompleto}
          extra={MENSAJES_RESTABLECER.pedirOtro}
        />
      )}
    </main>
  );
}
