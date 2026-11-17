-- Supera PAES. Estructura inicial de las evaluaciones por prueba y sugerencias de cada área de carrera, versión 1.2 (modelo de datos 11.0).
-- Se ejecuta después de la semilla del temario PAES 2027. El administrador puede cambiar estos valores desde la consola.
-- Incluye las tablas de conversión oficiales del DEMRE de la Admisión 2026, proceso regular (publicadas el 05/01/2026).
-- El tiempo de cada evaluación sigue el ritmo oficial de su prueba (duración oficial dividida por sus preguntas).
-- El temario del DEMRE no fija cuántas preguntas tiene cada eje, por lo que el reparto del mini-ensayo y del ensayo completo es
-- provisional y parejo (RN-35): las preguntas que sobran van a los primeros ejes en el orden del temario, y el mini-ensayo se
-- escala con el mayor resto. El administrador lo ajusta desde la consola cuando el DEMRE publique una proporción oficial.
BEGIN;

INSERT INTO contenido.estructura_evaluacion (tipo_evaluacion_id, prueba_id, cantidad_min, cantidad_max, no_puntuables, duracion_min, textos, usos_gratis_mes)
SELECT t.id, p.id, v.cmin, v.cmax, v.np, v.dur, v.textos, v.gratis
FROM (VALUES
  -- Práctica: de 5 a 20 preguntas, sin tiempo.
  ('practica', 'CL', 5, 20, 0, NULL, NULL, 0), ('practica', 'M1', 5, 20, 0, NULL, NULL, 0), ('practica', 'M2', 5, 20, 0, NULL, NULL, 0),
  ('practica', 'HCS', 5, 20, 0, NULL, NULL, 0), ('practica', 'CIE', 5, 20, 0, NULL, NULL, 0),
  -- Repaso de errores: de 5 a 10 preguntas, sin tiempo.
  ('repaso', 'CL', 5, 10, 0, NULL, NULL, 0), ('repaso', 'M1', 5, 10, 0, NULL, NULL, 0), ('repaso', 'M2', 5, 10, 0, NULL, NULL, 0),
  ('repaso', 'HCS', 5, 10, 0, NULL, NULL, 0), ('repaso', 'CIE', 5, 10, 0, NULL, NULL, 0),
  -- Diagnóstico: 5 preguntas por eje (en Competencia Lectora, por habilidad, con 2 textos).
  ('diagnostico', 'CL', 15, 15, 0, 35, 2, 0), ('diagnostico', 'M1', 20, 20, 0, 44, NULL, 0), ('diagnostico', 'M2', 20, 20, 0, 51, NULL, 0),
  ('diagnostico', 'HCS', 15, 15, 0, 28, NULL, 0), ('diagnostico', 'CIE', 15, 15, 0, 30, NULL, 0),
  -- Mini-ensayo: cerca de un tercio de la prueba oficial, gratis una vez al mes por prueba.
  ('mini_ensayo', 'CL', 18, 18, 0, 42, 2, 1), ('mini_ensayo', 'M1', 22, 22, 0, 48, NULL, 1), ('mini_ensayo', 'M2', 18, 18, 0, 46, NULL, 1),
  ('mini_ensayo', 'HCS', 22, 22, 0, 41, NULL, 1), ('mini_ensayo', 'CIE', 27, 27, 0, 54, NULL, 1),
  -- Ensayo completo: formato oficial, con las preguntas sin puntaje de la prueba real.
  ('ensayo', 'CL', 65, 65, 5, 150, 7, 0), ('ensayo', 'M1', 65, 65, 5, 140, NULL, 0), ('ensayo', 'M2', 55, 55, 5, 140, NULL, 0),
  ('ensayo', 'HCS', 65, 65, 5, 120, NULL, 0), ('ensayo', 'CIE', 80, 80, 5, 160, NULL, 0)
) v(tipo, prueba, cmin, cmax, np, dur, textos, gratis)
JOIN contenido.tipo_evaluacion t ON t.codigo = v.tipo
JOIN contenido.prueba p ON p.codigo = v.prueba
ON CONFLICT (tipo_evaluacion_id, prueba_id) DO NOTHING;

