-- Detección del reuso del token de renovación (RNF-01). Cada inicio de sesión (ingreso o registro) abre
-- una familia; cada renovación crea la sesión siguiente en la misma familia y deja la consumida marcada
-- con la sesión que la reemplazó. Si alguien presenta otra vez un token ya reemplazado, el token se copió:
-- la API cierra todas las sesiones abiertas de esa familia, sin tocar las de otros dispositivos.
-- Las filas existentes quedan cada una en su propia familia (el valor por omisión se calcula por fila) y
-- sin reemplazo: un token rotado antes de esta migración no dispara la revocación.
-- Solo agrega columnas con valor por omisión: una versión anterior de la API sigue funcionando.
-- Se aplica después de 010_cambio_contrasena_interna.sql.
-- No editar este archivo después de aplicarlo: el migrador valida su suma SHA-256.

ALTER TABLE app.token_sesion
  ADD COLUMN familia UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN reemplazada_por BIGINT;

-- Si alguna vez se borran sesiones antiguas, la fila que apuntaba a la borrada solo pierde la referencia.
ALTER TABLE app.token_sesion ADD FOREIGN KEY (reemplazada_por) REFERENCES app.token_sesion (id) ON DELETE SET NULL;

CREATE INDEX ix_token_sesion_familia ON app.token_sesion (familia);

COMMENT ON COLUMN app.token_sesion.familia IS 'Familia de la sesión: la abre cada ingreso o registro y la heredan todas las sesiones que salen de renovarla. Al detectar el reuso de un token ya rotado se cierran las sesiones abiertas de su familia.';
COMMENT ON COLUMN app.token_sesion.reemplazada_por IS 'Sesión que la reemplazó al renovarla (revocación por rotación). NULL si sigue abierta o si se cerró por otro motivo: cierre del usuario, cambio de contraseña, desactivación, eliminación de la cuenta o reuso detectado.';
