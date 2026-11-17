-- HU-16.2: parámetros de la IA por proveedor. Solo agrega filas: si la clave ya existe (porque un
-- administrador la creó o la cambió) no se toca. No editar este archivo después de aplicarlo: el migrador
-- valida su suma SHA-256.
-- Los precios son dólares por millón de tokens y sirven para calcular contenido.lote_generacion.costo_usd
-- y compararlo con tope_mensual_ia_usd (RNF-03). Sin precio de un proveedor no se calcula el costo: el
-- generador no crea lotes (falla de forma segura, nunca como si costara cero).
-- DeepSeek: precio de hora punta, a propósito, para que el tope sea conservador. Gemini: pendiente de
-- confirmar en Google AI Studio.
INSERT INTO contenido.configuracion (clave, valor, descripcion, actualizado_en) VALUES
  ('temperatura_ia_deepseek', '0.7', 'Temperatura con que se pide a DeepSeek las preguntas (más alta, más variedad).', now()),
  ('temperatura_ia_gemini', '0.7', 'Temperatura con que se pide a Gemini las preguntas (más alta, más variedad).', now()),
  ('precio_entrada_ia_deepseek', '0.30', 'Dólares por millón de tokens de entrada de DeepSeek (precio de hora punta).', now()),
  ('precio_salida_ia_deepseek', '1.20', 'Dólares por millón de tokens de salida de DeepSeek (precio de hora punta).', now()),
  ('precio_entrada_ia_gemini', '0.54', 'Dólares por millón de tokens de entrada de Gemini (por confirmar en Google AI Studio).', now()),
  ('precio_salida_ia_gemini', '4.50', 'Dólares por millón de tokens de salida de Gemini (por confirmar en Google AI Studio).', now()),
  ('concurrencia_ia', '1', 'Preguntas de un lote que se piden a la IA al mismo tiempo (1 = una tras otra).', now())
ON CONFLICT (clave) DO NOTHING;