-- Reparto del diagnóstico: 5 preguntas de cada eje; en Competencia Lectora, 5 de cada habilidad.
INSERT INTO contenido.estructura_detalle (estructura_id, prueba_id, eje_id, cantidad)
SELECT s.id, s.prueba_id, e.id, 5
FROM contenido.estructura_evaluacion s
JOIN contenido.tipo_evaluacion t ON t.id = s.tipo_evaluacion_id AND t.codigo = 'diagnostico'
JOIN contenido.prueba p ON p.id = s.prueba_id AND p.codigo <> 'CL'
JOIN contenido.eje_tematico e ON e.prueba_id = p.id
ON CONFLICT (estructura_id, eje_id) DO NOTHING;
INSERT INTO contenido.estructura_detalle (estructura_id, prueba_id, habilidad_id, cantidad)
SELECT s.id, s.prueba_id, h.id, 5
FROM contenido.estructura_evaluacion s
JOIN contenido.tipo_evaluacion t ON t.id = s.tipo_evaluacion_id AND t.codigo = 'diagnostico'
JOIN contenido.prueba p ON p.id = s.prueba_id AND p.codigo = 'CL'
JOIN contenido.habilidad h ON h.prueba_id = p.id
ON CONFLICT (estructura_id, habilidad_id) DO NOTHING;

-- Reparto del mini-ensayo y del ensayo completo por eje (orden del eje en el temario). En Competencia Lectora va por habilidad.
-- En el ensayo completo, no_puntuables indica cuántas de las preguntas del eje no suman puntaje, como en la prueba real.
INSERT INTO contenido.estructura_detalle (estructura_id, prueba_id, eje_id, cantidad, no_puntuables)
SELECT s.id, s.prueba_id, e.id, v.cantidad, v.np
FROM (VALUES
  ('mini_ensayo', 'M1', 1, 6, 0), ('mini_ensayo', 'M1', 2, 6, 0), ('mini_ensayo', 'M1', 3, 5, 0), ('mini_ensayo', 'M1', 4, 5, 0),
  ('mini_ensayo', 'M2', 1, 5, 0), ('mini_ensayo', 'M2', 2, 5, 0), ('mini_ensayo', 'M2', 3, 4, 0), ('mini_ensayo', 'M2', 4, 4, 0),
  ('mini_ensayo', 'HCS', 1, 8, 0), ('mini_ensayo', 'HCS', 2, 7, 0), ('mini_ensayo', 'HCS', 3, 7, 0),
  ('mini_ensayo', 'CIE', 1, 6, 0), ('mini_ensayo', 'CIE', 2, 6, 0), ('mini_ensayo', 'CIE', 3, 6, 0),
  ('ensayo', 'M1', 1, 17, 0), ('ensayo', 'M1', 2, 16, 0), ('ensayo', 'M1', 3, 16, 0), ('ensayo', 'M1', 4, 16, 0),
  ('ensayo', 'M2', 1, 14, 0), ('ensayo', 'M2', 2, 14, 0), ('ensayo', 'M2', 3, 14, 0), ('ensayo', 'M2', 4, 13, 0),
  ('ensayo', 'HCS', 1, 22, 0), ('ensayo', 'HCS', 2, 22, 0), ('ensayo', 'HCS', 3, 21, 0),
  ('ensayo', 'CIE', 1, 18, 1), ('ensayo', 'CIE', 2, 18, 1), ('ensayo', 'CIE', 3, 18, 1)
) v(tipo, prueba, orden, cantidad, np)
JOIN contenido.tipo_evaluacion t ON t.codigo = v.tipo
JOIN contenido.prueba p ON p.codigo = v.prueba
JOIN contenido.estructura_evaluacion s ON s.tipo_evaluacion_id = t.id AND s.prueba_id = p.id
JOIN contenido.eje_tematico e ON e.prueba_id = p.id AND e.orden = v.orden
ON CONFLICT (estructura_id, eje_id) DO NOTHING;
INSERT INTO contenido.estructura_detalle (estructura_id, prueba_id, habilidad_id, cantidad, no_puntuables)
SELECT s.id, s.prueba_id, h.id, v.cantidad, 0
FROM (VALUES ('mini_ensayo', 'LOC', 6), ('mini_ensayo', 'INT', 6), ('mini_ensayo', 'EVA', 6),
             ('ensayo', 'LOC', 22), ('ensayo', 'INT', 22), ('ensayo', 'EVA', 21)) v(tipo, habilidad, cantidad)
