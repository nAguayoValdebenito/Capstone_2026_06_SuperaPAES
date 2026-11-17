-- Supera PAES. Semilla del temario PAES Regular, Admisión 2027 (DEMRE), versión 1.1
-- Carga áreas de especialidad, pruebas, habilidades, ejes temáticos y contenidos con el curso en que se enseña cada uno.
-- Requiere el esquema del modelo de datos versión 10.0. Es idempotente: se puede ejecutar varias veces;
-- actualiza lo que cambió y nunca borra filas (las preguntas ya clasificadas se mantienen).
-- Fuente: DEMRE, Temarios PAES Regular, Admisión 2027 (aplicación fines de 2026).

BEGIN;

-- Áreas de especialidad de los docentes
INSERT INTO contenido.area (nombre) VALUES
  ('Lenguaje'),
  ('Matemática'),
  ('Historia'),
  ('Biología'),
  ('Física'),
  ('Química')
ON CONFLICT (nombre) DO NOTHING;

-- Pruebas (M2 incluye los contenidos de M1, sin duplicarlos)
INSERT INTO contenido.prueba (codigo, nombre, total_preguntas, preguntas_puntuables, opciones_min, opciones_max, duracion_min, textos) VALUES ('CL', 'Competencia Lectora', 65, 60, 4, 4, 150, 7)
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, total_preguntas = EXCLUDED.total_preguntas, preguntas_puntuables = EXCLUDED.preguntas_puntuables, opciones_min = EXCLUDED.opciones_min, opciones_max = EXCLUDED.opciones_max, duracion_min = EXCLUDED.duracion_min, textos = EXCLUDED.textos;
INSERT INTO contenido.prueba (codigo, nombre, total_preguntas, preguntas_puntuables, opciones_min, opciones_max, duracion_min, textos) VALUES ('M1', 'Competencia Matemática 1', 65, 60, 4, 4, 140, NULL)
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, total_preguntas = EXCLUDED.total_preguntas, preguntas_puntuables = EXCLUDED.preguntas_puntuables, opciones_min = EXCLUDED.opciones_min, opciones_max = EXCLUDED.opciones_max, duracion_min = EXCLUDED.duracion_min, textos = EXCLUDED.textos;
INSERT INTO contenido.prueba (codigo, nombre, total_preguntas, preguntas_puntuables, opciones_min, opciones_max, duracion_min, textos) VALUES ('M2', 'Competencia Matemática 2', 55, 50, 4, 5, 140, NULL)
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, total_preguntas = EXCLUDED.total_preguntas, preguntas_puntuables = EXCLUDED.preguntas_puntuables, opciones_min = EXCLUDED.opciones_min, opciones_max = EXCLUDED.opciones_max, duracion_min = EXCLUDED.duracion_min, textos = EXCLUDED.textos;
INSERT INTO contenido.prueba (codigo, nombre, total_preguntas, preguntas_puntuables, opciones_min, opciones_max, duracion_min, textos) VALUES ('HCS', 'Historia y Ciencias Sociales', 65, 60, 4, 4, 120, NULL)
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, total_preguntas = EXCLUDED.total_preguntas, preguntas_puntuables = EXCLUDED.preguntas_puntuables, opciones_min = EXCLUDED.opciones_min, opciones_max = EXCLUDED.opciones_max, duracion_min = EXCLUDED.duracion_min, textos = EXCLUDED.textos;
INSERT INTO contenido.prueba (codigo, nombre, total_preguntas, preguntas_puntuables, opciones_min, opciones_max, duracion_min, textos) VALUES ('CIE', 'Ciencias', 80, 75, 4, 5, 160, NULL)
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, total_preguntas = EXCLUDED.total_preguntas, preguntas_puntuables = EXCLUDED.preguntas_puntuables, opciones_min = EXCLUDED.opciones_min, opciones_max = EXCLUDED.opciones_max, duracion_min = EXCLUDED.duracion_min, textos = EXCLUDED.textos;
UPDATE contenido.prueba SET incluye_prueba_id = (SELECT id FROM contenido.prueba WHERE codigo = 'M1') WHERE codigo = 'M2';

