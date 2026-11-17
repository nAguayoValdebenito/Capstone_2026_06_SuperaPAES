-- HU-45.3 (DAS 4.3.3): la tarea horaria registra en la auditoría cada aviso de renovación que envía, para no
-- repetirlo. Ninguna persona hace esa acción, así que usuario_id admite vacío, que significa «lo hizo el
-- sistema». Las filas que ya existen no cambian. No editar este archivo después de aplicarlo: el migrador
-- valida su suma SHA-256.
ALTER TABLE contenido.auditoria ALTER COLUMN usuario_id DROP NOT NULL;

COMMENT ON TABLE contenido.auditoria IS 'Registro de las acciones relevantes hechas en la consola y de los avisos que envía el sistema.';
COMMENT ON COLUMN contenido.auditoria.usuario_id IS 'Quién hizo la acción; vacío si la hizo el sistema en una tarea periódica.';

INSERT INTO contenido.accion_auditoria (codigo, nombre) VALUES
  ('avisar_renovacion', 'Avisar una renovación anual por correo')
ON CONFLICT (codigo) DO NOTHING;