JOIN contenido.tipo_evaluacion t ON t.codigo = v.tipo
JOIN contenido.prueba p ON p.codigo = 'CL'
JOIN contenido.estructura_evaluacion s ON s.tipo_evaluacion_id = t.id AND s.prueba_id = p.id
JOIN contenido.habilidad h ON h.prueba_id = p.id AND h.codigo = v.habilidad
ON CONFLICT (estructura_id, habilidad_id) DO NOTHING;
-- Módulo electivo de Ciencias (Biología, Física o Química, según el electivo que eligió el estudiante): 26 preguntas en el
-- ensayo, 2 de ellas sin puntaje, y 9 en el mini-ensayo. No tiene eje ni habilidad.
INSERT INTO contenido.estructura_detalle (estructura_id, prueba_id, es_electivo, cantidad, no_puntuables)
SELECT s.id, s.prueba_id, true, v.cantidad, v.np
FROM (VALUES ('mini_ensayo', 9, 0), ('ensayo', 26, 2)) v(tipo, cantidad, np)
JOIN contenido.tipo_evaluacion t ON t.codigo = v.tipo
JOIN contenido.prueba p ON p.codigo = 'CIE'
JOIN contenido.estructura_evaluacion s ON s.tipo_evaluacion_id = t.id AND s.prueba_id = p.id
WHERE NOT EXISTS (SELECT 1 FROM contenido.estructura_detalle d WHERE d.estructura_id = s.id AND d.es_electivo);

-- Tablas de conversión oficiales del DEMRE, Admisión 2026, proceso regular, publicadas el 05/01/2026 (prueba aplicada el
-- 03/12/2025). Cada fila da el puntaje para una cantidad de respuestas correctas. Ciencias tiene una tabla por electivo. La
-- tabla de M2 llega a 49 correctas porque así la publicó el DEMRE; el puntaje del ensayo se escala a ese máximo.
-- Las tablas de cada nuevo año las carga el administrador desde la consola.
WITH tc AS (
  INSERT INTO contenido.tabla_conversion (prueba_id, proceso_admision_id, anio_admision, electivo_area_id, publicada_en)
  SELECT p.id, pa.id, 2026, NULL::smallint, DATE '2026-01-05'
  FROM contenido.prueba p, contenido.proceso_admision pa WHERE p.codigo = 'CL' AND pa.codigo = 'regular'
  ON CONFLICT DO NOTHING RETURNING id)
INSERT INTO contenido.tabla_conversion_fila (tabla_conversion_id, correctas, puntaje)
SELECT tc.id, f.correctas, f.puntaje FROM tc, (VALUES (0, 100), (1, 159), (2, 184), (3, 206), (4, 228), (5, 249), (6, 267), (7, 284), (8, 299), (9, 316), (10, 333), (11, 350), (12, 364), (13, 376), (14, 387), (15, 397), (16, 410), (17, 424), (18, 440), (19, 455), (20, 467), (21, 477), (22, 484), (23, 492), (24, 500), (25, 511), (26, 525), (27, 540), (28, 555), (29, 567), (30, 576), (31, 583), (32, 590), (33, 597), (34, 607), (35, 619), (36, 634), (37, 650), (38, 663), (39, 674), (40, 682), (41, 690), (42, 699), (43, 710), (44, 725), (45, 740), (46, 756), (47, 770), (48, 782), (49, 794), (50, 808), (51, 823), (52, 841), (53, 860), (54, 878), (55, 896), (56, 916), (57, 938), (58, 963), (59, 989), (60, 1000)) f(correctas, puntaje);
WITH tc AS (
  INSERT INTO contenido.tabla_conversion (prueba_id, proceso_admision_id, anio_admision, electivo_area_id, publicada_en)
  SELECT p.id, pa.id, 2026, NULL::smallint, DATE '2026-01-05'
  FROM contenido.prueba p, contenido.proceso_admision pa WHERE p.codigo = 'M1' AND pa.codigo = 'regular'
  ON CONFLICT DO NOTHING RETURNING id)
