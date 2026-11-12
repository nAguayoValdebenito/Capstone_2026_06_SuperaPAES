import { SegunCarga } from '../../componentes/SegunCarga';
import { useConfiguracion } from '../../estado/configuracion';
import type { ParametroConfiguracion } from '../../tipos/configuracion';
import { ConfirmarConfiguracion } from './ConfirmarConfiguracion';
import { FilaParametro } from './FilaParametro';
import { GRUPOS_CONFIGURACION } from './grupos';
import './configuracion.css';

type Estado = ReturnType<typeof useConfiguracion>;

function Grupo({
  titulo,
  parametros,
  estado,
}: {
  titulo: string;
  parametros: ParametroConfiguracion[];
  estado: Estado;
}) {
  if (parametros.length === 0) return null;
  return (
    <section className="configuracion__grupo" aria-label={titulo}>
      <h2>{titulo}</h2>
      <ul>
        {parametros.map((parametro) => (
          <FilaParametro
            key={parametro.clave}
            parametro={parametro}
            borrador={estado.borradores[parametro.clave]}
            error={estado.errores[parametro.clave]}
            guardando={estado.guardando}
            alCambiar={estado.cambiarBorrador}
            alRevisar={estado.abrirConfirmacion}
          />
        ))}
      </ul>
    </section>
  );
}

function Grupos({ parametros, estado }: { parametros: ParametroConfiguracion[]; estado: Estado }) {
  if (parametros.length === 0) return <p>No hay parámetros de configuración para mostrar.</p>;
  const asignadas = new Set<string>(GRUPOS_CONFIGURACION.flatMap((grupo) => grupo.claves));
  const otros = parametros.filter((parametro) => !asignadas.has(parametro.clave));
  return (
    <>
      {GRUPOS_CONFIGURACION.map((grupo) => (
        <Grupo
          key={grupo.titulo}
          titulo={grupo.titulo}
          parametros={parametros.filter((parametro) =>
            grupo.claves.some((clave: string) => clave === parametro.clave),
          )}
          estado={estado}
        />
      ))}
      <Grupo titulo="Otros parámetros" parametros={otros} estado={estado} />
    </>
  );
}

export function PaginaConfiguracion() {
  const estado = useConfiguracion();
  return (
    <section className="pagina pagina--ancha configuracion">
      <h1>Configuración</h1>
      <p className="pagina__aviso">
        Revisa y cambia los parámetros del sistema. Cada cambio se guarda por separado.
      </p>
      {estado.aviso && (
        <p
          className={`aviso aviso--${estado.aviso.tipo}`}
          role={estado.aviso.tipo === 'error' ? 'alert' : 'status'}
        >
          {estado.aviso.texto}
        </p>
      )}
      <div role={estado.carga.tipo === 'cargando' ? 'status' : undefined}>
        <SegunCarga carga={estado.carga} cargando="Cargando la configuración…">
          {(datos) => <Grupos parametros={datos.parametros} estado={estado} />}
        </SegunCarga>
      </div>
      {estado.carga.tipo === 'fallida' && (
        <button type="button" className="boton" onClick={estado.reintentar}>
          Reintentar
        </button>
      )}
      {estado.confirmacion && (
        <ConfirmarConfiguracion
          parametro={estado.confirmacion.parametro}
          valor={estado.confirmacion.valor}
          guardando={estado.guardando}
          alConfirmar={() => void estado.confirmarCambio()}
          alCancelar={estado.cerrarConfirmacion}
        />
      )}
    </section>
  );
}
