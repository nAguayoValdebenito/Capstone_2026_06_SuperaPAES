-- Acciones de auditoría de los textos de lectura (HU-12.2, RNF-08).
-- RNF-08 exige que toda acción de la consola que modifica datos quede en contenido.auditoria; la
-- migración 001 trae las acciones de las preguntas, pero no las de contenido.texto_estimulo.
-- contenido.accion_auditoria es una lista de opciones: se agregan dos filas, sin cambiar el esquema.
-- Idempotente: se puede ejecutar todas las veces que haga falta.
INSERT INTO contenido.accion_auditoria (codigo, nombre) VALUES
  ('crear_texto', 'Crear un texto de lectura'),
  ('editar_texto', 'Editar un texto de lectura')
ON CONFLICT (codigo) DO NOTHING;