INSERT INTO contenido.tabla_conversion_fila (tabla_conversion_id, correctas, puntaje)
SELECT tc.id, f.correctas, f.puntaje FROM tc, (VALUES (0, 100), (1, 170), (2, 194), (3, 216), (4, 236), (5, 256), (6, 275), (7, 292), (8, 307), (9, 320), (10, 334), (11, 349), (12, 365), (13, 380), (14, 393), (15, 403), (16, 412), (17, 421), (18, 432), (19, 446), (20, 460), (21, 474), (22, 486), (23, 495), (24, 502), (25, 508), (26, 516), (27, 526), (28, 539), (29, 553), (30, 567), (31, 579), (32, 587), (33, 595), (34, 601), (35, 609), (36, 618), (37, 631), (38, 645), (39, 660), (40, 672), (41, 682), (42, 690), (43, 699), (44, 710), (45, 723), (46, 738), (47, 753), (48, 767), (49, 780), (50, 793), (51, 807), (52, 824), (53, 842), (54, 861), (55, 880), (56, 900), (57, 923), (58, 948), (59, 975), (60, 1000)) f(correctas, puntaje);
WITH tc AS (
  INSERT INTO contenido.tabla_conversion (prueba_id, proceso_admision_id, anio_admision, electivo_area_id, publicada_en)
  SELECT p.id, pa.id, 2026, NULL::smallint, DATE '2026-01-05'
  FROM contenido.prueba p, contenido.proceso_admision pa WHERE p.codigo = 'M2' AND pa.codigo = 'regular'
  ON CONFLICT DO NOTHING RETURNING id)
INSERT INTO contenido.tabla_conversion_fila (tabla_conversion_id, correctas, puntaje)
SELECT tc.id, f.correctas, f.puntaje FROM tc, (VALUES (0, 100), (1, 196), (2, 223), (3, 248), (4, 271), (5, 292), (6, 312), (7, 330), (8, 349), (9, 366), (10, 382), (11, 396), (12, 409), (13, 423), (14, 438), (15, 453), (16, 467), (17, 479), (18, 489), (19, 499), (20, 511), (21, 524), (22, 538), (23, 552), (24, 564), (25, 574), (26, 583), (27, 592), (28, 603), (29, 617), (30, 631), (31, 645), (32, 657), (33, 667), (34, 677), (35, 688), (36, 701), (37, 716), (38, 731), (39, 746), (40, 759), (41, 772), (42, 786), (43, 803), (44, 821), (45, 838), (46, 857), (47, 876), (48, 897), (49, 1000)) f(correctas, puntaje);
WITH tc AS (
  INSERT INTO contenido.tabla_conversion (prueba_id, proceso_admision_id, anio_admision, electivo_area_id, publicada_en)
  SELECT p.id, pa.id, 2026, NULL::smallint, DATE '2026-01-05'
  FROM contenido.prueba p, contenido.proceso_admision pa WHERE p.codigo = 'HCS' AND pa.codigo = 'regular'
  ON CONFLICT DO NOTHING RETURNING id)
INSERT INTO contenido.tabla_conversion_fila (tabla_conversion_id, correctas, puntaje)
SELECT tc.id, f.correctas, f.puntaje FROM tc, (VALUES (0, 100), (1, 117), (2, 145), (3, 169), (4, 191), (5, 212), (6, 233), (7, 253), (8, 270), (9, 286), (10, 300), (11, 314), (12, 331), (13, 348), (14, 364), (15, 377), (16, 387), (17, 397), (18, 406), (19, 418), (20, 432), (21, 447), (22, 463), (23, 476), (24, 486), (25, 493), (26, 500), (27, 508), (28, 517), (29, 530), (30, 545), (31, 561), (32, 574), (33, 585), (34, 593), (35, 600), (36, 607), (37, 616), (38, 628), (39, 643), (40, 659), (41, 673), (42, 686), (43, 695), (44, 705), (45, 714), (46, 727), (47, 742), (48, 759), (49, 775), (50, 790), (51, 804), (52, 818), (53, 835), (54, 853), (55, 874), (56, 894), (57, 915), (58, 938), (59, 964), (60, 1000)) f(correctas, puntaje);
WITH tc AS (
  INSERT INTO contenido.tabla_conversion (prueba_id, proceso_admision_id, anio_admision, electivo_area_id, publicada_en)
  SELECT p.id, pa.id, 2026, (SELECT id FROM contenido.area WHERE nombre = 'Biología'), DATE '2026-01-05'
  FROM contenido.prueba p, contenido.proceso_admision pa WHERE p.codigo = 'CIE' AND pa.codigo = 'regular'
  ON CONFLICT DO NOTHING RETURNING id)
