// Sección Calibración (D04): preguntas cuyo acierto no coincide con su dificultad. Llega con HU-26 y HU-53.
import { EnConstruccion } from '../../componentes/EnConstruccion';

export function PaginaCalibracion() {
  return (
    <EnConstruccion titulo="Calibración">
      <p>
        Preguntas con 30 o más intentos cuyo porcentaje de acierto no coincide con su dificultad,
        para que confirmes si la dificultad corresponde.
      </p>
    </EnConstruccion>
  );
}
