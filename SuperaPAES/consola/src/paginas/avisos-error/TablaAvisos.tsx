// Bandeja de C13 (HU-50 esc. 1): una fila por pregunta con su último aviso, cuántos tiene y su estado.
// Elegir una fila (botón con el número de la pregunta) abre su detalle al lado.
import { EncabezadoTabla } from '../../componentes/EncabezadoTabla';
import type { PreguntaConAvisos } from '../../tipos/avisos-error';
import { fechaCorta } from './formato';

const COLUMNAS = ['Fecha', 'Pregunta', 'Prueba', 'Motivo', 'Avisos', 'Estado'] as const;

/** El estado de la fila: pendiente si queda alguno; si no, el del aviso más reciente. */
function estadoDeLaFila(grupo: PreguntaConAvisos) {
  if (grupo.pendientes > 0) return { codigo: 'pendiente', nombre: 'Pendiente' };
  return grupo.avisos[0]?.estado ?? { codigo: 'resuelto', nombre: 'Resuelto' };
}

function FilaAvisos({
  grupo,
  elegida,
  alElegir,
}: {
  grupo: PreguntaConAvisos;
  elegida: boolean;
  alElegir: (id: number) => void;
}) {
  const { pregunta, avisos } = grupo;
  const ultimo = avisos[0];
  const estado = estadoDeLaFila(grupo);
  return (
    <tr className={elegida ? 'fila--elegida' : undefined}>
      <td>{ultimo ? fechaCorta(ultimo.creadoEn) : ''}</td>
      <td>
        <button
          type="button"
          className="boton-texto"
          aria-pressed={elegida}
          onClick={() => alElegir(pregunta.id)}
        >
          {`P-${String(pregunta.id)}`}
        </button>
      </td>
      <td>{pregunta.prueba.codigo}</td>
      <td>{ultimo?.motivo.nombre}</td>
      <td>{avisos.length}</td>
      <td>
        <span className={`etiqueta etiqueta--${estado.codigo}`}>{estado.nombre}</span>
      </td>
    </tr>
  );
}

export function TablaAvisos({
  grupos,
  elegida,
  alElegir,
}: {
  grupos: readonly PreguntaConAvisos[];
  elegida: number | null;
  alElegir: (id: number) => void;
}) {
  return (
    <div className="tabla-desplazable" role="region" aria-label="Avisos por pregunta" tabIndex={0}>
      <table className="tabla avisos__tabla">
        <EncabezadoTabla columnas={COLUMNAS} />
        <tbody>
          {grupos.map((grupo) => (
            <FilaAvisos
              key={grupo.pregunta.id}
              grupo={grupo}
              elegida={grupo.pregunta.id === elegida}
              alElegir={alElegir}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
