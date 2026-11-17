-- Acciones de auditoría de la gestión de usuarios internos (HU-04, RF-C02, RNF-08).
-- La migración 001 trae crear_usuario y desactivar_usuario; RF-C02 también pide editar y activar, y
-- RNF-08 exige que toda acción de la consola que modifica datos quede en contenido.auditoria.
-- contenido.accion_auditoria es una lista de opciones: se agregan dos filas, sin cambiar el esquema.
-- Idempotente: se puede ejecutar todas las veces que haga falta.
INSERT INTO contenido.accion_auditoria (codigo, nombre) VALUES
  ('editar_usuario', 'Editar un usuario interno'),
  ('activar_usuario', 'Activar un usuario interno')
ON CONFLICT (codigo) DO NOTHING;