INSERT INTO contenido.tabla_conversion_fila (tabla_conversion_id, correctas, puntaje)
SELECT tc.id, f.correctas, f.puntaje FROM tc, (VALUES (0, 100), (1, 115), (2, 140), (3, 162), (4, 182), (5, 202), (6, 219), (7, 235), (8, 249), (9, 263), (10, 278), (11, 292), (12, 306), (13, 317), (14, 327), (15, 335), (16, 344), (17, 355), (18, 368), (19, 381), (20, 393), (21, 402), (22, 409), (23, 415), (24, 420), (25, 426), (26, 435), (27, 446), (28, 458), (29, 471), (30, 481), (31, 489), (32, 495), (33, 499), (34, 503), (35, 507), (36, 513), (37, 522), (38, 533), (39, 546), (40, 558), (41, 568), (42, 575), (43, 580), (44, 584), (45, 588), (46, 593), (47, 600), (48, 609), (49, 621), (50, 634), (51, 646), (52, 655), (53, 663), (54, 668), (55, 674), (56, 680), (57, 689), (58, 700), (59, 713), (60, 726), (61, 738), (62, 748), (63, 757), (64, 766), (65, 777), (66, 791), (67, 806), (68, 821), (69, 836), (70, 851), (71, 868), (72, 886), (73, 907), (74, 929), (75, 1000)) f(correctas, puntaje);
WITH tc AS (
  INSERT INTO contenido.tabla_conversion (prueba_id, proceso_admision_id, anio_admision, electivo_area_id, publicada_en)
  SELECT p.id, pa.id, 2026, (SELECT id FROM contenido.area WHERE nombre = 'Física'), DATE '2026-01-05'
  FROM contenido.prueba p, contenido.proceso_admision pa WHERE p.codigo = 'CIE' AND pa.codigo = 'regular'
  ON CONFLICT DO NOTHING RETURNING id)
INSERT INTO contenido.tabla_conversion_fila (tabla_conversion_id, correctas, puntaje)
SELECT tc.id, f.correctas, f.puntaje FROM tc, (VALUES (0, 100), (1, 116), (2, 140), (3, 163), (4, 183), (5, 203), (6, 220), (7, 236), (8, 250), (9, 264), (10, 279), (11, 294), (12, 308), (13, 319), (14, 328), (15, 337), (16, 346), (17, 358), (18, 371), (19, 384), (20, 395), (21, 404), (22, 411), (23, 416), (24, 422), (25, 429), (26, 438), (27, 450), (28, 463), (29, 475), (30, 484), (31, 491), (32, 496), (33, 500), (34, 504), (35, 509), (36, 516), (37, 526), (38, 538), (39, 551), (40, 562), (41, 571), (42, 577), (43, 582), (44, 586), (45, 590), (46, 595), (47, 603), (48, 613), (49, 625), (50, 638), (51, 649), (52, 658), (53, 664), (54, 670), (55, 675), (56, 682), (57, 691), (58, 703), (59, 716), (60, 729), (61, 740), (62, 750), (63, 758), (64, 768), (65, 780), (66, 793), (67, 808), (68, 823), (69, 838), (70, 853), (71, 869), (72, 888), (73, 908), (74, 930), (75, 1000)) f(correctas, puntaje);
WITH tc AS (
  INSERT INTO contenido.tabla_conversion (prueba_id, proceso_admision_id, anio_admision, electivo_area_id, publicada_en)
  SELECT p.id, pa.id, 2026, (SELECT id FROM contenido.area WHERE nombre = 'Química'), DATE '2026-01-05'
  FROM contenido.prueba p, contenido.proceso_admision pa WHERE p.codigo = 'CIE' AND pa.codigo = 'regular'
  ON CONFLICT DO NOTHING RETURNING id)