-- Habilidades de cada prueba con sus criterios (o tareas lectoras en Competencia Lectora)
INSERT INTO contenido.habilidad (prueba_id, codigo, nombre, criterios) SELECT id, 'LOC', 'Localizar', 'a. Extraer información explícita del texto.
b. Identificar información explícita formulada a través de sinónimos y de paráfrasis.' FROM contenido.prueba WHERE codigo = 'CL'
ON CONFLICT (prueba_id, codigo) DO UPDATE SET nombre = EXCLUDED.nombre, criterios = EXCLUDED.criterios;
INSERT INTO contenido.habilidad (prueba_id, codigo, nombre, criterios) SELECT id, 'INT', 'Interpretar', 'c. Establecer la relación (problema/solución, categoría/ejemplo, causa/consecuencia, etc.) entre distintas partes o entre distintas informaciones de un texto.
d. Elaborar inferencias sobre el significado local y global del texto a partir de marcas textuales.
e. Determinar el significado de una parte, párrafo, sección o de la globalidad del texto.
f. Sintetizar las ideas centrales de una sección o del texto.
g. Identificar la jerarquía de las ideas de una parte del texto.
h. Reconocer la función de un elemento textual (ejemplos, citas, figuras retóricas, etc.).' FROM contenido.prueba WHERE codigo = 'CL'
ON CONFLICT (prueba_id, codigo) DO UPDATE SET nombre = EXCLUDED.nombre, criterios = EXCLUDED.criterios;
INSERT INTO contenido.habilidad (prueba_id, codigo, nombre, criterios) SELECT id, 'EVA', 'Evaluar', 'i. Determinar la intención comunicativa del emisor(a) o narrador(a) en función del destinatario.
j. Juzgar la información presente en el texto (como la calidad, pertinencia, suficiencia o consistencia).
k. Juzgar la forma en relación con la información del texto (como el registro, estructura, propósito, pertinencia o calidad).
l. Calificar la posición, actitud o tono del emisor(a) o narrador(a) respecto de un elemento, idea o del texto completo.
m. Valorar la pertinencia de los recursos lingüísticos y no lingüísticos (imagen, color, tipografía, disposición gráfica).
n. Valorar la información textual en relación con nuevos contextos.' FROM contenido.prueba WHERE codigo = 'CL'
ON CONFLICT (prueba_id, codigo) DO UPDATE SET nombre = EXCLUDED.nombre, criterios = EXCLUDED.criterios;
INSERT INTO contenido.habilidad (prueba_id, codigo, nombre, criterios) SELECT id, 'RP', 'Resolver problemas', 'Resuelve situaciones rutinarias que requieren la utilización de operatoria o procedimientos básicos.
Resuelve situaciones problemáticas que requieren la utilización de estrategias para su resolución.
Evalúa la validez del resultado derivado de un problema.' FROM contenido.prueba WHERE codigo = 'M1'
ON CONFLICT (prueba_id, codigo) DO UPDATE SET nombre = EXCLUDED.nombre, criterios = EXCLUDED.criterios;
INSERT INTO contenido.habilidad (prueba_id, codigo, nombre, criterios) SELECT id, 'MOD', 'Modelar', 'Usa modelos matemáticos en una situación planteada.
Interpreta los parámetros y supuestos de un modelo matemático.
Ajusta modelos matemáticos de acuerdo con una situación planteada.
Evalúa modelos matemáticos de acuerdo con una situación planteada.' FROM contenido.prueba WHERE codigo = 'M1'
ON CONFLICT (prueba_id, codigo) DO UPDATE SET nombre = EXCLUDED.nombre, criterios = EXCLUDED.criterios;
INSERT INTO contenido.habilidad (prueba_id, codigo, nombre, criterios) SELECT id, 'REP', 'Representar', 'Traduce del lenguaje natural al lenguaje matemático y viceversa.
Interpreta información de diferentes tipos de representaciones de acuerdo con una situación planteada.
Transfiere una situación de un sistema de representación a otro.' FROM contenido.prueba WHERE codigo = 'M1'
ON CONFLICT (prueba_id, codigo) DO UPDATE SET nombre = EXCLUDED.nombre, criterios = EXCLUDED.criterios;
INSERT INTO contenido.habilidad (prueba_id, codigo, nombre, criterios) SELECT id, 'ARG', 'Argumentar', 'Evalúa la validez de argumentos propuestos en diversos contextos.
Identifica la existencia de errores en procedimientos o demostraciones matemáticas.
Evalúa la validez de una deducción, reconociendo si una afirmación se puede concluir de otras afirmaciones.' FROM contenido.prueba WHERE codigo = 'M1'
ON CONFLICT (prueba_id, codigo) DO UPDATE SET nombre = EXCLUDED.nombre, criterios = EXCLUDED.criterios;
INSERT INTO contenido.habilidad (prueba_id, codigo, nombre, criterios) SELECT id, 'RP', 'Resolver problemas', 'Resuelve situaciones rutinarias que requieren la utilización de operatoria o procedimientos básicos.
Resuelve situaciones problemáticas que requieren la utilización de estrategias para su resolución.
Evalúa la validez del resultado derivado de un problema.' FROM contenido.prueba WHERE codigo = 'M2'
ON CONFLICT (prueba_id, codigo) DO UPDATE SET nombre = EXCLUDED.nombre, criterios = EXCLUDED.criterios;
INSERT INTO contenido.habilidad (prueba_id, codigo, nombre, criterios) SELECT id, 'MOD', 'Modelar', 'Usa modelos matemáticos en una situación planteada.
Interpreta los parámetros y supuestos de un modelo matemático.
Ajusta modelos matemáticos de acuerdo con una situación planteada.
Evalúa modelos matemáticos de acuerdo con una situación planteada.' FROM contenido.prueba WHERE codigo = 'M2'
ON CONFLICT (prueba_id, codigo) DO UPDATE SET nombre = EXCLUDED.nombre, criterios = EXCLUDED.criterios;
INSERT INTO contenido.habilidad (prueba_id, codigo, nombre, criterios) SELECT id, 'REP', 'Representar', 'Traduce del lenguaje natural al lenguaje matemático y viceversa.
Interpreta información de diferentes tipos de representaciones de acuerdo con una situación planteada.
Transfiere una situación de un sistema de representación a otro.' FROM contenido.prueba WHERE codigo = 'M2'
ON CONFLICT (prueba_id, codigo) DO UPDATE SET nombre = EXCLUDED.nombre, criterios = EXCLUDED.criterios;
INSERT INTO contenido.habilidad (prueba_id, codigo, nombre, criterios) SELECT id, 'ARG', 'Argumentar', 'Evalúa la validez de argumentos propuestos en diversos contextos.
Identifica la existencia de errores en procedimientos o demostraciones matemáticas.
Evalúa la validez de una deducción, reconociendo si una afirmación se puede concluir de otras afirmaciones.' FROM contenido.prueba WHERE codigo = 'M2'
ON CONFLICT (prueba_id, codigo) DO UPDATE SET nombre = EXCLUDED.nombre, criterios = EXCLUDED.criterios;
INSERT INTO contenido.habilidad (prueba_id, codigo, nombre, criterios) SELECT id, 'PTE', 'Pensamiento temporal y espacial', 'Interpretar periodizaciones históricas.
Aplicar las nociones temporales de duración, sucesión y simultaneidad a acontecimientos o fenómenos históricos, geográficos y sociales.
Distinguir los diferentes ritmos o velocidades que presentan los fenómenos o procesos históricos y sociales.
Interpretar la distribución geográfica y las dinámicas del territorio asociadas a fenómenos históricos y sociales utilizando representaciones como mapas, gráficos, cartogramas, entre otros.
Analizar continuidad y cambio entre periodos y procesos históricos y sociales.' FROM contenido.prueba WHERE codigo = 'HCS'
ON CONFLICT (prueba_id, codigo) DO UPDATE SET nombre = EXCLUDED.nombre, criterios = EXCLUDED.criterios;
INSERT INTO contenido.habilidad (prueba_id, codigo, nombre, criterios) SELECT id, 'AFI', 'Análisis de fuentes de información', 'Distinguir las características de las fuentes de información que permiten construir el conocimiento histórico, geográfico y social.
Comparar distintas interpretaciones sobre diversos procesos y fenómenos históricos, geográficos y sociales.
Comparar y clasificar información de diversas fuentes sobre procesos y fenómenos históricos, geográficos y sociales.
Analizar la información aportada por diversas fuentes como evidencia utilizada en argumentaciones sobre diversos temas.
Utilizar mapas, tablas y otras fuentes de información para la observación de fenómenos y procesos históricos, geográficos y sociales.' FROM contenido.prueba WHERE codigo = 'HCS'
ON CONFLICT (prueba_id, codigo) DO UPDATE SET nombre = EXCLUDED.nombre, criterios = EXCLUDED.criterios;
INSERT INTO contenido.habilidad (prueba_id, codigo, nombre, criterios) SELECT id, 'PCR', 'Pensamiento crítico', 'Evaluar distintas interpretaciones sobre fenómenos y procesos históricos y sociales.
Aplicar conceptos de la Historia y las Ciencias Sociales en el estudio de situaciones de la realidad social.
Inferir conclusiones sobre temas históricos, geográficos y sociales.
Analizar y evaluar la multicausalidad de los fenómenos y procesos históricos, geográficos y sociales.
Analizar y evaluar datos e información geográfica para identificar tendencias, relaciones y patrones territoriales.' FROM contenido.prueba WHERE codigo = 'HCS'
ON CONFLICT (prueba_id, codigo) DO UPDATE SET nombre = EXCLUDED.nombre, criterios = EXCLUDED.criterios;
INSERT INTO contenido.habilidad (prueba_id, codigo, nombre, criterios) SELECT id, 'OBS', 'Observar y plantear preguntas', 'Identificar preguntas a partir del conocimiento científico, que puedan ser resueltas mediante una investigación.
Identificar una hipótesis para dar una explicación tentativa a un problema científico que debe validarse con evidencias.' FROM contenido.prueba WHERE codigo = 'CIE'
ON CONFLICT (prueba_id, codigo) DO UPDATE SET nombre = EXCLUDED.nombre, criterios = EXCLUDED.criterios;
INSERT INTO contenido.habilidad (prueba_id, codigo, nombre, criterios) SELECT id, 'PLA', 'Planificar y conducir una investigación', 'Seleccionar evidencias que sustenten leyes, teorías o modelos científicos.
Identificar el componente de una investigación científica (marco conceptual, objetivo, pregunta, problema, predicción, observación, hipótesis, variables, diseño, procedimiento, inferencia, evidencia, resultado y conclusión).
Seleccionar procedimientos de investigación para la resolución de un problema científico.
Determinar el objetivo de investigación para la resolución de un problema científico.
Asociar instrumentos o materiales a usar de acuerdo a las variables presentes en una investigación.
Distinguir las variables en una investigación.' FROM contenido.prueba WHERE codigo = 'CIE'
ON CONFLICT (prueba_id, codigo) DO UPDATE SET nombre = EXCLUDED.nombre, criterios = EXCLUDED.criterios;
INSERT INTO contenido.habilidad (prueba_id, codigo, nombre, criterios) SELECT id, 'PRO', 'Procesar y analizar la evidencia', 'Identificar relaciones, patrones o tendencias entre las variables, usando expresiones y operaciones matemáticas cuando sea pertinente.
Identificar predicciones, resultados o explicaciones en diversos contextos.
Identificar conclusiones o inferencias a partir de resultados.' FROM contenido.prueba WHERE codigo = 'CIE'
ON CONFLICT (prueba_id, codigo) DO UPDATE SET nombre = EXCLUDED.nombre, criterios = EXCLUDED.criterios;
INSERT INTO contenido.habilidad (prueba_id, codigo, nombre, criterios) SELECT id, 'EVA', 'Evaluar', 'Evaluar la validez, confiabilidad, alcances o limitaciones de una investigación científica.
Evaluar la replicabilidad de los procedimientos o la reproducibilidad de los resultados en una investigación científica.
Evaluar la coherencia o pertinencia entre dos o más componentes de una investigación científica.
Evaluar cómo contribuye o ha contribuido una investigación científica en la generación o mejora de tecnologías.' FROM contenido.prueba WHERE codigo = 'CIE'
ON CONFLICT (prueba_id, codigo) DO UPDATE SET nombre = EXCLUDED.nombre, criterios = EXCLUDED.criterios;
INSERT INTO contenido.habilidad (prueba_id, codigo, nombre, criterios) SELECT id, 'COM', 'Comunicar', 'Seleccionar un recurso (tablas, gráficos, modelos u otros) para comunicar información de acuerdo a un determinado objetivo.' FROM contenido.prueba WHERE codigo = 'CIE'
ON CONFLICT (prueba_id, codigo) DO UPDATE SET nombre = EXCLUDED.nombre, criterios = EXCLUDED.criterios;

