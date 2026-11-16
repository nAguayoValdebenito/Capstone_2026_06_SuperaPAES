-- Cambio de la contraseña asignada (correcciones de seguridad, etapa 4): cuando el administrador crea una
-- cuenta interna o le pone una contraseña nueva, esa persona debe cambiarla por una propia antes de usar
-- la consola. Agrega la marca contenido.usuario_interno.debe_cambiar_contrasena (falsa en las cuentas que
-- ya existen y en el primer administrador que crea crear-admin) y la acción de auditoría
-- cambiar_contrasena. Una versión anterior de la API sigue funcionando sobre esta base: no lee la columna.
-- No editar este archivo después de aplicarlo: el migrador valida su suma SHA-256.
ALTER TABLE contenido.usuario_interno
  ADD COLUMN debe_cambiar_contrasena BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN contenido.usuario_interno.debe_cambiar_contrasena IS 'Verdadero mientras la persona no cambie la contraseña que le asignó un administrador; hasta entonces la consola solo le deja cambiarla.';

INSERT INTO contenido.accion_auditoria (codigo, nombre) VALUES
  ('cambiar_contrasena', 'Cambiar la propia contraseña de la consola')
ON CONFLICT (codigo) DO NOTHING;
