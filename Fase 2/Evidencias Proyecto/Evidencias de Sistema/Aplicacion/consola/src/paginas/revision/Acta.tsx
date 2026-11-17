// El folio del acta del docente (D01 y D02): el código de la pregunta, la ronda, la fecha de asignación y la fecha límite, en
// letra de datos sobre la línea de margen (.acta). La firma va al pie, junto al botón (CamposDeDecision).
import { folioDe } from '../../estado/acta-docente';
import type { RevisionPendiente } from '../../tipos';

export function FolioActa({
  asignacion,
  tipo,
}: {
  asignacion: Pick<RevisionPendiente, 'preguntaId' | 'ronda' | 'asignadoEn' | 'venceEn'>;
  /** «revisión» en D01 y «desempate» en D02, delante del número de ronda. */
  tipo: 'revisión' | 'desempate';
}) {
  const folio = folioDe(asignacion);
  return (
    <p className="folio">
      <span>
        Acta <b>{folio.codigo}</b>
      </span>
      <span>
        {tipo === 'revisión' ? 'revisión' : 'desempate de la ronda'} <b>{folio.ronda}</b>
      </span>
      <span>
        asignada el <b>{folio.asignada}</b>
      </span>
      <span>
        vence el <b>{folio.vence}</b>
      </span>
    </p>
  );
}
