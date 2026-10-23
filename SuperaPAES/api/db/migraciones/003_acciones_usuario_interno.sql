-- Supera PAES. Datos iniciales del modelo 12.0: acciones de auditoría para editar y activar un usuario interno.
-- RF-C02 pide crear, editar, activar y desactivar usuarios internos, y RNF-08 exige que toda acción de la consola que modifica datos
-- quede en la auditoría. La lista accion_auditoria ya traía crear_usuario y desactivar_usuario; se agregan las dos que faltaban.
-- Solo agrega filas a una lista de opciones: no cambia el esquema. Se puede ejecutar más de una vez.
INSERT INTO contenido.accion_auditoria (codigo, nombre) VALUES
  ('editar_usuario', 'Editar un usuario interno'), ('activar_usuario', 'Activar un usuario interno')
ON CONFLICT (codigo) DO NOTHING;