-- Ejes temáticos y contenidos
INSERT INTO contenido.eje_tematico (prueba_id, nombre, orden) SELECT id, 'Textos no literarios (expositivos y argumentativos)', 1 FROM contenido.prueba WHERE codigo = 'CL'
ON CONFLICT (prueba_id, nombre) DO UPDATE SET orden = EXCLUDED.orden;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Información relevante para el sentido de la lectura', 'Habilidades que se evalúan: Localizar, Interpretar, Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos no literarios (expositivos y argumentativos)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Temas e ideas principales', 'Habilidades que se evalúan: Interpretar, Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos no literarios (expositivos y argumentativos)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Ideas que apoyan una información', 'Habilidades que se evalúan: Interpretar, Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos no literarios (expositivos y argumentativos)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Tesis y la manera en que se presenta', 'Habilidades que se evalúan: Interpretar, Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos no literarios (expositivos y argumentativos)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Argumentos que sostienen la tesis', 'Habilidades que se evalúan: Interpretar, Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos no literarios (expositivos y argumentativos)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Organización de las ideas', 'Habilidades que se evalúan: Interpretar, Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos no literarios (expositivos y argumentativos)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Relaciones entre ideas para construir razonamientos', 'Habilidades que se evalúan: Interpretar, Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos no literarios (expositivos y argumentativos)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Distinción entre hechos y opiniones', 'Habilidades que se evalúan: Interpretar, Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos no literarios (expositivos y argumentativos)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Propósitos e intenciones de la lectura', 'Habilidades que se evalúan: Interpretar, Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos no literarios (expositivos y argumentativos)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Recursos lingüísticos y retóricos', 'Uso de imperativo, figuras literarias, expresiones populares, modalizaciones, citas, intertextualidad, oraciones dubitativas, preguntas retóricas, oraciones desiderativas, etc.
Habilidades que se evalúan: Interpretar, Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos no literarios (expositivos y argumentativos)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Recursos no lingüísticos', 'Elementos tipográficos como negritas o cursivas; visuales como imágenes, disposición gráfica, tablas, mapas o diagramas, etc.
Habilidades que se evalúan: Interpretar, Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos no literarios (expositivos y argumentativos)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Estrategias utilizadas en la lectura', 'Humor, presencia de estereotipos, prejuicios, o apelación a los sentimientos, etc.
Habilidades que se evalúan: Interpretar, Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos no literarios (expositivos y argumentativos)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Ideologías, creencias y puntos de vista', 'Habilidades que se evalúan: Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos no literarios (expositivos y argumentativos)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Fallas en la argumentación', 'Exageración, estereotipos, prejuicios, generalizaciones, descalificaciones personales, etc.
Habilidades que se evalúan: Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos no literarios (expositivos y argumentativos)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Perspectiva adoptada sobre el tema', 'Habilidades que se evalúan: Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos no literarios (expositivos y argumentativos)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Relaciones con nuevos textos y contextos', 'Similitud, diferencia, complementariedad, etc.
Habilidades que se evalúan: Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos no literarios (expositivos y argumentativos)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Suficiencia y consistencia de la información', 'Habilidades que se evalúan: Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos no literarios (expositivos y argumentativos)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.eje_tematico (prueba_id, nombre, orden) SELECT id, 'Textos literarios (narraciones)', 2 FROM contenido.prueba WHERE codigo = 'CL'
ON CONFLICT (prueba_id, nombre) DO UPDATE SET orden = EXCLUDED.orden;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Información relevante para el sentido del relato', 'Habilidades que se evalúan: Localizar, Interpretar, Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos literarios (narraciones)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Personajes: evolución, acciones, características, motivaciones, dilemas y relaciones', 'Habilidades que se evalúan: Interpretar, Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos literarios (narraciones)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Tiempo y espacio en la construcción del sentido', 'Habilidades que se evalúan: Interpretar, Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos literarios (narraciones)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Creencias o prejuicios presentes en el relato', 'Habilidades que se evalúan: Interpretar, Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos literarios (narraciones)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Temas presentes en el relato', 'Habilidades que se evalúan: Interpretar, Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos literarios (narraciones)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Conflicto o problema humano', 'Habilidades que se evalúan: Interpretar, Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos literarios (narraciones)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Relación de una parte del relato con su totalidad', 'Habilidades que se evalúan: Interpretar, Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos literarios (narraciones)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Recursos literarios', 'Orden de los acontecimientos; narración en primera, segunda o tercera persona; historias paralelas; saltos temporales; caja china; etc.
Habilidades que se evalúan: Interpretar, Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos literarios (narraciones)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Símbolos y tópicos literarios', 'Habilidades que se evalúan: Interpretar, Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos literarios (narraciones)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Personajes tipo y estereotipos', 'Por ejemplo, el pícaro, el avaro, el seductor, la madrastra, etc.
Habilidades que se evalúan: Interpretar, Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos literarios (narraciones)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Visión o perspectiva del narrador', 'Habilidades que se evalúan: Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos literarios (narraciones)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Relación del relato con otros textos y contextos', 'Habilidades que se evalúan: Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos literarios (narraciones)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Críticas o hipótesis sobre el sentido del relato', 'Habilidades que se evalúan: Evaluar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CL' AND e.nombre = 'Textos literarios (narraciones)' AND a.nombre = 'Lenguaje'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;

