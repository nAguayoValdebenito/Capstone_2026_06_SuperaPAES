// Bandeja de calibración del docente (D04, HU-26 esc. 1): cada pregunta de su área con 30 o más intentos
// y el acierto fuera de su rango, con la dificultad, el acierto (barra y texto), los intentos y el tiempo
// promedio, y las dos decisiones. La fila no dice quién decidió, solo cuántos.
import { EncabezadoTabla } from '../../componentes/EncabezadoTabla';
import { textoDeDecisiones, textoDeTiempo } from '../../estado/calibracion';
import type { ItemCalibracion } from '../../tipos/calibracion';
import { BarraAcierto } from './BarraAcierto';

const COLUMNAS = [
  'Pregunta',
  'Dificultad',
  'Acierto',
  'Intentos',
  'Tiempo promedio',
  'Decisión',
] as const;

export interface AlDecidir {
  (item: ItemCalibracion, dificultadCorresponde: boolean, boton: HTMLButtonElement): void;
}

function Fila({ item, alDecidir }: { item: ItemCalibracion; alDecidir: AlDecidir }) {
  const decisiones = textoDeDecisiones(item);
  return (
    <tr>
      <td>
        <strong>{`P-${item.preguntaId}`}</strong> {item.enunciado}
        <span className="tabla__secundario">{`${item.prueba} · ${item.contenido}`}</span>
        {decisiones && <span className="tabla__secundario">{decisiones}</span>}
      </td>
      <td>
        <span className="etiqueta">{item.dificultad.nombre}</span>
      </td>
      <td>
        <BarraAcierto acierto={item.porcentajeAcierto} dificultad={item.dificultad} />
      </td>
      <td>{item.intentos}</td>
      <td>{textoDeTiempo(item.tiempoPromedioSeg)}</td>
      <td>
        <div className="calibracion__acciones">
          <button
            type="button"
            className="boton"
            onClick={(evento) => alDecidir(item, false, evento.currentTarget)}
          >
            No corresponde
          </button>
          <button
            type="button"
            className="boton"
            onClick={(evento) => alDecidir(item, true, evento.currentTarget)}
          >
            Está bien
          </button>
        </div>
      </td>
    </tr>
  );
}

export function TablaCalibracion({
  items,
  alDecidir,
}: {
  items: readonly ItemCalibracion[];
  alDecidir: AlDecidir;
}) {
  return (
    <div
      className="tabla-desplazable"
      role="region"
      aria-label="Preguntas para calibrar"
      tabIndex={0}
    >
      <table className="tabla calibracion__tabla">
        <EncabezadoTabla columnas={COLUMNAS} />
        <tbody>
          {items.map((item) => (
            <Fila key={item.preguntaId} item={item} alDecidir={alDecidir} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
