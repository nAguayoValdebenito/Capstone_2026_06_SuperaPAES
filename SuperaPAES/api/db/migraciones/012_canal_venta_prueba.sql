-- Modo de pruebas de suscripción (MODO_PRUEBAS_SUSCRIPCION): el canal «prueba» de las suscripciones
-- simuladas que la app crea solo para ver su registro en la trazabilidad de la consola (HU-56). No es una
-- tienda: no tiene productos en contenido.plan_producto_tienda, así que la app nunca lo ofrece para comprar,
-- y una suscripción de este canal no pasa por la validación de compras, los avisos de las tiendas, el cierre
-- de canceladas ni el aviso de renovación. No registra pagos (app.pago), por lo que no suma ingresos.
-- Solo agrega la fila: si el código ya existe no se toca, y no cambia ningún otro dato.
-- No editar este archivo después de aplicarlo: el migrador valida su suma SHA-256.
INSERT INTO contenido.canal_venta (codigo, nombre) VALUES ('prueba', 'Prueba (simulada)')
ON CONFLICT (codigo) DO NOTHING;

COMMENT ON COLUMN contenido.canal_venta.codigo IS 'Código que usa el sistema: google_play, app_store o prueba (suscripción simulada del modo de pruebas, sin tienda ni cobros).';