INSERT INTO contenido.eje_tematico (prueba_id, nombre, orden) SELECT id, 'Números', 1 FROM contenido.prueba WHERE codigo = 'M1'
ON CONFLICT (prueba_id, nombre) DO UPDATE SET orden = EXCLUDED.orden;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Conjunto de los números enteros y racionales', 'Operaciones y orden en el conjunto de los números enteros.
Operaciones y comparación entre números en el conjunto de los números racionales.
Problemas que involucren el conjunto de los números enteros y racionales en diversos contextos.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M1' AND e.nombre = 'Números' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Porcentaje', 'Concepto y cálculo de porcentaje.
Problemas que involucren porcentaje en diversos contextos.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M1' AND e.nombre = 'Números' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Potencias y raíces enésimas', 'Propiedades de las potencias de base racional y exponente racional.
Descomposición y propiedades de las raíces enésimas en los números reales.
Problemas que involucren potencias y raíces enésimas en los números reales en diversos contextos.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M1' AND e.nombre = 'Números' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.eje_tematico (prueba_id, nombre, orden) SELECT id, 'Álgebra y funciones', 2 FROM contenido.prueba WHERE codigo = 'M1'
ON CONFLICT (prueba_id, nombre) DO UPDATE SET orden = EXCLUDED.orden;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Expresiones algebraicas', 'Productos notables.
Factorizaciones y desarrollo de expresiones algebraicas.
Operatoria con expresiones algebraicas.
Problemas que involucren expresiones algebraicas en diversos contextos.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M1' AND e.nombre = 'Álgebra y funciones' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Proporcionalidad', 'Concepto de proporción directa e inversa con sus diferentes representaciones.
Problemas que involucren proporción directa e inversa en diversos contextos.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M1' AND e.nombre = 'Álgebra y funciones' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Ecuaciones e inecuaciones de primer grado', 'Resolución de ecuaciones lineales.
Problemas que involucren ecuaciones lineales en diversos contextos.
Resolución de inecuaciones lineales.
Problemas que involucren inecuaciones lineales en diversos contextos.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M1' AND e.nombre = 'Álgebra y funciones' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Sistemas de ecuaciones lineales (2x2)', 'Resolución de sistemas de ecuaciones lineales.
Problemas que involucren sistemas de ecuaciones lineales en diversos contextos.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M1' AND e.nombre = 'Álgebra y funciones' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Función lineal y afín', 'Concepto de función lineal y función afín.
Tablas y gráficos de función lineal y función afín.
Problemas que involucren función lineal y función afín en diversos contextos.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M1' AND e.nombre = 'Álgebra y funciones' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Función cuadrática', 'Resolución y problemas de ecuaciones de segundo grado en diversos contextos.
Tablas y gráficos de la función cuadrática, considerando la variación de sus parámetros.
Puntos especiales de la gráfica de la función cuadrática: vértice, ceros de la función e intersección con los ejes.
Problemas que involucren la función cuadrática en diversos contextos.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M1' AND e.nombre = 'Álgebra y funciones' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.eje_tematico (prueba_id, nombre, orden) SELECT id, 'Geometría', 3 FROM contenido.prueba WHERE codigo = 'M1'
ON CONFLICT (prueba_id, nombre) DO UPDATE SET orden = EXCLUDED.orden;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Figuras geométricas', 'Problemas que involucren el Teorema de Pitágoras en diversos contextos.
Perímetro y áreas de triángulos, paralelogramos, trapecios y círculos.
Problemas que involucren perímetro y áreas de triángulos, paralelogramos, trapecios y círculos en diversos contextos.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M1' AND e.nombre = 'Geometría' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Cuerpos geométricos', 'Área de superficies de paralelepípedos, cubos y cilindros.
Volumen de paralelepípedos, cubos y cilindros.
Problemas que involucren área y volumen de paralelepípedos, cubos y cilindros en diversos contextos.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M1' AND e.nombre = 'Geometría' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Transformaciones isométricas', 'Puntos y vectores en el plano cartesiano.
Rotación, traslación y reflexión de figuras geométricas.
Problemas que involucren rotación, traslación y reflexión en diversos contextos.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M1' AND e.nombre = 'Geometría' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Semejanza y proporcionalidad de figuras', 'Aplicar propiedades de semejanza y de proporcionalidad a modelos a escala y otras situaciones de la vida diaria y otras asignaturas.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M1' AND e.nombre = 'Geometría' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.eje_tematico (prueba_id, nombre, orden) SELECT id, 'Probabilidad y estadística', 4 FROM contenido.prueba WHERE codigo = 'M1'
ON CONFLICT (prueba_id, nombre) DO UPDATE SET orden = EXCLUDED.orden;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Representación de datos a través de tablas y gráficos', 'Tablas de frecuencia absoluta y relativa.
Tipos de gráficos que permitan representar datos.
Promedio de un conjunto de datos.
Problemas que involucren tablas y gráficos en diversos contextos.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M1' AND e.nombre = 'Probabilidad y estadística' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Medidas de posición', 'Cuartiles y percentiles de uno o más grupos de datos.
Diagrama de cajón para representar distribución de datos.
Problemas que involucren medidas de posición en diversos contextos.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M1' AND e.nombre = 'Probabilidad y estadística' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Reglas de las probabilidades', 'Problemas que involucren probabilidad de un evento en diversos contextos.
Problemas que involucren la regla aditiva y multiplicativa de probabilidades en diversos contextos.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M1' AND e.nombre = 'Probabilidad y estadística' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;

