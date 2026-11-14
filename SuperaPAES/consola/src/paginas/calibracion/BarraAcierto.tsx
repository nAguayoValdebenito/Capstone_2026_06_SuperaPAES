// El acierto de una pregunta frente al rango esperado de su dificultad (D04, RN-15): una barra con el
// rango sombreado y una marca en el valor real, siempre con el texto al lado. La barra es decorativa: el
// texto dice el valor, el rango y si cae bajo o sobre el rango.
import { posicionEnRango, textoDeAcierto } from '../../estado/calibracion';
import type { DificultadConRango } from '../../tipos/calibracion';

const acotar = (valor: number) => Math.min(100, Math.max(0, valor));

export function BarraAcierto({
  acierto,
  dificultad,
}: {
  acierto: number | null;
  dificultad: DificultadConRango;
}) {
  const texto = textoDeAcierto(acierto, dificultad);
  if (acierto === null) return <span className="tabla__secundario">{texto}</span>;
  const posicion = posicionEnRango(acierto, dificultad).replace(/ /g, '-');
  return (
    <div className="calibracion__acierto">
      <span className="calibracion__barra" aria-hidden="true">
        <span
          className="calibracion__rango"
          style={{
            left: `${String(acotar(dificultad.aciertoEsperadoMin))}%`,
            width: `${String(acotar(dificultad.aciertoEsperadoMax - dificultad.aciertoEsperadoMin))}%`,
          }}
        />
        <span
          className={`calibracion__marca calibracion__marca--${posicion}`}
          style={{ left: `${String(acotar(acierto))}%` }}
        />
      </span>
      <span className="calibracion__texto">{texto}</span>
    </div>
  );
}
