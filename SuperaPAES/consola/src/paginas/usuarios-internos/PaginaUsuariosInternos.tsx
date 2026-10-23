// Sección Usuarios internos (C10, HU-04, CU-23): administradores y docentes con su rol y sus áreas de
// especialidad; crear, editar, activar y desactivar. Cada cambio queda en la auditoría de la API.
import { useSesion } from '../../estado/contexto-sesion';
import { useUsuariosInternos } from '../../estado/usuarios-internos';
import { FormularioCuenta } from './FormularioCuenta';
import { TablaCuentas } from './TablaCuentas';

function Alerta({ texto, codigo }: { texto: string; codigo?: string }) {
  return (
    <p className="estado__error" role="alert">
      {texto} {codigo && <span className="estado__codigo">({codigo})</span>}
    </p>
  );
}

export function PaginaUsuariosInternos() {
  const { carga, panel, abrirPanel, alGuardar, alternarEstado, aviso } = useUsuariosInternos();
  const { usuario } = useSesion();

  return (
    <section className="pagina pagina--ancha">
      <h1>Usuarios internos</h1>
      <p className="pagina__aviso">
        Cuentas del equipo (administradores y docentes) y las áreas que puede revisar cada docente.
      </p>
      {carga.tipo === 'cargando' && <p aria-live="polite">Cargando usuarios internos…</p>}
      {carga.tipo === 'fallida' && <Alerta texto={carga.mensaje} codigo={carga.codigo} />}
      {aviso && <Alerta texto={aviso} />}
      {carga.tipo === 'lista' && (
        <>
          <button
            type="button"
            className="boton boton--primario"
            onClick={() => abrirPanel({ modo: 'crear' })}
          >
            Crear usuario interno
          </button>
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
          />
        </>
      )}
    </section>
  );
}