INSERT INTO contenido.eje_tematico (prueba_id, nombre, orden) SELECT id, 'Números', 1 FROM contenido.prueba WHERE codigo = 'M2'
ON CONFLICT (prueba_id, nombre) DO UPDATE SET orden = EXCLUDED.orden;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Conjunto de los números reales', 'Operaciones en el conjunto de los números reales.
Problemas que involucren el conjunto de los números reales en diversos contextos.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M2' AND e.nombre = 'Números' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Matemática financiera', 'Problemas relacionados con el ámbito de las finanzas, como por ejemplo, AFP y jubilación, créditos hipotecarios y crédito de consumo.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M2' AND e.nombre = 'Números' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Logaritmos', 'Relación entre potencias, raíces y logaritmos, y sus propiedades.
Problemas que involucren logaritmos en diversos contextos.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M2' AND e.nombre = 'Números' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.eje_tematico (prueba_id, nombre, orden) SELECT id, 'Álgebra y funciones', 2 FROM contenido.prueba WHERE codigo = 'M2'
ON CONFLICT (prueba_id, nombre) DO UPDATE SET orden = EXCLUDED.orden;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Sistemas de ecuaciones lineales (2x2): casos de solución', 'Casos en los cuales un sistema tiene una única solución, infinitas soluciones o no tiene solución.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M2' AND e.nombre = 'Álgebra y funciones' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Función potencia, exponencial y logarítmica', 'Gráfico de la función potencia, exponencial y logarítmica.
Problemas que involucren la función potencia, exponencial y logarítmica en diversos contextos.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M2' AND e.nombre = 'Álgebra y funciones' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Funciones trigonométricas', 'Gráfico de las funciones trigonométricas seno y coseno.
Problemas que involucren las funciones trigonométricas seno y coseno en diversos contextos.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M2' AND e.nombre = 'Álgebra y funciones' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.eje_tematico (prueba_id, nombre, orden) SELECT id, 'Geometría', 3 FROM contenido.prueba WHERE codigo = 'M2'
ON CONFLICT (prueba_id, nombre) DO UPDATE SET orden = EXCLUDED.orden;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Homotecia de figuras planas', 'Problemas que involucren homotecia en diversos contextos.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M2' AND e.nombre = 'Geometría' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Razones trigonométricas en triángulos rectángulos', 'Razones trigonométricas: seno, coseno y tangente.
Problemas que involucren razones trigonométricas en diversos contextos.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M2' AND e.nombre = 'Geometría' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Relaciones métricas en la circunferencia', 'Ángulos y arcos en la circunferencia.
Cuerdas y secantes en la circunferencia.
Problemas que involucren las relaciones métricas en la circunferencia en diversos contextos.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M2' AND e.nombre = 'Geometría' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Esferas, superficie y volumen', 'Problemas que involucren área de la superficie y el volumen de la esfera.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M2' AND e.nombre = 'Geometría' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Rectas en el plano', 'Resolver problemas acerca de rectas y posiciones relativas de las rectas.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M2' AND e.nombre = 'Geometría' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.eje_tematico (prueba_id, nombre, orden) SELECT id, 'Probabilidad y estadística', 4 FROM contenido.prueba WHERE codigo = 'M2'
ON CONFLICT (prueba_id, nombre) DO UPDATE SET orden = EXCLUDED.orden;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Medidas de dispersión', 'Medidas de dispersión de uno o más grupos de datos.
Problemas que involucren medidas de dispersión en diversos contextos.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M2' AND e.nombre = 'Probabilidad y estadística' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Probabilidad condicional', 'Problemas que involucren probabilidad condicional y sus propiedades en diversos contextos.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M2' AND e.nombre = 'Probabilidad y estadística' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Permutación y combinatoria', 'Permutación y combinatoria.
Problemas que involucren permutación y combinatoria en diversos contextos.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M2' AND e.nombre = 'Probabilidad y estadística' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Modelos probabilísticos', 'Problemas que involucren modelos binomiales en diversos contextos.
Problemas que involucren la distribución normal en diversos contextos.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'M2' AND e.nombre = 'Probabilidad y estadística' AND a.nombre = 'Matemática'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;

