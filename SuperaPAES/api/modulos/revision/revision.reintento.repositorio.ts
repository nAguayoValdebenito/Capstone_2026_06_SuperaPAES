import type { Ejecutor } from '../../db/transaccion.js';

export function crearReintentoRepositorio() {
  return {
    async rondasListas(tx: Ejecutor): Promise<string[]> {
      await tx.query('SELECT pg_advisory_xact_lock(6971)');
      const { rows } = await tx.query<{ id: string }>(`
        SELECT p.id::text FROM contenido.pregunta p
          JOIN contenido.estado_pregunta e ON e.id=p.estado_pregunta_id AND e.codigo='en_revision'
         WHERE (SELECT count(*) FROM contenido.asignacion_revision a
                  JOIN contenido.revision r ON r.asignacion_id=a.id
                  JOIN contenido.rol_revision rr ON rr.id=a.rol_revision_id AND rr.codigo='revisor'
                 WHERE a.pregunta_id=p.id AND a.ronda=p.ronda_actual) >= 2
           AND NOT EXISTS (SELECT 1 FROM contenido.asignacion_revision a
                  JOIN contenido.rol_revision rr ON rr.id=a.rol_revision_id AND rr.codigo='desempate'
                 WHERE a.pregunta_id=p.id AND a.ronda=p.ronda_actual)
         ORDER BY p.id LIMIT 100`);
      return rows.map(({ id }) => id);
    },
  };
}
