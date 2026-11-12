// Tablas de C09 (HU-64.1): cada lista con su código, su nombre y sus datos propios, sin edición.
import { EncabezadoTabla } from '../../componentes/EncabezadoTabla';
import { comportamientoDe } from '../../estado/listas-opciones';
import type {
  AreaCarreraLista,
  DificultadLista,
  OpcionLista,
  TipoEvaluacionLista,
} from '../../tipos/temario';

const porcentaje = (valor: number) => `${valor} %`;

function Estado({ activa }: { activa: boolean }) {
  return (
    <span className={`etiqueta${activa ? ' etiqueta--activa' : ''}`}>
      {activa ? 'Activa' : 'Inactiva'}
    </span>
  );
}

function Vacia({ texto }: { texto: string }) {
  return (
    <p role="status" className="listas-opciones__vacia">
      {texto}
    </p>
  );
}

export function TablaDificultades({ dificultades }: { dificultades: readonly DificultadLista[] }) {
  if (dificultades.length === 0) return <Vacia texto="No hay dificultades cargadas." />;
  return (
    <div className="tabla-desplazable">
      <table className="tabla listas-opciones__tabla">
        <caption>Mezcla global de dificultad (RN-09)</caption>
        <EncabezadoTabla columnas={['Código', 'Nombre', 'Mínimo', 'Objetivo', 'Máximo']} />
        <tbody>
          {dificultades.map((d) => (
            <tr key={d.codigo}>
              <td>
                <code>{d.codigo}</code>
              </td>
              <td>{d.nombre}</td>
              <td className="listas-opciones__numero">{porcentaje(d.minimo)}</td>
              <td className="listas-opciones__numero">{porcentaje(d.objetivo)}</td>
              <td className="listas-opciones__numero">{porcentaje(d.maximo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TablaAreasCarrera({ areas }: { areas: readonly AreaCarreraLista[] }) {
  if (areas.length === 0) return <Vacia texto="No hay áreas de carrera cargadas." />;
  return (
    <div className="tabla-desplazable">
      <table className="tabla listas-opciones__tabla">
        <caption>Áreas de carrera con las pruebas y el electivo que sugieren (RN-25)</caption>
        <EncabezadoTabla
          columnas={['Código', 'Nombre', 'Pruebas sugeridas', 'Electivo sugerido', 'Estado']}
        />
        <tbody>
          {areas.map((a) => (
            <tr key={a.codigo}>
              <td>
                <code>{a.codigo}</code>
              </td>
              <td>{a.nombre}</td>
              <td>
                {a.pruebas.length > 0
                  ? a.pruebas.map((p) => p.nombre).join(', ')
                  : 'Sin pruebas sugeridas'}
              </td>
              <td>{a.electivo ?? 'Sin electivo'}</td>
              <td>
                <Estado activa={a.activa} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TablaTiposEvaluacion({ tipos }: { tipos: readonly TipoEvaluacionLista[] }) {
  if (tipos.length === 0) return <Vacia texto="No hay tipos de evaluación cargados." />;
  return (
    <div className="tabla-desplazable">
      <table className="tabla listas-opciones__tabla">
        <caption>Tipos de evaluación con cómo se arman y cómo funcionan</caption>
        <EncabezadoTabla columnas={['Código', 'Nombre', 'Modo de armado', 'Comportamiento']} />
        <tbody>
          {tipos.map((t) => (
            <tr key={t.codigo}>
              <td>
                <code>{t.codigo}</code>
              </td>
              <td>{t.nombre}</td>
              <td>{t.modoArmado}</td>
              <td>
                <ul className="listas-opciones__rasgos">
                  {comportamientoDe(t).map((texto) => (
                    <li key={texto}>{texto}</li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Lista con código, nombre y estado: motivos de aviso, tipos de pregunta y tipos de texto. */
export function TablaOpciones({
  titulo,
  vacia,
  opciones,
}: {
  titulo: string;
  vacia: string;
  opciones: readonly OpcionLista[];
}) {
  if (opciones.length === 0) return <Vacia texto={vacia} />;
  return (
    <div className="tabla-desplazable">
      <table className="tabla listas-opciones__tabla">
        <caption>{titulo}</caption>
        <EncabezadoTabla columnas={['Código', 'Nombre', 'Estado']} />
        <tbody>
          {opciones.map((o) => (
            <tr key={o.codigo}>
              <td>
                <code>{o.codigo}</code>
              </td>
              <td>{o.nombre}</td>
              <td>
                <Estado activa={o.activa} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
