// Panel de crear o editar una cuenta interna (C10, CU-23). Al crear, el administrador escribe la
// contraseña inicial y la entrega a la persona fuera del sistema; al editar puede asignar una nueva.
import { useFormularioCuenta } from '../../estado/formulario-cuenta';
import { ROLES_CUENTA_INTERNA, type Area, type CuentaInterna } from '../../tipos';
import { REQUISITOS_CONTRASENA } from '../../utilidades/contrasena';
import { NOMBRE_ROL } from './textos';

interface Propiedades {
  /** Cuenta que se edita, o null para crear una nueva. */
  cuenta: CuentaInterna | null;
  areas: readonly Area[];
  alGuardar: () => void;
  alCancelar: () => void;
}

type Formulario = ReturnType<typeof useFormularioCuenta>;

function MensajeError({ id, texto }: { id: string; texto: string | undefined }) {
  if (!texto) return null;
  return (
    <p id={id} className="campo__error" role="alert">
      {texto}
    </p>
  );
}

function CampoAreas({ areas, formulario }: { areas: readonly Area[]; formulario: Formulario }) {
  const { campos, errores, alternarArea } = formulario;
  return (
    <fieldset className="campo" aria-describedby="error-areas">
      <legend>Áreas de especialidad</legend>
      {areas.map((area) => (
        <label key={area.id} className="campo__opcion">
          <input
            type="checkbox"
            checked={campos.areas.includes(area.id)}
            onChange={() => alternarArea(area.id)}
          />
          {area.nombre}
        </label>
      ))}
      <MensajeError id="error-areas" texto={errores.areas} />
    </fieldset>
  );
}

function CampoContrasena({ creando, formulario }: { creando: boolean; formulario: Formulario }) {
  const { campos, errores, cambiar } = formulario;
  return (
    <label className="campo">
      {creando ? 'Contraseña inicial' : 'Contraseña nueva (opcional)'}
      <input
        type="password"
        autoComplete="new-password"
        value={campos.contrasena}
        aria-describedby="requisitos-contrasena error-contrasena"
        onChange={(e) => cambiar({ contrasena: e.target.value })}
      />
      <span id="requisitos-contrasena" className="campo__ayuda">
        {REQUISITOS_CONTRASENA} Entrégala a la persona por un medio fuera del sistema.
      </span>
      <MensajeError id="error-contrasena" texto={errores.contrasena} />
    </label>
  );
}

function CamposDatos({ creando, formulario }: { creando: boolean; formulario: Formulario }) {
  const { campos, errores, cambiar } = formulario;
  return (
    <>
      <label className="campo">
        Nombre
        <input value={campos.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} />
        <MensajeError id="error-nombre" texto={errores.nombre} />
      </label>
      <label className="campo">
        Correo
        <input
          type="email"
          value={campos.correo}
          readOnly={!creando}
          onChange={(e) => cambiar({ correo: e.target.value })}
        />
        <MensajeError id="error-correo" texto={errores.correo} />
      </label>
      <label className="campo">
        Rol
        <select
          value={campos.rol}
          onChange={(e) => cambiar({ rol: e.target.value === 'admin' ? 'admin' : 'docente' })}
        >
          {ROLES_CUENTA_INTERNA.map((rol) => (
            <option key={rol} value={rol}>
              {NOMBRE_ROL[rol]}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

export function FormularioCuenta({ cuenta, areas, alGuardar, alCancelar }: Propiedades) {
  const formulario = useFormularioCuenta(cuenta, alGuardar);
  const creando = cuenta === null;
  return (
    <form className="panel" onSubmit={formulario.enviar} noValidate aria-labelledby="titulo-panel">
      <h2 id="titulo-panel">{creando ? 'Crear usuario interno' : `Editar a ${cuenta.nombre}`}</h2>
      <MensajeError id="error-general" texto={formulario.errores.general} />
      <CamposDatos creando={creando} formulario={formulario} />
      {formulario.campos.rol === 'docente' && <CampoAreas areas={areas} formulario={formulario} />}
      <CampoContrasena creando={creando} formulario={formulario} />
      <div className="panel__acciones">
        <button type="submit" className="boton boton--primario" disabled={formulario.enviando}>
          {formulario.enviando ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" className="boton" onClick={alCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
