// D01 · Mis revisiones (HU-22.2 y HU-22.3, CU-19, RF-G07): la bandeja del docente (BandejaDocente.tsx)
// con la pregunta que abrió, a ciegas, y el formulario de su revisión. Se carga al abrir la sección
// (trae KaTeX, como C03). Con `?asignacion=` abre esa revisión (desde Clasificar dificultad, D03).
import { useSearchParams } from 'react-router';
import {
  asignacionDeLaConsulta,
  type RevisionDocente,
  useRevisionDocente,
} from '../../estado/revision-docente';
import { BandejaDocente } from './BandejaDocente';
import { FormularioRevision } from './FormularioRevision';
import { PreguntaRevisada } from './PreguntaRevisada';

const TEXTOS = { bandeja: 'Bandeja de revisiones', vacia: 'No tienes revisiones pendientes.' };

/** La bandeja y la revisión abierta con su estado (exportada para las pruebas). */
export function ContenidoRevisionDocente({ revision }: { revision: RevisionDocente }) {
  return (
    <BandejaDocente estado={revision} textos={TEXTOS}>
      {(pregunta) => (
        <>
          <PreguntaRevisada pregunta={pregunta} />
          <FormularioRevision pregunta={pregunta} revision={revision} />
        </>
      )}
    </BandejaDocente>
  );
}

export function RevisionDocentePagina() {
  const [busqueda] = useSearchParams();
  const asignacion = asignacionDeLaConsulta(busqueda.get('asignacion'));
  return <ContenidoRevisionDocente revision={useRevisionDocente(asignacion)} />;
}
