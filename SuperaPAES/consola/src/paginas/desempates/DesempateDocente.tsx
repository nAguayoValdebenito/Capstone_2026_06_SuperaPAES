// D02 · Desempates (HU-23, CU-20, RF-G08, RN-11 y RN-12): la bandeja del tercer docente
// (BandejaDocente.tsx) con la pregunta que abrió, las dos revisiones de la ronda y su decisión: la
// dificultad final, aprobar, observar o rechazar, y el motivo, como acta con folio y firma (igual que
// D01). Se carga al abrir la sección (trae KaTeX).
import { type Firma, FIRMA_SIN_SESION, useFirma } from '../../estado/acta-docente';
import { type DesempateDocente, useDesempateDocente } from '../../estado/desempate-docente';
import { FolioActa } from '../revision/Acta';
import { BandejaDocente } from '../revision/BandejaDocente';
import { CamposDeDecision } from '../revision/CamposDeDecision';
import { PreguntaRevisada } from '../revision/PreguntaRevisada';
import '../revision/revision.css';
import { RevisionesDeLaRonda } from './RevisionesDeLaRonda';

const TEXTOS = { bandeja: 'Bandeja de desempates', vacia: 'No tienes desempates pendientes.' };

const DECISION = {
  dificultad: 'Dificultad final',
  ayuda: 'Tu decisión es la final: la pregunta queda aprobada, observada o rechazada.',
  boton: 'Guardar decisión',
};

/** La bandeja y el desempate abierto con su estado (exportada para las pruebas). */
export function ContenidoDesempateDocente({
  desempate,
  firma = FIRMA_SIN_SESION,
}: {
  desempate: DesempateDocente;
  firma?: Firma;
}) {
  return (
    <BandejaDocente estado={desempate} textos={TEXTOS}>
      {(pregunta) => (
        <>
          <PreguntaRevisada pregunta={pregunta} />
          <RevisionesDeLaRonda desempate={pregunta} />
          <form
            className="panel panel--ancho acta revision-acta revision-formulario"
            onSubmit={desempate.entregar}
            noValidate
          >
            <FolioActa asignacion={pregunta} tipo="desempate" />
            <CamposDeDecision
              pregunta={pregunta}
              revision={desempate}
              textos={DECISION}
              firma={firma}
            />
          </form>
        </>
      )}
    </BandejaDocente>
  );
}

export function DesempateDocentePagina() {
  return <ContenidoDesempateDocente desempate={useDesempateDocente()} firma={useFirma()} />;
}
