-- HU-16.1: reemplaza el modelo inicial retirado sin pisar la elección de un administrador.
-- La igualdad JSONB exige la cadena exacta; otras claves, valores y metadatos quedan intactos.
-- No editar este archivo después de aplicarlo: el migrador valida su suma SHA-256.
UPDATE contenido.configuracion
   SET valor = '"deepseek-flash"'::jsonb,
       descripcion = replace(descripcion, 'deepseek-chat', 'deepseek-flash'),
       actualizado_en = now()
 WHERE clave = 'modelo_ia'
   AND valor = '"deepseek-chat"'::jsonb;