INSERT INTO contenido.tabla_conversion_fila (tabla_conversion_id, correctas, puntaje)
SELECT tc.id, f.correctas, f.puntaje FROM tc, (VALUES (0, 100), (1, 113), (2, 138), (3, 160), (4, 180), (5, 199), (6, 217), (7, 232), (8, 246), (9, 260), (10, 274), (11, 289), (12, 303), (13, 315), (14, 324), (15, 332), (16, 341), (17, 351), (18, 363), (19, 376), (20, 389), (21, 399), (22, 407), (23, 412), (24, 417), (25, 423), (26, 430), (27, 439), (28, 451), (29, 464), (30, 476), (31, 485), (32, 492), (33, 497), (34, 500), (35, 504), (36, 509), (37, 516), (38, 525), (39, 537), (40, 550), (41, 561), (42, 570), (43, 577), (44, 582), (45, 585), (46, 589), (47, 595), (48, 602), (49, 612), (50, 624), (51, 637), (52, 649), (53, 658), (54, 664), (55, 670), (56, 676), (57, 683), (58, 692), (59, 704), (60, 718), (61, 731), (62, 742), (63, 752), (64, 761), (65, 771), (66, 784), (67, 799), (68, 814), (69, 830), (70, 845), (71, 862), (72, 880), (73, 900), (74, 923), (75, 1000)) f(correctas, puntaje);

-- Pruebas y electivo de Ciencias que se sugieren a quien marca cada área de carrera. Es una orientación general: Competencia
-- Lectora y M1 son obligatorias para todos, y los requisitos de cada carrera los fija cada universidad. El administrador
-- puede cambiar estas sugerencias desde la consola.
UPDATE contenido.area_carrera ac SET electivo_area_id = a.id
FROM (VALUES ('salud', 'Biología'), ('ingenieria_tecnologia', 'Física'), ('agro_veterinaria', 'Biología')) v(area_carrera, electivo)
JOIN contenido.area a ON a.nombre = v.electivo
WHERE ac.codigo = v.area_carrera AND ac.electivo_area_id IS NULL;
INSERT INTO contenido.area_carrera_prueba (area_carrera_id, prueba_id)
SELECT ac.id, p.id
FROM (VALUES
  ('salud', 'CL'), ('salud', 'M1'), ('salud', 'CIE'),
  ('ingenieria_tecnologia', 'CL'), ('ingenieria_tecnologia', 'M1'), ('ingenieria_tecnologia', 'M2'), ('ingenieria_tecnologia', 'CIE'),
  ('ciencias_naturales', 'CL'), ('ciencias_naturales', 'M1'), ('ciencias_naturales', 'M2'), ('ciencias_naturales', 'CIE'),
  ('agro_veterinaria', 'CL'), ('agro_veterinaria', 'M1'), ('agro_veterinaria', 'CIE'),
  ('economia_negocios', 'CL'), ('economia_negocios', 'M1'), ('economia_negocios', 'M2'), ('economia_negocios', 'HCS'),
  ('derecho', 'CL'), ('derecho', 'M1'), ('derecho', 'HCS'),
  ('ciencias_sociales', 'CL'), ('ciencias_sociales', 'M1'), ('ciencias_sociales', 'HCS'),
  ('educacion', 'CL'), ('educacion', 'M1'), ('educacion', 'HCS'),
  ('arte_arquitectura', 'CL'), ('arte_arquitectura', 'M1'), ('arte_arquitectura', 'HCS')
) v(area_carrera, prueba)
JOIN contenido.area_carrera ac ON ac.codigo = v.area_carrera
JOIN contenido.prueba p ON p.codigo = v.prueba
ON CONFLICT (area_carrera_id, prueba_id) DO NOTHING;

COMMIT;