INSERT INTO contenido.eje_tematico (prueba_id, nombre, orden) SELECT id, 'Historia: Mundo, América y Chile', 1 FROM contenido.prueba WHERE codigo = 'HCS'
ON CONFLICT (prueba_id, nombre) DO UPDATE SET orden = EXCLUDED.orden;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'El Estado-nación durante el siglo XIX en América y Europa', 'Las ideas republicanas y liberales y su relación con las transformaciones ocurridas en América y Europa durante el siglo XIX.
Los impactos del surgimiento del Estado-nación en América y Europa en el siglo XIX.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'HCS' AND e.nombre = 'Historia: Mundo, América y Chile' AND a.nombre = 'Historia'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Formación y organización de la República de Chile en el siglo XIX', 'Características políticas y culturales de la formación de la República en Chile durante la primera mitad del siglo XIX.
La inserción de la economía chilena en los procesos de industrialización del mundo atlántico y en los mercados internacionales en el siglo XIX.
Transformaciones de la sociedad chilena en el tránsito del siglo XIX al siglo XX.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'HCS' AND e.nombre = 'Historia: Mundo, América y Chile' AND a.nombre = 'Historia'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Europa, América y Chile en la primera mitad del siglo XX', 'Nuevos modelos políticos y económicos derivados de la crisis del Estado liberal durante la primera mitad del siglo XX: totalitarismos europeos, populismo en América Latina e inicios del Estado de bienestar.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'HCS' AND e.nombre = 'Historia: Mundo, América y Chile' AND a.nombre = 'Historia'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Nuevo orden mundial posterior a la Segunda Guerra Mundial', 'La configuración de un nuevo orden mundial de posguerra, el inicio de procesos de descolonización y la creación de un nuevo marco regulador de las relaciones internacionales (ONU y Declaración Universal de los Derechos Humanos).
La confrontación ideológica como base de la Guerra Fría y sus manifestaciones políticas y culturales.
La movilización política y social en América Latina durante la segunda mitad del siglo XX: revoluciones, reformas políticas, dictaduras militares y violación de los Derechos Humanos.
El fin de la Guerra Fría, el derrumbe del bloque Soviético, el auge del neoliberalismo y la aceleración de la globalización.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'HCS' AND e.nombre = 'Historia: Mundo, América y Chile' AND a.nombre = 'Historia'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'La sociedad chilena a mediados del siglo XX', 'Caracterización de la sociedad chilena de mediados del siglo XX, considerando la extendida pobreza y su precariedad, y los impactos de la migración del campo a la ciudad.
El proceso de democratización de la sociedad chilena a mediados del siglo XX.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'HCS' AND e.nombre = 'Historia: Mundo, América y Chile' AND a.nombre = 'Historia'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'La Dictadura Militar (1973-1990) y el retorno a la democracia en Chile', 'Distintas interpretaciones historiográficas del Golpe de Estado de 1973 y el quiebre de la democracia en Chile.
Características del modelo económico neoliberal implementado en Chile durante la Dictadura Militar.
Violaciones sistemáticas a los Derechos Humanos y la supresión del Estado de derecho durante la Dictadura Militar.
Factores que incidieron en el proceso de recuperación de la democracia durante la década de 1980.
El proceso de transición a la democracia iniciado en 1988.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'HCS' AND e.nombre = 'Historia: Mundo, América y Chile' AND a.nombre = 'Historia'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.eje_tematico (prueba_id, nombre, orden) SELECT id, 'Formación ciudadana', 2 FROM contenido.prueba WHERE codigo = 'HCS'
ON CONFLICT (prueba_id, nombre) DO UPDATE SET orden = EXCLUDED.orden;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Estado, democracia y ciudadanía', 'La democracia considerando sus fundamentos, atributos y dimensiones.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'HCS' AND e.nombre = 'Formación ciudadana' AND a.nombre = 'Historia'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Institucionalidad democrática en Chile', 'Características y funcionamiento de la institucionalidad democrática en Chile.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'HCS' AND e.nombre = 'Formación ciudadana' AND a.nombre = 'Historia'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'La democracia en la sociedad de la información', 'Oportunidades y riesgos de los medios de comunicación masiva y del uso de las nuevas tecnologías de la información en el marco de una sociedad democrática.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'HCS' AND e.nombre = 'Formación ciudadana' AND a.nombre = 'Historia'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Acceso a la justicia y resguardo de los derechos de las personas', 'Las principales características del sistema judicial chileno.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'HCS' AND e.nombre = 'Formación ciudadana' AND a.nombre = 'Historia'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.eje_tematico (prueba_id, nombre, orden) SELECT id, 'Sistema económico', 3 FROM contenido.prueba WHERE codigo = 'HCS'
ON CONFLICT (prueba_id, nombre) DO UPDATE SET orden = EXCLUDED.orden;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Las personas y el funcionamiento del mercado', 'Funcionamiento del mercado y los factores que pueden alterarlo.
Relaciones entre el Estado y el mercado.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'HCS' AND e.nombre = 'Sistema económico' AND a.nombre = 'Historia'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Modelos de desarrollo y política económica', 'Impactos sociales y medioambientales de diversos modelos de desarrollo.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'HCS' AND e.nombre = 'Sistema económico' AND a.nombre = 'Historia'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Derechos laborales en Chile', 'Los derechos laborales y la evolución de los mecanismos institucionales que los resguardan.
El aporte de los movimientos y organizaciones sociales a la defensa y promoción de los derechos laborales.
El impacto de las principales tendencias globales y nacionales del mundo del trabajo en los derechos laborales en Chile.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'HCS' AND e.nombre = 'Sistema económico' AND a.nombre = 'Historia'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;

