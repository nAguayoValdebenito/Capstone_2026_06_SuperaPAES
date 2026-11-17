// El cambio de una cifra del Panel frente a su comparación (C01): una pastilla con el signo y la flecha, para
// que no dependa solo del color (sube bien en verde, baja mal en granate), y el texto completo para el
// lector de pantalla. Todas las cifras del Panel son mejores cuanto más suben.
import type { Variacion } from '../../utilidades/panel';

const FLECHA: Record<Variacion['direccion'], string> = { sube: '▲', baja: '▼', igual: '–' };
const SENTIDO: Record<Variacion['direccion'], string> = {
  sube: 'sube',
  baja: 'baja',
  igual: 'sin cambio',
};

export function CambioDeCifra({
  variacion,
  frente,
}: {
  variacion: Variacion | null;
  /** Con qué se compara: «al período anterior» o «al inicio del período». */
  frente: string;
}) {
  if (!variacion) return null;
  return (
    <span className={`variacion variacion--${variacion.direccion}`}>
      <span aria-hidden="true">
        {FLECHA[variacion.direccion]} {variacion.texto}
      </span>
      <span className="oculto-visual">
        {variacion.direccion === 'igual'
          ? `Sin cambio frente ${frente}`
          : `${SENTIDO[variacion.direccion]} ${variacion.texto} frente ${frente}`}
      </span>
    </span>
  );
}
