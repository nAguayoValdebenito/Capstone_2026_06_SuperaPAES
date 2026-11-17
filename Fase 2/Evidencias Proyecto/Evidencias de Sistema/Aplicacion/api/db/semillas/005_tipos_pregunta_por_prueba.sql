-- Tipos de pregunta que admite cada prueba (HU-12, RF-G02).
-- contenido.pregunta tiene una clave foránea a contenido.prueba_tipo_pregunta: sin estas filas no se
-- guarda ninguna pregunta. La regla es la del comentario de la tabla y la de db/pruebas/modelo_bd.sql:
-- selección múltiple en todas las pruebas; suficiencia de datos solo en M2.
-- Necesita el temario (001): sin pruebas no inserta nada. Idempotente: no repite ni borra filas.
INSERT INTO contenido.prueba_tipo_pregunta (prueba_id, tipo_pregunta_id)
SELECT p.id, t.id
  FROM contenido.prueba p
  JOIN contenido.tipo_pregunta t ON t.codigo = 'seleccion_multiple' OR (t.codigo = 'suficiencia_datos' AND p.codigo = 'M2')
ON CONFLICT DO NOTHING;