INSERT INTO contenido.eje_tematico (prueba_id, nombre, orden) SELECT id, 'Biología', 1 FROM contenido.prueba WHERE codigo = 'CIE'
ON CONFLICT (prueba_id, nombre) DO UPDATE SET orden = EXCLUDED.orden;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Organización, estructura y actividad celular', 'Estructura y función de los principales organelos y estructuras celulares, en procariontes o eucariontes (animales y vegetales): cápsula, pared celular, membrana celular, citoesqueleto, núcleo, nucléolo, retículos endoplasmáticos, ribosomas, lisosomas, peroxisomas, complejo de Golgi, mitocondrias, cloroplastos, vacuolas, centriolos, cilios y flagelos.
Relación entre estructuras y función celular, considerando algunos tipos como el enterocito, la célula muscular esquelética, la neurona y las células secretoras pancreáticas.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CIE' AND e.nombre = 'Biología' AND a.nombre = 'Biología'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Procesos y funciones biológicas', 'Características generales del sistema nervioso y su función coordinadora e integradora: estructura y función de las neuronas; generación y propagación del impulso nervioso y su transmisión mediante sinapsis química; arco reflejo simple; consecuencias del consumo de café, alcohol y drogas de abuso; cuidados del sistema nervioso (horas de sueño, prevención de traumatismos).
La participación de los gametos (ovocitos y espermatozoides) y su función en el proceso de la fecundación.
Características generales del ciclo ovárico y uterino, y sus fases.
Métodos de control de la natalidad: naturales (Billings, calendario, temperatura basal), artificiales reversibles (hormonales y de barrera) y parcialmente reversibles (quirúrgicos).
Características generales de las infecciones de transmisión sexual (VIH, herpes, gonorrea, clamidia): agente patógeno, transmisión, síntomas generales y prevención.
Características de la sexualidad humana y la reproducción: estructura y función de los sistemas reproductores, y aspectos sociales, afectivos y psicológicos de la sexualidad.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CIE' AND e.nombre = 'Biología' AND a.nombre = 'Biología'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Herencia y evolución', 'Características generales del ciclo celular: estructura de la cromatina, grados de compactación, puntos de control (G1–S, G2–M y metafase); etapas de la interfase (G1, S, G2) y la mitosis, y su importancia en la conservación de la información genética, crecimiento, desarrollo, reparación de tejidos y cáncer.
Características generales de la meiosis: etapas de la meiosis I y II y su contribución a la variabilidad genética.
La manipulación genética y su aplicación en la generación de alimentos, detergentes, vestuario y fármacos, entre otros.
Evidencias a favor de la evolución biológica: anatomía comparada (estructuras homólogas y análogas), embriología, biología molecular y registro fósil.
Aportes de Lamarck, Darwin y Wallace al estudio de mecanismos evolutivos.
Fundamentos de la evolución mediante selección natural y ejemplos.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CIE' AND e.nombre = 'Biología' AND a.nombre = 'Biología'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Organismo y ambiente', 'Procesos implicados en la obtención de energía y la síntesis de moléculas orgánicas: rol de la fotosíntesis y la respiración celular en el flujo de energía y en el reciclaje del carbono y del oxígeno; nutrición autótrofa y heterótrofa; etapas de la fotosíntesis (lugar, reactantes, productos y otras moléculas) y efecto de variables ambientales sobre el proceso.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CIE' AND e.nombre = 'Biología' AND a.nombre = 'Biología'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.eje_tematico (prueba_id, nombre, orden) SELECT id, 'Física', 2 FROM contenido.prueba WHERE codigo = 'CIE'
ON CONFLICT (prueba_id, nombre) DO UPDATE SET orden = EXCLUDED.orden;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Ondas', 'Elementos de las ondas electromagnéticas (longitud de onda, frecuencia, período, amplitud) en fenómenos ondulatorios.
Absorción, reflexión y refracción de ondas electromagnéticas. Propagación de la luz en línea recta.
Efecto Doppler, interferencia y difracción en ondas electromagnéticas, en términos cualitativos.
Espectro electromagnético: orden según longitud de onda y frecuencia, y principales usos tecnológicos.
Formación de colores y dispersión.
Relación entre longitud de onda, frecuencia y rapidez de propagación en una onda electromagnética.
Comportamiento de la luz en espejos (planos, cóncavos y convexos) y lentes (convergentes y divergentes), considerando la formación de imágenes.
Funcionamiento y utilidad de dispositivos tecnológicos: radar, prismáticos, comunicación inalámbrica, teléfono móvil, televisor, radio, láser, telescopios reflector y refractor, radiotelescopios, fibra óptica, entre otros.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CIE' AND e.nombre = 'Física' AND a.nombre = 'Física'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Mecánica', 'Descripción del movimiento: sistemas de referencia, trayectoria, posición, distancia recorrida, desplazamiento, rapidez media, tiempo, velocidad media e instantánea, aceleración.
Relatividad de Galileo en movimientos rectilíneos uniformes.
Movimiento rectilíneo uniforme: ecuación de itinerario y gráficos.
Movimiento rectilíneo uniformemente acelerado: ecuación de itinerario y gráficos.
Leyes de Newton en cuerpos con velocidad constante o aceleración constante. Diagrama de cuerpo libre.
Fuerza peso, elástica (ley de Hooke), tensión y normal, entre otras.
Fuerza de roce estático y cinético. Roce con el aire en términos cualitativos.
Modelos geocéntricos de Aristóteles y Ptolomeo, y heliocéntrico de Copérnico. Aportes de Galileo y Kepler.
Teorías acerca del origen y evolución del universo (Big Bang, Big Crunch, entre otras) y sus evidencias.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CIE' AND e.nombre = 'Física' AND a.nombre = 'Física'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Energía – Tierra', 'Teoría de la deriva continental, sus evidencias y su relación con la tectónica de placas.
Tectónica de placas y sus consecuencias (sismos, volcanismo y relieve).
Relación entre el modelo físico del interior de la Tierra (geosfera) y la tectónica de placas.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CIE' AND e.nombre = 'Física' AND a.nombre = 'Física'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Electricidad', 'Ley de Ohm en circuitos con resistores en serie, paralelo o mixtos.
Potencia y energía eléctrica en circuitos de corriente continua.
Corriente eléctrica como flujo de cargas en circuitos de corriente continua.
Consumo energético, eficiencia energética y potencia eléctrica en artefactos y dispositivos.
Componentes de la instalación eléctrica domiciliaria y sus funciones.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CIE' AND e.nombre = 'Física' AND a.nombre = 'Física'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.eje_tematico (prueba_id, nombre, orden) SELECT id, 'Química', 3 FROM contenido.prueba WHERE codigo = 'CIE'
ON CONFLICT (prueba_id, nombre) DO UPDATE SET orden = EXCLUDED.orden;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Estructura atómica', 'Clasificación de la materia en sustancias puras (elementos y compuestos) y mezclas (homogéneas y heterogéneas).
Procedimientos de separación de mezclas (decantación, filtración, tamizado y destilación) y sus aplicaciones.
Propiedades físicas de los elementos (temperaturas de ebullición y fusión, masa, volumen, densidad).
Teoría de Dalton y modelos atómicos de Thomson, Rutherford y Bohr.
Concepto de electrón, protón y neutrón, número atómico y número másico.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CIE' AND e.nombre = 'Química' AND a.nombre = 'Química'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Química orgánica', 'Propiedades del átomo de carbono: tetravalencia, hibridación, tipos de enlaces (simple, doble y triple), energía, longitud y ángulo de enlace.
Modelos de representación de moléculas orgánicas (fórmula molecular, empírica, desarrollada, condensada, semidesarrollada, topológica, modelos de esferas y varillas y compactos).
Compuestos orgánicos: hidrocarburos (alifáticos, cíclicos y aromáticos) y grupos funcionales (haluros, éteres, alcoholes, sulfuros, aminas, cetonas, aldehídos, ácidos carboxílicos, anhídridos, ésteres, amidas, fenoles y nitrilos): formulación, nombres (comunes o IUPAC), características y aplicaciones.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CIE' AND e.nombre = 'Química' AND a.nombre = 'Química'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;
INSERT INTO contenido.contenido_tematico (eje_id, area_id, nombre, descriptores)
SELECT e.id, a.id, 'Reacciones químicas y estequiometría', 'Leyes ponderales: conservación de la materia, proporciones definidas y múltiples.
Componentes de una reacción química. Reactantes y productos. Balance de ecuaciones.
Estequiometría: relaciones entre masa, masa molar y mol. Reactivo limitante y en exceso.
Análisis porcentual de compuestos químicos.
Fórmula empírica y molecular.
Características de las soluciones químicas en cuanto a componentes y propiedades.
Unidades de concentración químicas (molaridad, molalidad, fracción molar).
Unidades de concentración físicas (%m/m, %m/v, %v/v y ppm).
Dilución y determinación de concentraciones en diluciones.
Concentración en mezclas de soluciones.
Solubilidad y factores que influyen en ella.' FROM contenido.eje_tematico e JOIN contenido.prueba p ON p.id = e.prueba_id, contenido.area a
WHERE p.codigo = 'CIE' AND e.nombre = 'Química' AND a.nombre = 'Química'
ON CONFLICT (eje_id, nombre) DO UPDATE SET area_id = EXCLUDED.area_id, descriptores = EXCLUDED.descriptores;

