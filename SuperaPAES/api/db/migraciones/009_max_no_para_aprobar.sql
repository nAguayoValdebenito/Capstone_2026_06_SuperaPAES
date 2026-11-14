-- Revisión docente (HU-22, RF-G07, RN-11): cuántos criterios de la pauta pueden estar en «No» para que el
-- docente pueda aprobar la pregunta. Con más «No» que este máximo solo puede observarla o rechazarla.
-- Solo agrega la fila: si la clave ya existe (porque un administrador la creó o la cambió) no se toca.
-- No editar este archivo después de aplicarlo: el migrador valida su suma SHA-256.
-- 2 de 8 criterios: una observación menor no impide aprobar; tres «No» o más son demasiados.
INSERT INTO contenido.configuracion (clave, valor, descripcion, actualizado_en) VALUES
  ('max_no_para_aprobar', '2', 'Criterios de la pauta que pueden estar en «No» para que el docente pueda aprobar la pregunta; con más, solo puede observarla o rechazarla.', now())
ON CONFLICT (clave) DO NOTHING;
