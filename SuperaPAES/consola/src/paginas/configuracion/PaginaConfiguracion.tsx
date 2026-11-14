import { EstadoVacio } from '../../componentes/EstadoVacio';
import { SegunCarga } from '../../componentes/SegunCarga';
import { useConfiguracion } from '../../estado/configuracion';
import type { ParametroConfiguracion } from '../../tipos/configuracion';
import { ConfirmarConfiguracion } from './ConfirmarConfiguracion';
import { FilaParametro } from './FilaParametro';
import { GRUPOS_CONFIGURACION } from './grupos';
import './configuracion.css';

type Estado = ReturnType<typeof useConfiguracion>;

/** El ancla de un grupo, para el índice de arriba. */
function idDeGrupo(titulo: string): string {
  return `grupo-${titulo
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')}`;
}

function Indice({ titulos }: { titulos: string[] }) {
  return (
    <nav className="configuracion__indice" aria-label="Grupos de parámetros">
      {titulos.map((titulo) => (
        <a key={titulo} href={`#${idDeGrupo(titulo)}`}>
          {titulo}
        </a>
      ))}
    </nav>
  );
}

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
    <section className="configuracion__grupo" aria-label={titulo} id={idDeGrupo(titulo)}>
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
  if (parametros.length === 0)
    return <EstadoVacio titulo="No hay parámetros de configuración para mostrar." />;
  const asignadas = new Set<string>(GRUPOS_CONFIGURACION.flatMap((grupo) => grupo.claves));
  const otros = parametros.filter((parametro) => !asignadas.has(parametro.clave));
  const conParametros = GRUPOS_CONFIGURACION.filter((grupo) =>
    parametros.some((parametro) => grupo.claves.some((clave: string) => clave === parametro.clave)),
  ).map((grupo) => grupo.titulo);
  return (
    <>
      <Indice titulos={otros.length > 0 ? [...conParametros, 'Otros parámetros'] : conParametros} />
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