-- Curso en que se enseña cada contenido, según las Bases Curriculares del Mineduc que usa como referencia el DEMRE
-- (Matemática y Ciencias Naturales de 7° básico a 2° medio, Matemática de 3° y 4° medio, Historia, Geografía y Ciencias
-- Sociales de 1° y 2° medio y Educación Ciudadana de 3° y 4° medio). Cuando un contenido se enseña en varios cursos se
-- indica el último, en que se completa. La práctica y el diagnóstico solo ofrecen contenidos de cursos que el estudiante
-- ya cursó. Competencia Lectora no depende del curso y queda sin curso. Solo se completa donde falta, así se respeta
-- lo que el administrador haya cambiado desde la consola.
UPDATE contenido.contenido_tematico c SET nivel_escolar_id = n.id
FROM (VALUES
  ('M1', 'Números', 'Conjunto de los números enteros y racionales', '1M'),
  ('M1', 'Números', 'Porcentaje', '8B'),
  ('M1', 'Números', 'Potencias y raíces enésimas', '2M'),
  ('M1', 'Álgebra y funciones', 'Expresiones algebraicas', '1M'),
  ('M1', 'Álgebra y funciones', 'Proporcionalidad', '7B'),
  ('M1', 'Álgebra y funciones', 'Ecuaciones e inecuaciones de primer grado', '8B'),
  ('M1', 'Álgebra y funciones', 'Sistemas de ecuaciones lineales (2x2)', '1M'),
  ('M1', 'Álgebra y funciones', 'Función lineal y afín', '8B'),
  ('M1', 'Álgebra y funciones', 'Función cuadrática', '2M'),
  ('M1', 'Geometría', 'Figuras geométricas', '8B'),
  ('M1', 'Geometría', 'Cuerpos geométricos', '8B'),
  ('M1', 'Geometría', 'Transformaciones isométricas', '8B'),
  ('M1', 'Geometría', 'Semejanza y proporcionalidad de figuras', '1M'),
  ('M1', 'Probabilidad y estadística', 'Representación de datos a través de tablas y gráficos', '8B'),
  ('M1', 'Probabilidad y estadística', 'Medidas de posición', '8B'),
  ('M1', 'Probabilidad y estadística', 'Reglas de las probabilidades', '1M'),
  ('M2', 'Números', 'Conjunto de los números reales', '2M'),
  ('M2', 'Números', 'Matemática financiera', '4M'),
  ('M2', 'Números', 'Logaritmos', '2M'),
  ('M2', 'Álgebra y funciones', 'Sistemas de ecuaciones lineales (2x2): casos de solución', '1M'),
  ('M2', 'Álgebra y funciones', 'Función potencia, exponencial y logarítmica', '4M'),
  ('M2', 'Álgebra y funciones', 'Funciones trigonométricas', '4M'),
  ('M2', 'Geometría', 'Homotecia de figuras planas', '1M'),
  ('M2', 'Geometría', 'Razones trigonométricas en triángulos rectángulos', '2M'),
  ('M2', 'Geometría', 'Relaciones métricas en la circunferencia', '3M'),
  ('M2', 'Geometría', 'Esferas, superficie y volumen', '2M'),
  ('M2', 'Geometría', 'Rectas en el plano', '3M'),
  ('M2', 'Probabilidad y estadística', 'Medidas de dispersión', '3M'),
  ('M2', 'Probabilidad y estadística', 'Probabilidad condicional', '3M'),
  ('M2', 'Probabilidad y estadística', 'Permutación y combinatoria', '2M'),
  ('M2', 'Probabilidad y estadística', 'Modelos probabilísticos', '4M'),
  ('HCS', 'Historia: Mundo, América y Chile', 'El Estado-nación durante el siglo XIX en América y Europa', '1M'),
  ('HCS', 'Historia: Mundo, América y Chile', 'Formación y organización de la República de Chile en el siglo XIX', '1M'),
  ('HCS', 'Historia: Mundo, América y Chile', 'Europa, América y Chile en la primera mitad del siglo XX', '2M'),
  ('HCS', 'Historia: Mundo, América y Chile', 'Nuevo orden mundial posterior a la Segunda Guerra Mundial', '2M'),
  ('HCS', 'Historia: Mundo, América y Chile', 'La sociedad chilena a mediados del siglo XX', '2M'),
  ('HCS', 'Historia: Mundo, América y Chile', 'La Dictadura Militar (1973-1990) y el retorno a la democracia en Chile', '2M'),
  ('HCS', 'Formación ciudadana', 'Estado, democracia y ciudadanía', '3M'),
  ('HCS', 'Formación ciudadana', 'Institucionalidad democrática en Chile', '3M'),
  ('HCS', 'Formación ciudadana', 'La democracia en la sociedad de la información', '3M'),
  ('HCS', 'Formación ciudadana', 'Acceso a la justicia y resguardo de los derechos de las personas', '4M'),
  ('HCS', 'Sistema económico', 'Las personas y el funcionamiento del mercado', '4M'),
  ('HCS', 'Sistema económico', 'Modelos de desarrollo y política económica', '4M'),
  ('HCS', 'Sistema económico', 'Derechos laborales en Chile', '4M'),
  ('CIE', 'Biología', 'Organización, estructura y actividad celular', '8B'),
  ('CIE', 'Biología', 'Procesos y funciones biológicas', '2M'),
  ('CIE', 'Biología', 'Herencia y evolución', '2M'),
  ('CIE', 'Biología', 'Organismo y ambiente', '1M'),
  ('CIE', 'Física', 'Ondas', '1M'),
  ('CIE', 'Física', 'Mecánica', '2M'),
  ('CIE', 'Física', 'Energía – Tierra', '1M'),
  ('CIE', 'Física', 'Electricidad', '8B'),
  ('CIE', 'Química', 'Estructura atómica', '8B'),
  ('CIE', 'Química', 'Química orgánica', '2M'),
  ('CIE', 'Química', 'Reacciones químicas y estequiometría', '2M')
) v(prueba, eje, contenido, curso)
JOIN contenido.prueba p ON p.codigo = v.prueba
JOIN contenido.eje_tematico e ON e.prueba_id = p.id AND e.nombre = v.eje
JOIN contenido.nivel_escolar n ON n.codigo = v.curso
WHERE c.eje_id = e.id AND c.nombre = v.contenido AND c.nivel_escolar_id IS NULL;

COMMIT;
