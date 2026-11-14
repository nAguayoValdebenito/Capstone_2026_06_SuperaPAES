// C15 · Estudiantes: todos los estudiantes registrados, con o sin suscripción, en una tabla que se carga
// al entrar, del registro más reciente al más antiguo y paginada desde la API. El buscador es un filtro
// opcional por nombre o correo. Si no le llegó el correo de verificación, el administrador confirma la
// cuenta (HU-05 esc. 4, CU-02b). La lógica vive en estado/estudiantes.ts.
import type { FormEvent } from 'react';
import { Alerta } from '../../componentes/Alerta';
import { Paginacion } from '../../componentes/Paginacion';
import {
  conConfirmados,
  textoSinEstudiantes,
  useEstudiantes,
  type EstadoEstudiantes,
} from '../../estado/estudiantes';
import { totalDePaginas } from '../../servicios/paginacion';
import { TablaEstudiantes } from './TablaEstudiantes';
import './estudiantes.css';

function Buscador({ estado }: { estado: EstadoEstudiantes }) {
  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    estado.buscar();
  };
  return (
    <form className="filtros" onSubmit={enviar} role="search" aria-label="Filtrar estudiantes">
      <label className="campo estudiantes__buscar">
        Nombre o correo (opcional)
        <input
          type="search"
          value={estado.texto}
          onChange={(evento) => estado.escribir(evento.target.value)}
        />
      </label>
      <button type="submit" className="boton boton--primario">
        Buscar
      </button>
      {estado.filtro !== '' && (
        <button type="button" className="boton filtros__limpiar" onClick={estado.limpiar}>
          Limpiar
        </button>
      )}
    </form>
  );
}

function Listado({ estado }: { estado: EstadoEstudiantes }) {
  const { carga } = estado;
  if (carga.tipo === 'cargando') return <p aria-live="polite">Cargando estudiantes…</p>;
  if (carga.tipo === 'fallida') {
    return (
      <div className="estudiantes__error">
        <Alerta texto={carga.mensaje} codigo={carga.codigo} />
        <button type="button" className="boton" onClick={estado.reintentar}>
          Reintentar
        </button>
      </div>
    );
  }
  const { estudiantes, paginacion } = carga.datos;
  if (estudiantes.length === 0 && paginacion.total === 0) {
    return <p className="estudiantes__vacio">{textoSinEstudiantes(estado.filtro)}</p>;
  }
  return (
    <>
      <TablaEstudiantes
        estudiantes={conConfirmados(estudiantes, estado.confirmados)}
        confirmando={estado.confirmando}
        alConfirmar={(id) => void estado.confirmar(id)}
      />
      <Paginacion
        paginacion={paginacion}
        totalPaginas={totalDePaginas(paginacion)}
        alCambiar={estado.setPagina}
      />
    </>
  );
}

export function VistaEstudiantes({ estado }: { estado: EstadoEstudiantes }) {
  return (
    <section className="pagina pagina--ancha">
      <h1>Estudiantes</h1>
      <p className="pagina__aviso">
        Todos los estudiantes registrados en la app, del más reciente al más antiguo. Si a alguno no
        le llegó el correo de verificación, confirma su cuenta y su cupo diario sube a 20 preguntas.
      </p>
      <Buscador estado={estado} />
      {estado.error && <Alerta texto={estado.error} />}
      {estado.aviso && (
        <p className="estado__ok" role="status">
          {estado.aviso}
        </p>
      )}
      <Listado estado={estado} />
    </section>
  );
}

export function PaginaEstudiantes() {
  return <VistaEstudiantes estado={useEstudiantes()} />;
}
