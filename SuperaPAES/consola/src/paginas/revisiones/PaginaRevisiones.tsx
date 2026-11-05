// C06 · Revisiones (HU-21 y HU-23): el administrador sigue cada pregunta, sus dos revisores, los desempates,
// las revisiones vencidas y las áreas sin docentes. La reasignación de las vencidas llega con HU-28.
import { Link } from 'react-router';
import { Paginacion } from '../../componentes/Paginacion';
import { Pestanas } from '../../componentes/Pestanas';
import { SegunCarga } from '../../componentes/SegunCarga';
import { useSeguimiento } from '../../estado/seguimiento';
import { totalDePaginas } from '../../servicios/paginacion';
import type { VistaSeguimiento } from '../../tipos/seguimiento';
import { avisoSinDocentes, PESTANAS } from '../../utilidades/seguimiento';
import { TablaSeguimiento } from './TablaSeguimiento';
import './revisiones.css';

function AvisosSinDocentes({ areas }: { areas: VistaSeguimiento['sinDocentes'] }) {
  if (areas.length === 0) return null;
  return (
    <div className="revisiones__avisos" role="status">
      {areas.map((area) => (
        <p key={area.area}>{avisoSinDocentes(area)}</p>
      ))}
      <p>
        Asigna el área a un docente en <Link to="/usuarios-internos">Usuarios internos</Link>.
      </p>
    </div>
  );
}

export function PaginaRevisiones() {
  const { carga, grupo, elegirGrupo, irAPagina } = useSeguimiento();
  const conteos = carga.tipo === 'lista' ? carga.datos.seguimiento.conteos : null;
  return (
    <section className="pagina pagina--ancha revisiones">
      <h1>Revisiones</h1>
      <p className="pagina__aviso">
        Cada pregunta la revisan dos docentes del área, distintos del autor y de quien pidió el
        lote.
      </p>
      <Pestanas
        etiqueta="Grupos de revisiones"
        opciones={PESTANAS.map((pestana) => ({
          valor: pestana.grupo,
          texto: conteos ? `${pestana.titulo} (${String(conteos[pestana.grupo])})` : pestana.titulo,
        }))}
        valor={grupo}
        alElegir={elegirGrupo}
      />
      <SegunCarga carga={carga} cargando="Cargando las revisiones…">
        {({ seguimiento, paginacion }) => (
          <>
            <TablaSeguimiento preguntas={seguimiento.preguntas} />
            {paginacion.total > 0 && (
              <Paginacion
                paginacion={paginacion}
                totalPaginas={totalDePaginas(paginacion)}
                alCambiar={irAPagina}
              />
            )}
            <AvisosSinDocentes areas={seguimiento.sinDocentes} />
            <p className="campo__ayuda">
              El plazo es de {seguimiento.plazoDias} días desde la asignación y se ajusta en
              Configuración.
            </p>
          </>
        )}
      </SegunCarga>
    </section>
  );
}
