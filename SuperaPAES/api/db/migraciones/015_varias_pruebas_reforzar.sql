-- El estudiante puede marcar todas las pruebas que quiera reforzar (HU-29 esc. 4), no solo una: se quita
-- el índice único que dejaba a lo más una prueba con es_principal por estudiante.
-- Solo quita una restricción: una versión anterior de la API sigue funcionando (marca una o ninguna).
-- Se aplica después de 014_familia_sesion.sql.
-- No editar este archivo después de aplicarlo: el migrador valida su suma SHA-256.

DROP INDEX IF EXISTS app.ux_estudiante_prueba_principal;

COMMENT ON COLUMN app.estudiante_prueba.es_principal IS
  'Verdadero en cada prueba que el estudiante quiere reforzar. Puede marcar varias o ninguna.';
