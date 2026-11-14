// Sección Usuarios internos (C10, HU-04, CU-23): administradores y docentes con su rol y sus áreas de
// especialidad; crear, editar, activar y desactivar. Cada cambio queda en la auditoría de la API.
// Desactivar se confirma en un diálogo, porque cierra las sesiones de esa cuenta.
import { Alerta } from '../../componentes/Alerta';
import { DialogoConfirmacion } from '../../componentes/DialogoConfirmacion';
import { useSesion } from '../../estado/contexto-sesion';
import { useUsuariosInternos } from '../../estado/usuarios-internos';
import { FormularioCuenta } from './FormularioCuenta';
import { TablaCuentas } from './TablaCuentas';

type Estado = ReturnType<typeof useUsuariosInternos>;

function DialogoDesactivar({ estado }: { estado: Estado }) {
  const cuenta = estado.porDesactivar;
  return (
    <DialogoConfirmacion
      abierto={cuenta !== null}
      titulo={`¿Desactivar a ${cuenta?.nombre ?? ''}?`}
      textoConfirmar="Desactivar"
      peligro
      alConfirmar={estado.confirmarDesactivar}
      alCancelar={estado.cancelarDesactivar}
    >
      <p>
        No podrá entrar a la consola y se cerrarán sus sesiones abiertas. Puedes volver a activarla
        cuando quieras.
      </p>
    </DialogoConfirmacion>
  );
}

function Contenido({ estado }: { estado: Estado }) {
  const { carga, panel, abrirPanel, alGuardar, alternarEstado } = estado;
  const { usuario } = useSesion();
  if (carga.tipo !== 'lista') return null;
  return (
    <>
      {panel && (
        <FormularioCuenta
          key={panel.modo === 'editar' ? panel.cuenta.id : 'nueva'}
          cuenta={panel.modo === 'editar' ? panel.cuenta : null}
          areas={carga.areas}
          alGuardar={alGuardar}
          alCancelar={() => abrirPanel(null)}
        />
      )}
      <TablaCuentas
        cuentas={carga.cuentas}
        areas={carga.areas}
        alEditar={(cuenta) => abrirPanel({ modo: 'editar', cuenta })}
        alAlternarEstado={alternarEstado}
        idPropio={usuario?.id}
        idEditando={panel?.modo === 'editar' ? panel.cuenta.id : undefined}
      />
    </>
  );
}

export function PaginaUsuariosInternos() {
  const estado = useUsuariosInternos();
  const { carga, abrirPanel, aviso } = estado;

  return (
    <section className="pagina pagina--ancha">
      <header className="pagina__encabezado">
        <div>
          <h1>Usuarios internos</h1>
          <p className="pagina__aviso">
            Cuentas del equipo (administradores y docentes) y las áreas que puede revisar cada
            docente.
          </p>
        </div>
        {carga.tipo === 'lista' && (
          <div className="pagina__acciones">
            <button
              type="button"
              className="boton boton--primario"
              onClick={() => abrirPanel({ modo: 'crear' })}
            >
              Crear usuario interno
            </button>
          </div>
        )}
      </header>
      {carga.tipo === 'cargando' && (
        <p className="cargando" aria-live="polite">
          Cargando usuarios internos…
        </p>
      )}
      {carga.tipo === 'fallida' && <Alerta texto={carga.mensaje} codigo={carga.codigo} />}
      {aviso && <Alerta texto={aviso} />}
      <Contenido estado={estado} />
      <DialogoDesactivar estado={estado} />
    </section>
  );
}
