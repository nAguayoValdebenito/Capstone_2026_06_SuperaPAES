// D02 · Desempates (HU-23, CU-20, RF-G08, RN-11 y RN-12): la bandeja del tercer docente
// (BandejaDocente.tsx) con la pregunta que abrió, las dos revisiones de la ronda y su decisión: la
// dificultad final, aprobar, observar o rechazar, y el motivo. Se carga al abrir la sección (trae KaTeX).
import { type DesempateDocente, useDesempateDocente } from '../../estado/desempate-docente';
import { BandejaDocente } from '../revision/BandejaDocente';
import { CamposDeDecision } from '../revision/CamposDeDecision';
import { PreguntaRevisada } from '../revision/PreguntaRevisada';
import { RevisionesDeLaRonda } from './RevisionesDeLaRonda';

const TEXTOS = { bandeja: 'Bandeja de desempates', vacia: 'No tienes desempates pendientes.' };

const DECISION = {
  dificultad: 'Dificultad final',
  ayuda: 'Tu decisión es la final: la pregunta queda aprobada, observada o rechazada.',
  boton: 'Guardar decisión',
};

/** La bandeja y el desempate abierto con su estado (exportada para las pruebas). */
export function ContenidoDesempateDocente({ desempate }: { desempate: DesempateDocente }) {
  return (
    <BandejaDocente estado={desempate} textos={TEXTOS}>
      {(pregunta) => (
        <>
          <PreguntaRevisada pregunta={pregunta} />
          <RevisionesDeLaRonda desempate={pregunta} />
          <form className="revision-formulario" onSubmit={desempate.entregar} noValidate>
            <CamposDeDecision pregunta={pregunta} revision={desempate} textos={DECISION} />
          </form>
        </>
      )}
    </BandejaDocente>
  );
}

export function DesempateDocentePagina() {
  return <ContenidoDesempateDocente desempate={useDesempateDocente()} />;
}
