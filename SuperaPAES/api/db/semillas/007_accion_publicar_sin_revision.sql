-- Acción de auditoría del modo de pruebas de preguntas (MODO_PRUEBAS_PREGUNTAS): publicar sin revisión
-- hasta 10 borradores por vez, solo para llenar la app de pruebas (RNF-08: queda en contenido.auditoria).
-- contenido.accion_auditoria es una lista de opciones: se agrega una fila, sin cambiar el esquema.
-- Idempotente: se puede ejecutar todas las veces que haga falta.
INSERT INTO contenido.accion_auditoria (codigo, nombre) VALUES
  ('publicar_sin_revision', 'Publicar una pregunta sin revisión (modo de pruebas)')
ON CONFLICT (codigo) DO NOTHING;
