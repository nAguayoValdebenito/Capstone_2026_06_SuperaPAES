-- Supera PAES. Escenarios de las historias de usuario ejecutados contra el modelo v12.
-- Requiere, en este orden: Supera_PAES_Modelo_BD_v12.sql, la semilla del temario PAES 2027 (versión 1.1),
-- Supera_PAES_Semilla_Evaluaciones_v11.sql y Supera_PAES_Semilla_Documentos_Legales_v11.sql.
-- Cada caso dice qué se espera y qué pasó. Se ejecuta en una transacción que se deshace al final.
\set ON_ERROR_STOP 1
SET client_min_messages = warning;
\o /dev/null
BEGIN;
CREATE TEMP TABLE resultado_caso (n SERIAL, grupo TEXT, caso TEXT, esperado TEXT, obtenido TEXT, detalle TEXT);
CREATE TEMP TABLE grupo_actual (g TEXT);
INSERT INTO grupo_actual VALUES ('');
CREATE FUNCTION pg_temp.grupo(g TEXT) RETURNS void LANGUAGE sql AS $$ UPDATE grupo_actual SET g = grupo.g $$;

CREATE FUNCTION pg_temp.debe_fallar(caso TEXT, sql TEXT) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE sql;
    SET CONSTRAINTS ALL IMMEDIATE;
    SET CONSTRAINTS ALL DEFERRED;
    RAISE EXCEPTION USING ERRCODE = 'P0099', MESSAGE = 'aceptado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0099' THEN
      INSERT INTO resultado_caso (grupo, caso, esperado, obtenido) SELECT g, caso, 'rechazo', 'ACEPTADO' FROM grupo_actual;
    ELSE
      INSERT INTO resultado_caso (grupo, caso, esperado, obtenido, detalle) SELECT g, caso, 'rechazo', 'rechazado', SQLERRM FROM grupo_actual;
    END IF;
  END;
END $$;
CREATE FUNCTION pg_temp.debe_pasar(caso TEXT, sql TEXT) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE sql;
    SET CONSTRAINTS ALL IMMEDIATE;
    SET CONSTRAINTS ALL DEFERRED;
    INSERT INTO resultado_caso (grupo, caso, esperado, obtenido) SELECT g, caso, 'aceptado', 'aceptado' FROM grupo_actual;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO resultado_caso (grupo, caso, esperado, obtenido, detalle) SELECT g, caso, 'aceptado', 'RECHAZADO', SQLERRM FROM grupo_actual;
  END;
END $$;
CREATE FUNCTION pg_temp.debe_ser(caso TEXT, consulta TEXT, esperado TEXT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE obtenido TEXT;
BEGIN
  EXECUTE consulta INTO obtenido;
  INSERT INTO resultado_caso (grupo, caso, esperado, obtenido)
  SELECT g, caso, esperado, CASE WHEN obtenido IS NOT DISTINCT FROM esperado THEN obtenido ELSE 'DISTINTO: ' || COALESCE(obtenido, 'nulo') END FROM grupo_actual;
END $$;

-- ---------- Datos de apoyo ----------
CREATE FUNCTION pg_temp.id(tabla TEXT, cod TEXT) RETURNS SMALLINT LANGUAGE plpgsql AS $$
DECLARE r SMALLINT; BEGIN EXECUTE format('SELECT id FROM contenido.%I WHERE codigo = $1', tabla) INTO r USING cod; RETURN r; END $$;
CREATE FUNCTION pg_temp.m1() RETURNS SMALLINT LANGUAGE sql AS $$ SELECT id FROM contenido.prueba WHERE codigo = 'M1' $$;
CREATE FUNCTION pg_temp.est(nom TEXT) RETURNS BIGINT LANGUAGE sql AS $$ SELECT id FROM app.estudiante WHERE nombre = nom $$;
CREATE FUNCTION pg_temp.usr(nom TEXT) RETURNS BIGINT LANGUAGE sql AS $$ SELECT id FROM contenido.usuario_interno WHERE nombre = nom $$;

INSERT INTO contenido.usuario_interno (nombre, correo, hash_contrasena, rol_id, creado_en) VALUES
  ('Admin', 'admin@prueba.cl', 'x', pg_temp.id('rol', 'admin'), now()),
  ('Docente 1', 'd1@prueba.cl', 'x', pg_temp.id('rol', 'docente'), now()),
  ('Docente 2', 'd2@prueba.cl', 'x', pg_temp.id('rol', 'docente'), now());
INSERT INTO contenido.prueba_tipo_pregunta SELECT p.id, t.id FROM contenido.prueba p, contenido.tipo_pregunta t
 WHERE t.codigo = 'seleccion_multiple' OR p.codigo = 'M2'
-- La semilla 005_tipos_pregunta_por_prueba.sql ya carga estas mismas filas.
ON CONFLICT DO NOTHING;
-- ---------- 0. Semillas ----------
SELECT pg_temp.grupo('0. Semillas');
SELECT pg_temp.debe_ser('La semilla del temario trae el curso de cada contenido de M1, M2, Historia y Ciencias',
  'SELECT COUNT(c.nivel_escolar_id) || ''/'' || COUNT(*) FROM contenido.contenido_tematico c JOIN contenido.prueba p ON p.id = c.prueba_id WHERE p.codigo <> ''CL''', '55/55');
SELECT pg_temp.debe_ser('Competencia Lectora no depende del curso', 'SELECT COUNT(c.nivel_escolar_id)::text FROM contenido.contenido_tematico c JOIN contenido.prueba p ON p.id = c.prueba_id WHERE p.codigo = ''CL''', '0');
SELECT pg_temp.debe_ser('Modelos probabilísticos (M2) se enseña en 4° medio y Proporcionalidad (M1) en 7° básico',
  'SELECT string_agg(n.codigo, '','' ORDER BY c.nombre) FROM contenido.contenido_tematico c JOIN contenido.nivel_escolar n ON n.id = c.nivel_escolar_id WHERE c.nombre IN (''Modelos probabilísticos'', ''Proporcionalidad'')', '4M,7B');
SELECT pg_temp.debe_ser('Listas de opciones nuevas: papel en la revisión, enlace por correo, movimiento de preguntas extra y áreas de carrera',
  'SELECT (SELECT COUNT(*) FROM contenido.rol_revision) || ''/'' || (SELECT COUNT(*) FROM contenido.tipo_token_correo) || ''/'' || (SELECT COUNT(*) FROM contenido.tipo_movimiento_bono) || ''/'' || (SELECT COUNT(*) FROM contenido.area_carrera)', '2/2/2/9');
SELECT pg_temp.debe_ser('Cada área de carrera sugiere Competencia Lectora y M1', 'SELECT COUNT(*)::text FROM contenido.area_carrera ac WHERE (SELECT COUNT(*) FROM contenido.area_carrera_prueba x JOIN contenido.prueba p ON p.id = x.prueba_id WHERE x.area_carrera_id = ac.id AND p.codigo IN (''CL'', ''M1'')) <> 2', '0');

-- ---------- 0b. Datos iniciales del modelo v11 (antes de que los escenarios cambien la estructura) ----------
SELECT pg_temp.grupo('0b. Datos iniciales v11');
SELECT pg_temp.debe_ser('Acciones de auditoría de los usuarios internos: crear, editar, activar y desactivar (RF-C02, RNF-08)',
  'SELECT string_agg(codigo, '','' ORDER BY codigo) FROM contenido.accion_auditoria WHERE codigo LIKE ''%_usuario''', 'activar_usuario,crear_usuario,desactivar_usuario,editar_usuario');
SELECT pg_temp.debe_ser('Mezcla de dificultad 30 / 45 / 25 con sus márgenes (RN-09)',
  'SELECT string_agg(codigo || '':'' || mezcla_min || ''-'' || mezcla_objetivo || ''-'' || mezcla_max, '','' ORDER BY orden) FROM contenido.dificultad', 'facil:25-30-35,media:40-45-50,dificil:20-25-30');
SELECT pg_temp.debe_ser('El reparto del diagnóstico, del mini-ensayo y del ensayo suma lo que pide cada estructura (15 estructuras)',
  'SELECT COUNT(*) FILTER (WHERE s.cantidad_max = x.suma) || ''/'' || COUNT(*) FROM contenido.estructura_evaluacion s JOIN (SELECT estructura_id, SUM(cantidad) suma FROM contenido.estructura_detalle GROUP BY 1) x ON x.estructura_id = s.id', '15/15');
SELECT pg_temp.debe_ser('Ensayo de Ciencias: 18 por eje común con 1 sin puntaje cada uno y módulo electivo de 26 con 2 sin puntaje (RN-35)',
  'SELECT string_agg(COALESCE(e.nombre, ''Electivo'') || '':'' || d.cantidad || ''/'' || d.no_puntuables, '','' ORDER BY d.es_electivo, e.orden) FROM contenido.estructura_detalle d JOIN contenido.estructura_evaluacion s ON s.id = d.estructura_id JOIN contenido.tipo_evaluacion t ON t.id = s.tipo_evaluacion_id AND t.codigo = ''ensayo'' JOIN contenido.prueba p ON p.id = s.prueba_id AND p.codigo = ''CIE'' LEFT JOIN contenido.eje_tematico e ON e.id = d.eje_id',
  'Biología:18/1,Física:18/1,Química:18/1,Electivo:26/2');
SELECT pg_temp.debe_ser('Mini-ensayo de Ciencias: 6 por eje común y 9 del electivo',
  'SELECT string_agg(d.cantidad::text, '','' ORDER BY d.es_electivo, d.eje_id) FROM contenido.estructura_detalle d JOIN contenido.estructura_evaluacion s ON s.id = d.estructura_id JOIN contenido.tipo_evaluacion t ON t.id = s.tipo_evaluacion_id AND t.codigo = ''mini_ensayo'' JOIN contenido.prueba p ON p.id = s.prueba_id AND p.codigo = ''CIE''', '6,6,6,9');
SELECT pg_temp.debe_ser('Tablas oficiales de la Admisión 2026: 7 tablas (Ciencias, una por electivo) con su máximo de correctas',
  'SELECT string_agg(p.codigo || COALESCE(''-'' || left(a.nombre, 3), '''') || '':'' || (SELECT MAX(correctas) FROM contenido.tabla_conversion_fila f WHERE f.tabla_conversion_id = t.id), '','' ORDER BY p.id, a.nombre) FROM contenido.tabla_conversion t JOIN contenido.prueba p ON p.id = t.prueba_id LEFT JOIN contenido.area a ON a.id = t.electivo_area_id WHERE t.anio_admision = 2026',
  'CL:60,M1:60,M2:49,HCS:60,CIE-Bio:75,CIE-Fís:75,CIE-Quí:75');
SELECT pg_temp.debe_ser('Tabla oficial de M1: 30 correctas son 567 puntos y 60 son 1000',
  'SELECT string_agg(f.puntaje::text, ''/'' ORDER BY f.correctas) FROM contenido.tabla_conversion_fila f JOIN contenido.tabla_conversion t ON t.id = f.tabla_conversion_id WHERE t.prueba_id = pg_temp.m1() AND t.anio_admision = 2026 AND f.correctas IN (30, 60)', '567/1000');
SELECT pg_temp.debe_ser('Documentos legales 1.0 en los datos iniciales: términos, privacidad y permiso de puntajes',
  'SELECT string_agg(t.codigo || '':'' || d.version, '','' ORDER BY t.id) FROM contenido.documento_legal d JOIN contenido.tipo_documento_legal t ON t.id = d.tipo_documento_legal_id', 'terminos:1.0,privacidad:1.0,puntajes:1.0');
SELECT pg_temp.debe_ser('Correo de verificación con código de 5 intentos; el de recuperación solo con enlace',
  'SELECT string_agg(codigo || '':'' || horas_vigencia || '':'' || COALESCE(intentos_codigo::text, ''-''), '','' ORDER BY id) FROM contenido.tipo_token_correo', 'verificacion:24:5,recuperacion:1:-');

-- Curso en que se enseña cada contenido de M1 para estos escenarios (dato de prueba que reemplaza el de la semilla):
-- Probabilidad en 3° medio, el resto en 1° medio.
UPDATE contenido.contenido_tematico c SET nivel_escolar_id = pg_temp.id('nivel_escolar', CASE WHEN e.nombre = 'Probabilidad y estadística' THEN '3M' ELSE '1M' END)
  FROM contenido.eje_tematico e WHERE e.id = c.eje_id AND c.prueba_id = pg_temp.m1();
INSERT INTO contenido.lote_generacion (contenido_id, solicitante_id, tipo_pregunta_id, cantidad, modelo, version_instrucciones, estado_lote_id, creado_en)
SELECT MIN(id), pg_temp.usr('Admin'), pg_temp.id('tipo_pregunta', 'seleccion_multiple'), 10, 'deepseek-chat', '1.0', pg_temp.id('estado_lote', 'completado'), now()
  FROM contenido.contenido_tematico WHERE prueba_id = pg_temp.m1();

-- Cambia la etapa de una pregunta.
CREATE FUNCTION pg_temp.etapa(pid BIGINT, cod TEXT) RETURNS void LANGUAGE sql AS $$
  UPDATE contenido.pregunta SET estado_pregunta_id = pg_temp.id('estado_pregunta', cod) WHERE id = pid $$;
-- Crea una pregunta de M1 en borrador, con 4 alternativas (A correcta). Devuelve su id.
CREATE FUNCTION pg_temp.borrador_m1(cont INTEGER, de_ia BOOLEAN DEFAULT false) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE pid BIGINT;
BEGIN
  INSERT INTO contenido.pregunta (prueba_id, contenido_id, habilidad_id, tipo_pregunta_id, enunciado, explicacion, estado_pregunta_id, lote_id, autor_id, creado_en, actualizado_en)
  VALUES (pg_temp.m1(), cont, (SELECT id FROM contenido.habilidad WHERE prueba_id = pg_temp.m1() AND codigo = 'RP'), pg_temp.id('tipo_pregunta', 'seleccion_multiple'),
          'Enunciado', 'Explicación', pg_temp.id('estado_pregunta', 'borrador'), CASE WHEN de_ia THEN (SELECT MIN(id) FROM contenido.lote_generacion) END,
          pg_temp.usr('Admin'), now(), now())
  RETURNING id INTO pid;
  INSERT INTO contenido.alternativa (pregunta_id, letra, texto, es_correcta, explicacion)
  VALUES (pid, 'A', 'a', true, 'ok'), (pid, 'B', 'b', false, 'no'), (pid, 'C', 'c', false, 'no'), (pid, 'D', 'd', false, 'no');
  RETURN pid;
END $$;
-- Lleva una pregunta por la revisión docente hasta publicarla con la dificultad dada.
CREATE FUNCTION pg_temp.publicar(pid BIGINT, dif TEXT) RETURNS BIGINT LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.etapa(pid, 'en_revision');
  UPDATE contenido.pregunta SET dificultad_asignada_id = pg_temp.id('dificultad', dif) WHERE id = pid;
  PERFORM pg_temp.etapa(pid, 'aprobada');
  PERFORM pg_temp.etapa(pid, 'publicada');
  RETURN pid;
END $$;

-- 10 preguntas publicadas por eje de M1, con la mezcla 3 fáciles, 5 medias y 2 difíciles.
SELECT COUNT(pg_temp.publicar(pg_temp.borrador_m1(c.id), CASE WHEN g <= 3 THEN 'facil' WHEN g <= 8 THEN 'media' ELSE 'dificil' END)) AS preguntas_publicadas
FROM (SELECT DISTINCT ON (e.id) c.id FROM contenido.contenido_tematico c JOIN contenido.eje_tematico e ON e.id = c.eje_id
      WHERE c.prueba_id = pg_temp.m1() ORDER BY e.id, c.id) c, generate_series(1, 10) g;

INSERT INTO app.estudiante (nombre, correo, hash_contrasena, codigo_invitacion, anio_egreso, creado_en) VALUES
  ('Ana', 'ana@prueba.cl', 'x', 'ANAAA2', 2029, now()), ('Beto', 'beto@prueba.cl', 'x', 'BETAA2', 2027, now()),
  ('Caro', 'caro@prueba.cl', 'x', 'CARAA2', 2025, now()), ('Dani', 'dani@prueba.cl', 'x', 'DANAA2', 2027, now());

-- Inicia una evaluación de M1 con su estructura (la base calcula el curso y el año escolar).
CREATE FUNCTION pg_temp.iniciar(nom TEXT, tipo TEXT, cantidad INT, minutos INT DEFAULT NULL, dif TEXT DEFAULT NULL,
                                eje SMALLINT DEFAULT NULL, inicio TIMESTAMPTZ DEFAULT now(), tabla INTEGER DEFAULT NULL) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE r BIGINT; t contenido.tipo_evaluacion%ROWTYPE;
BEGIN
  SELECT * INTO t FROM contenido.tipo_evaluacion WHERE codigo = tipo;
  INSERT INTO app.evaluacion (estudiante_id, tipo_evaluacion_id, unica_por_anio_escolar, prueba_id, estructura_id, eje_id, dificultad_id,
                              anio_escolar, tabla_conversion_id, cantidad_preguntas, duracion_min, estado_evaluacion_id, iniciada_en, vence_en)
  VALUES (pg_temp.est(nom), t.id, t.unica_por_anio_escolar, pg_temp.m1(),
          (SELECT id FROM contenido.estructura_evaluacion WHERE tipo_evaluacion_id = t.id AND prueba_id = pg_temp.m1()),
          eje, pg_temp.id('dificultad', dif), 0, tabla, cantidad, minutos, pg_temp.id('estado_evaluacion', 'en_curso'), inicio, inicio + minutos * INTERVAL '1 minute')
  RETURNING id INTO r;
  RETURN r;
END $$;
CREATE FUNCTION pg_temp.item(ev BIGINT, ord INT, pid BIGINT, puntuable BOOLEAN DEFAULT true) RETURNS BIGINT LANGUAGE sql AS $$
  INSERT INTO app.evaluacion_item (evaluacion_id, orden, prueba_id, pregunta_id, version_pregunta, puntuable)
  SELECT ev, ord, prueba_id, id, version, puntuable FROM contenido.pregunta WHERE id = pid RETURNING id $$;
CREATE FUNCTION pg_temp.responder(it BIGINT, letra TEXT, consumo TEXT DEFAULT NULL) RETURNS void LANGUAGE sql AS $$
  UPDATE app.evaluacion_item i SET alternativa_id = a.id, respondida_en = now(), tiempo_seg = 30, tipo_consumo_id = COALESCE(pg_temp.id('tipo_consumo', consumo), i.tipo_consumo_id)
    FROM contenido.alternativa a WHERE i.id = it AND a.pregunta_id = i.pregunta_id AND a.letra = responder.letra $$;
-- Primera pregunta publicada de un eje de M1 con la dificultad dada.
CREATE FUNCTION pg_temp.pq(eje_nombre TEXT, dif TEXT, k INT DEFAULT 1) RETURNS BIGINT LANGUAGE sql AS $$
  SELECT v.pregunta_id FROM contenido.pregunta_version v JOIN contenido.eje_tematico e ON e.id = v.eje_id
   WHERE e.prueba_id = pg_temp.m1() AND e.nombre = eje_nombre AND v.dificultad_id = pg_temp.id('dificultad', dif)
   ORDER BY v.pregunta_id OFFSET k - 1 LIMIT 1 $$;

-- ---------- 1. Banco: ciclo de vida con revisión docente ----------
SELECT pg_temp.grupo('1. Banco y revisión docente');
DO $$ DECLARE pid BIGINT := pg_temp.borrador_m1((SELECT MIN(id) FROM contenido.contenido_tematico WHERE prueba_id = pg_temp.m1()), true);
              asg BIGINT;
BEGIN
  PERFORM pg_temp.debe_fallar('Pregunta de M1 con una habilidad de Competencia Lectora',
    format('UPDATE contenido.pregunta SET habilidad_id = (SELECT id FROM contenido.habilidad WHERE codigo = %L) WHERE id = %s', 'LOC', pid));
  PERFORM pg_temp.debe_fallar('Pregunta de M1 con un contenido de Historia',
    format('UPDATE contenido.pregunta SET contenido_id = (SELECT MIN(id) FROM contenido.contenido_tematico WHERE prueba_id = (SELECT id FROM contenido.prueba WHERE codigo = %L)) WHERE id = %s', 'HCS', pid));
  PERFORM pg_temp.debe_fallar('Pregunta de M1 de tipo Suficiencia de Datos (solo M2)',
    format('UPDATE contenido.pregunta SET tipo_pregunta_id = %s WHERE id = %s', pg_temp.id('tipo_pregunta', 'suficiencia_datos'), pid));
  PERFORM pg_temp.debe_fallar('Pregunta con dos alternativas correctas',
    format('UPDATE contenido.alternativa SET es_correcta = true WHERE pregunta_id = %s AND letra = %L', pid, 'B'));
  PERFORM pg_temp.debe_fallar('Pasar de borrador a publicada sin revisión', format('SELECT pg_temp.etapa(%s, %L)', pid, 'publicada'));
  PERFORM pg_temp.debe_fallar('Crear una pregunta directamente publicada',
    format('INSERT INTO contenido.pregunta (prueba_id, contenido_id, habilidad_id, tipo_pregunta_id, enunciado, explicacion, estado_pregunta_id, creado_en, actualizado_en) SELECT prueba_id, contenido_id, habilidad_id, tipo_pregunta_id, enunciado, explicacion, %s, now(), now() FROM contenido.pregunta WHERE id = %s',
           pg_temp.id('estado_pregunta', 'publicada'), pid));
  PERFORM pg_temp.debe_fallar('Enviar a revisión con 5 alternativas en M1 (permite 4)',
    format('INSERT INTO contenido.alternativa (pregunta_id, letra, texto) VALUES (%s, %L, %L); SELECT pg_temp.etapa(%s, %L)', pid, 'E', 'e', pid, 'en_revision'));
  PERFORM pg_temp.debe_pasar('Enviar a revisión una pregunta completa', format('SELECT pg_temp.etapa(%s, %L)', pid, 'en_revision'));
  PERFORM pg_temp.debe_ser('Al entrar en revisión se guarda la versión 1 con su clave', format('SELECT string_agg(version::text, '','') FROM contenido.pregunta_version WHERE pregunta_id = %s AND alternativa_correcta_id IS NOT NULL', pid), '1');
  PERFORM pg_temp.debe_fallar('Editar el enunciado mientras está en revisión', format('UPDATE contenido.pregunta SET enunciado = %L WHERE id = %s', 'Otro', pid));
  PERFORM pg_temp.debe_fallar('Editar una alternativa mientras está en revisión', format('UPDATE contenido.alternativa SET texto = %L WHERE pregunta_id = %s AND letra = %L', 'z', pid, 'B'));
  INSERT INTO contenido.asignacion_revision (pregunta_id, ronda, version_revisada, docente_id, rol_revision_id, estado_asignacion_id, asignado_en, vence_en)
  VALUES (pid, 1, 1, pg_temp.usr('Docente 1'), pg_temp.id('rol_revision', 'revisor'), pg_temp.id('estado_asignacion', 'pendiente'), now(), now() + INTERVAL '3 days') RETURNING id INTO asg;
  PERFORM pg_temp.debe_fallar('Asignar la revisión de una versión que no existe',
    format('INSERT INTO contenido.asignacion_revision (pregunta_id, ronda, version_revisada, docente_id, rol_revision_id, estado_asignacion_id, asignado_en, vence_en) VALUES (%s, 1, 7, %s, %s, %s, now(), now() + INTERVAL %L)',
           pid, pg_temp.usr('Docente 2'), pg_temp.id('rol_revision', 'revisor'), pg_temp.id('estado_asignacion', 'pendiente'), '3 days'));
  PERFORM pg_temp.debe_fallar('Asignar una revisión con un papel que no existe',
    format('INSERT INTO contenido.asignacion_revision (pregunta_id, ronda, version_revisada, docente_id, rol_revision_id, estado_asignacion_id, asignado_en, vence_en) VALUES (%s, 1, 1, %s, 99, %s, now(), now() + INTERVAL %L)',
           pid, pg_temp.usr('Docente 2'), pg_temp.id('estado_asignacion', 'pendiente'), '3 days'));
  PERFORM pg_temp.debe_fallar('Observar una pregunta sin comentario',
    format('INSERT INTO contenido.revision (asignacion_id, decision_revision_id, dificultad_id, creado_en) VALUES (%s, %s, %s, now())', asg, pg_temp.id('decision_revision', 'observar'), pg_temp.id('dificultad', 'media')));
  PERFORM pg_temp.debe_pasar('Observar con comentario',
    format('INSERT INTO contenido.revision (asignacion_id, decision_revision_id, dificultad_id, comentario, creado_en) VALUES (%s, %s, %s, %L, now())', asg, pg_temp.id('decision_revision', 'observar'), pg_temp.id('dificultad', 'media'), 'Mejorar el distractor B'));
  PERFORM pg_temp.etapa(pid, 'observada');
  UPDATE contenido.alternativa SET texto = 'b corregida' WHERE pregunta_id = pid AND letra = 'B';
  PERFORM pg_temp.debe_ser('Editar una versión ya revisada sube la versión', format('SELECT version::text FROM contenido.pregunta WHERE id = %s', pid), '2');
  UPDATE contenido.pregunta SET enunciado = 'Enunciado mejorado' WHERE id = pid;
  PERFORM pg_temp.debe_ser('Una segunda edición antes de reenviar no vuelve a subir la versión', format('SELECT version::text FROM contenido.pregunta WHERE id = %s', pid), '2');
  PERFORM pg_temp.etapa(pid, 'en_revision');
  PERFORM pg_temp.debe_ser('La versión 1 revisada se conserva igual', format('SELECT copia ->> %L FROM contenido.pregunta_version WHERE pregunta_id = %s AND version = 1', 'enunciado', pid), 'Enunciado');
  PERFORM pg_temp.etapa(pid, 'aprobada');
  PERFORM pg_temp.debe_fallar('Publicar sin dificultad asignada', format('SELECT pg_temp.etapa(%s, %L)', pid, 'publicada'));
  UPDATE contenido.pregunta SET dificultad_asignada_id = pg_temp.id('dificultad', 'media') WHERE id = pid;
  PERFORM pg_temp.debe_ser('Publicar una pregunta de la IA sin explicación en cada alternativa', format(
    'SELECT CASE WHEN EXISTS (SELECT 1 FROM contenido.alternativa WHERE pregunta_id = %s AND explicacion IS NULL) THEN %L ELSE %L END', pid, 'falta', 'completa'), 'completa');
  PERFORM pg_temp.debe_pasar('Publicar con dificultad asignada', format('SELECT pg_temp.etapa(%s, %L)', pid, 'publicada'));
  PERFORM pg_temp.debe_ser('La versión publicada guarda la dificultad', format('SELECT d.codigo FROM contenido.pregunta_version v JOIN contenido.dificultad d ON d.id = v.dificultad_id WHERE v.pregunta_id = %s AND v.version = 2', pid), 'media');
  PERFORM pg_temp.debe_ser('Cada cambio de etapa queda en el historial (creación y 5 cambios)', format('SELECT COUNT(*)::text FROM contenido.historial_estado_pregunta WHERE pregunta_id = %s', pid), '6');
  PERFORM pg_temp.debe_fallar('Modificar el historial de etapas', format('UPDATE contenido.historial_estado_pregunta SET hacia_id = desde_id WHERE pregunta_id = %s', pid));
  PERFORM pg_temp.debe_fallar('Retirar y publicar sin volver a revisar', format('SELECT pg_temp.etapa(%s, %L); SELECT pg_temp.etapa(%s, %L)', pid, 'retirada', pid, 'publicada'));
END $$;
DO $$ DECLARE pid BIGINT := pg_temp.borrador_m1((SELECT MIN(id) FROM contenido.contenido_tematico WHERE prueba_id = pg_temp.m1()), true);
BEGIN
  UPDATE contenido.alternativa SET explicacion = NULL WHERE pregunta_id = pid AND letra = 'C';
  PERFORM pg_temp.etapa(pid, 'en_revision');
  UPDATE contenido.pregunta SET dificultad_asignada_id = pg_temp.id('dificultad', 'facil') WHERE id = pid;
  PERFORM pg_temp.etapa(pid, 'aprobada');
  PERFORM pg_temp.debe_fallar('Publicar una pregunta de la IA sin la explicación de una alternativa', format('SELECT pg_temp.etapa(%s, %L)', pid, 'publicada'));
  pid := pg_temp.borrador_m1((SELECT MIN(id) FROM contenido.contenido_tematico WHERE prueba_id = pg_temp.m1()));
  PERFORM pg_temp.etapa(pid, 'en_revision');
  PERFORM pg_temp.etapa(pid, 'rechazada');
  PERFORM pg_temp.debe_fallar('Una pregunta rechazada no vuelve a revisión', format('SELECT pg_temp.etapa(%s, %L)', pid, 'en_revision'));
END $$;

-- ---------- 2. Catálogos y estructura ----------
SELECT pg_temp.grupo('2. Catálogos y estructura');
SELECT pg_temp.debe_fallar('Mezcla de dificultad que no suma 100', 'UPDATE contenido.dificultad SET mezcla_objetivo = 35 WHERE codigo = ''facil''');
SELECT pg_temp.debe_fallar('Código repetido en un catálogo', 'INSERT INTO contenido.motivo_reporte (codigo, nombre) VALUES (''otro'', ''Otro más'')');
SELECT pg_temp.debe_fallar('Tipo de evaluación con corrección inmediata y cambio de respuesta', 'UPDATE contenido.tipo_evaluacion SET permite_cambiar_respuesta = true WHERE codigo = ''practica''');
SELECT pg_temp.debe_fallar('Tipo con puntaje que deja elegir dificultad', 'UPDATE contenido.tipo_evaluacion SET permite_elegir_dificultad = true WHERE codigo = ''ensayo''');
SELECT pg_temp.debe_fallar('Reparto del diagnóstico de M1 que no suma 20',
  'UPDATE contenido.estructura_detalle SET cantidad = 6 WHERE id = (SELECT MIN(d.id) FROM contenido.estructura_detalle d WHERE d.prueba_id = pg_temp.m1())');
SELECT pg_temp.debe_fallar('Reparto con un eje de otra prueba',
  'INSERT INTO contenido.estructura_detalle (estructura_id, prueba_id, eje_id, cantidad) SELECT s.id, s.prueba_id, (SELECT MIN(id) FROM contenido.eje_tematico WHERE prueba_id <> s.prueba_id), 1 FROM contenido.estructura_evaluacion s WHERE s.prueba_id = pg_temp.m1() AND s.tipo_evaluacion_id = pg_temp.id(''tipo_evaluacion'', ''diagnostico'')');
SELECT pg_temp.debe_fallar('Estructura con más preguntas sin puntaje que preguntas', 'UPDATE contenido.estructura_evaluacion SET no_puntuables = 70 WHERE prueba_id = pg_temp.m1() AND tipo_evaluacion_id = pg_temp.id(''tipo_evaluacion'', ''ensayo'')');
SELECT pg_temp.debe_ser('Contenido de un eje de M1 marcado con otra prueba: la base le devuelve la prueba de su eje',
  'WITH u AS (UPDATE contenido.contenido_tematico SET prueba_id = (SELECT id FROM contenido.prueba WHERE codigo = ''CL'') WHERE id = (SELECT MIN(id) FROM contenido.contenido_tematico WHERE prueba_id = pg_temp.m1()) RETURNING prueba_id) SELECT p.codigo FROM u JOIN contenido.prueba p ON p.id = u.prueba_id', 'M1');

-- ---------- 3. Práctica: elige eje y dificultad, corrige al responder, descuenta cupo y no se cambia la respuesta ----------
SELECT pg_temp.grupo('3. Práctica');
DO $$ DECLARE ev BIGINT; it BIGINT; it2 BIGINT; q BIGINT; eje SMALLINT;
BEGIN
  SELECT id INTO eje FROM contenido.eje_tematico WHERE prueba_id = pg_temp.m1() AND nombre = 'Números';
  PERFORM pg_temp.debe_fallar('Práctica de 3 preguntas (mínimo 5)', format('SELECT pg_temp.iniciar(%L, %L, 3)', 'Ana', 'practica'));
  PERFORM pg_temp.debe_fallar('Práctica con tiempo límite', format('SELECT pg_temp.iniciar(%L, %L, 5, 20)', 'Ana', 'practica'));
  ev := pg_temp.iniciar('Ana', 'practica', 5, NULL, 'facil', eje);
  PERFORM pg_temp.debe_ser('La base calcula el curso de Ana (egresa en 2029): 1° medio', format('SELECT n.codigo FROM app.evaluacion e JOIN contenido.nivel_escolar n ON n.id = e.nivel_escolar_id WHERE e.id = %s', ev), '1M');
  q := pg_temp.pq('Números', 'facil');
  it := pg_temp.item(ev, 1, q);
  PERFORM pg_temp.debe_fallar('Responder sin indicar qué se descontó', format('SELECT pg_temp.responder(%s, %L)', it, 'A'));
  PERFORM pg_temp.responder(it, 'A', 'cupo');
  PERFORM pg_temp.debe_ser('Práctica: queda corregida al responder', format('SELECT es_correcta::text FROM app.evaluacion_item WHERE id = %s', it), 'true');
  PERFORM pg_temp.debe_fallar('Práctica: cambiar una respuesta ya corregida', format('SELECT pg_temp.responder(%s, %L)', it, 'B'));
  PERFORM pg_temp.debe_fallar('Entregar una pregunta media en una práctica de dificultad fácil', format('SELECT pg_temp.item(%s, 2, %s)', ev, pg_temp.pq('Números', 'media')));
  PERFORM pg_temp.debe_fallar('Entregar una pregunta de otro eje', format('SELECT pg_temp.item(%s, 2, %s)', ev, pg_temp.pq('Geometría', 'facil')));
  it2 := pg_temp.item(ev, 2, pg_temp.pq('Números', 'facil', 2));
  PERFORM pg_temp.debe_fallar('Responder con una alternativa de otra pregunta',
    format('UPDATE app.evaluacion_item SET alternativa_id = (SELECT MIN(id) FROM contenido.alternativa WHERE pregunta_id = %s), respondida_en = now(), tipo_consumo_id = %s WHERE id = %s', q, pg_temp.id('tipo_consumo', 'cupo'), it2));
  PERFORM pg_temp.debe_fallar('Poner en la práctica una pregunta de otra prueba',
    format('INSERT INTO app.evaluacion_item (evaluacion_id, orden, prueba_id, pregunta_id, version_pregunta) SELECT %s, 3, (SELECT id FROM contenido.prueba WHERE codigo = %L), id, version FROM contenido.pregunta WHERE id = %s', ev, 'CL', pg_temp.pq('Números', 'facil', 3)));
  PERFORM pg_temp.debe_fallar('Entregar una pregunta que no está publicada',
    format('SELECT pg_temp.item(%s, 3, (SELECT MIN(p.id) FROM contenido.pregunta p WHERE p.estado_pregunta_id <> %s))', ev, pg_temp.id('estado_pregunta', 'publicada')));
  PERFORM pg_temp.debe_fallar('Responder con tiempo negativo', format('UPDATE app.evaluacion_item SET tiempo_seg = -5 WHERE id = %s', it));
  UPDATE app.evaluacion_item SET es_correcta = false WHERE id = it;
  PERFORM pg_temp.debe_ser('La corrección no la fija el cliente (intenta marcar mal una buena)', format('SELECT es_correcta::text FROM app.evaluacion_item WHERE id = %s', it), 'true');
  PERFORM pg_temp.debe_fallar('Abrir una segunda evaluación con una práctica abierta', format('SELECT pg_temp.iniciar(%L, %L, 20, 44)', 'Ana', 'diagnostico'));
  PERFORM app.cerrar_evaluacion(ev, 'entregada');
  PERFORM pg_temp.debe_ser('Práctica terminada: la pregunta sin responder no cuenta', format('SELECT puntuables || ''/'' || correctas FROM app.resultado_evaluacion WHERE evaluacion_id = %s', ev), '1/1');
  PERFORM pg_temp.debe_fallar('Reabrir una evaluación cerrada', format('UPDATE app.evaluacion SET cerrada_en = NULL, estado_evaluacion_id = %s WHERE id = %s', pg_temp.id('estado_evaluacion', 'en_curso'), ev));
  PERFORM pg_temp.debe_fallar('Cerrar dos veces la misma evaluación', format('SELECT app.cerrar_evaluacion(%s, %L)', ev, 'entregada'));
  -- Práctica sin dificultad elegida (mezcla) y sin eje: alumno de 1° medio no recibe Probabilidad (3° medio).
  ev := pg_temp.iniciar('Ana', 'practica', 5);
  PERFORM pg_temp.debe_fallar('Práctica de 1° medio con una pregunta de Probabilidad (3° medio)', format('SELECT pg_temp.item(%s, 1, %s)', ev, pg_temp.pq('Probabilidad y estadística', 'media')));
  PERFORM pg_temp.debe_pasar('Práctica con mezcla: acepta cualquier dificultad de lo ya visto', format('SELECT pg_temp.item(%s, 1, %s); SELECT pg_temp.item(%s, 2, %s)', ev, pg_temp.pq('Álgebra y funciones', 'dificil'), ev, pg_temp.pq('Geometría', 'facil')));
  PERFORM pg_temp.responder((SELECT id FROM app.evaluacion_item WHERE evaluacion_id = ev AND orden = 1), 'B', 'bono');
  PERFORM pg_temp.responder((SELECT id FROM app.evaluacion_item WHERE evaluacion_id = ev AND orden = 2), 'A', 'cupo');
  PERFORM app.cerrar_evaluacion(ev, 'entregada');
END $$;

-- ---------- 4. Diagnóstico: una vez por año escolar, sin elegir, con tiempo, se corrige al entregar ----------
SELECT pg_temp.grupo('4. Diagnóstico');
DO $$ DECLARE ev BIGINT; it BIGINT; n INT := 0; r RECORD;
BEGIN
  PERFORM pg_temp.debe_fallar('Diagnóstico eligiendo dificultad', format('SELECT pg_temp.iniciar(%L, %L, 15, 33, %L)', 'Ana', 'diagnostico', 'facil'));
  PERFORM pg_temp.debe_fallar('Diagnóstico sin tiempo', format('SELECT pg_temp.iniciar(%L, %L, 15)', 'Ana', 'diagnostico'));
  PERFORM pg_temp.debe_fallar('Diagnóstico eligiendo un eje', format('SELECT pg_temp.iniciar(%L, %L, 15, 33, NULL, (SELECT MIN(id) FROM contenido.eje_tematico WHERE prueba_id = pg_temp.m1()))', 'Ana', 'diagnostico'));
  PERFORM pg_temp.debe_fallar('Diagnóstico que descuenta cupo', format('SELECT pg_temp.responder(pg_temp.item(pg_temp.iniciar(%L, %L, 15, 33), 1, %s), %L, %L)', 'Ana', 'diagnostico', pg_temp.pq('Números', 'media'), 'A', 'cupo'));
  -- Ana está en 1° medio: el armado omite Probabilidad (3° medio) y la evaluación queda de 15.
  ev := pg_temp.iniciar('Ana', 'diagnostico', 15, 33);
  FOR r IN SELECT pregunta_id FROM (SELECT v.pregunta_id, v.eje_id, row_number() OVER (PARTITION BY v.eje_id ORDER BY v.pregunta_id) AS k
             FROM contenido.pregunta_version v JOIN contenido.eje_tematico e ON e.id = v.eje_id
             WHERE e.prueba_id = pg_temp.m1() AND e.nombre <> 'Probabilidad y estadística' AND v.dificultad_id IS NOT NULL) x
           WHERE k <= 5 ORDER BY eje_id, pregunta_id LOOP
    n := n + 1;
    it := pg_temp.item(ev, n, r.pregunta_id);
    IF n <= 11 THEN PERFORM pg_temp.responder(it, CASE WHEN n % 3 = 0 THEN 'B' ELSE 'A' END); END IF;
  END LOOP;
  PERFORM pg_temp.debe_fallar('Agregar una pregunta 16 a un diagnóstico de 15', format('SELECT pg_temp.item(%s, 16, %s)', ev, pg_temp.pq('Números', 'dificil', 2)));
  PERFORM pg_temp.debe_ser('Diagnóstico: sin corrección mientras está abierto', format('SELECT COUNT(es_correcta)::text FROM app.evaluacion_item WHERE evaluacion_id = %s', ev), '0');
  PERFORM pg_temp.responder(it - 14, 'C');
  PERFORM pg_temp.debe_ser('Diagnóstico: cambiar la respuesta antes de entregar', format('SELECT veces_cambiada::text FROM app.evaluacion_item WHERE id = %s', it - 14), '1');
  PERFORM app.cerrar_evaluacion(ev, 'entregada');
  PERFORM pg_temp.debe_ser('Diagnóstico: correctas/incorrectas/omitidas (las omitidas cuentan)', format('SELECT correctas || ''/'' || incorrectas || ''/'' || omitidas FROM app.resultado_evaluacion WHERE evaluacion_id = %s', ev), '7/4/4');
  PERFORM pg_temp.debe_ser('Diagnóstico: resultado en los 3 ejes vistos, 5 preguntas cada uno', format('SELECT COUNT(*) || ''x'' || MIN(preguntas) FROM app.resultado_eje WHERE evaluacion_id = %s', ev), '3x5');
  PERFORM pg_temp.debe_fallar('Cambiar una respuesta de un diagnóstico entregado', format('SELECT pg_temp.responder(%s, %L)', it - 13, 'B'));
  PERFORM pg_temp.debe_fallar('Segundo diagnóstico de M1 en el mismo año escolar', format('SELECT pg_temp.iniciar(%L, %L, 15, 33)', 'Ana', 'diagnostico'));
  PERFORM pg_temp.debe_fallar('Borrar el resultado de un diagnóstico', format('DELETE FROM app.resultado_evaluacion WHERE evaluacion_id = %s', ev));
  -- Otro año escolar: un diagnóstico de M1 iniciado en abril del año escolar anterior (el año escolar cambia en marzo).
  PERFORM pg_temp.debe_pasar('Diagnóstico de M1 en otro año escolar', format(
    'SELECT app.cerrar_evaluacion(pg_temp.iniciar(%L, %L, 15, 33, NULL, NULL, (date_trunc(%L, now()) - INTERVAL %L)::timestamptz), %L)', 'Ana', 'diagnostico', 'year', '9 months', 'abandonada'));
  PERFORM pg_temp.debe_ser('Un diagnóstico abandonado también queda corregido', 'SELECT COUNT(*)::text FROM app.v_historial WHERE estudiante_id = pg_temp.est(''Ana'') AND tipo = ''diagnostico'' AND estado = ''abandonada'' AND omitidas IS NOT NULL', '1');
END $$;

-- ---------- 5. Mini-ensayo: tiempo controlado y un uso gratis al mes ----------
SELECT pg_temp.grupo('5. Mini-ensayo');
UPDATE contenido.estructura_evaluacion SET cantidad_min = 20, cantidad_max = 20, duracion_min = 44 WHERE prueba_id = pg_temp.m1() AND tipo_evaluacion_id = pg_temp.id('tipo_evaluacion', 'mini_ensayo');
DO $$ DECLARE ev BIGINT; ev2 BIGINT; it BIGINT; est INTEGER;
BEGIN
  SELECT id INTO est FROM contenido.estructura_evaluacion WHERE tipo_evaluacion_id = pg_temp.id('tipo_evaluacion', 'mini_ensayo') AND prueba_id = pg_temp.m1();
  ev := pg_temp.iniciar('Beto', 'mini_ensayo', 20, 44, NULL, NULL, now() - INTERVAL '50 minutes');
  INSERT INTO app.uso_gratis VALUES (pg_temp.est('Beto'), est, date_trunc('month', app.hoy_chile())::date, 1, ev);
  it := pg_temp.item(ev, 1, pg_temp.pq('Números', 'media'));
  PERFORM pg_temp.debe_fallar('Mini-ensayo: responder después de que se acabó el tiempo', format('SELECT pg_temp.responder(%s, %L)', it, 'A'));
  PERFORM pg_temp.debe_ser('El cierre automático cierra el mini-ensayo vencido', 'SELECT (app.cerrar_vencidas() >= 1)::text', 'true');
  PERFORM pg_temp.debe_ser('Mini-ensayo vencido: tiempo agotado y cierre en la hora de término', format('SELECT ee.codigo || '':'' || (e.cerrada_en = e.vence_en) FROM app.evaluacion e JOIN contenido.estado_evaluacion ee ON ee.id = e.estado_evaluacion_id WHERE e.id = %s', ev), 'tiempo_agotado:true');
  ev2 := pg_temp.iniciar('Beto', 'mini_ensayo', 20, 44);
  PERFORM pg_temp.debe_fallar('Segundo mini-ensayo gratis en el mismo mes',
    format('INSERT INTO app.uso_gratis VALUES (%s, %s, %L, 2, %s)', pg_temp.est('Beto'), est, date_trunc('month', app.hoy_chile())::date, ev2));
  PERFORM pg_temp.debe_fallar('Mismo número de uso en dos solicitudes simultáneas',
    format('INSERT INTO app.uso_gratis VALUES (%s, %s, %L, 1, %s)', pg_temp.est('Beto'), est, date_trunc('month', app.hoy_chile())::date, ev2));
  PERFORM pg_temp.debe_fallar('Uso gratis registrado con la evaluación de otro estudiante',
    format('INSERT INTO app.uso_gratis VALUES (%s, %s, %L, 1, %s)', pg_temp.est('Caro'), est, date_trunc('month', app.hoy_chile())::date, ev2));
  PERFORM pg_temp.debe_fallar('Evaluación con un vencimiento que no calza con su duración',
    format('UPDATE app.evaluacion SET vence_en = vence_en + INTERVAL %L WHERE id = %s', '30 minutes', ev2));
  PERFORM pg_temp.debe_fallar('Mini-ensayo de 25 preguntas (la estructura pide 20)', format('SELECT app.cerrar_evaluacion(%s, %L); SELECT pg_temp.iniciar(%L, %L, 25, 55)', ev2, 'abandonada', 'Dani', 'mini_ensayo'));
  PERFORM app.cerrar_evaluacion(ev2, 'abandonada');
END $$;

-- ---------- 6. Ensayo completo: armado por estructura, preguntas sin puntaje y puntaje con la tabla oficial ----------
SELECT pg_temp.grupo('6. Ensayo completo');
-- Ensayo de prueba de 10 preguntas con 1 sin puntaje (sin el reparto por eje de los datos iniciales) y dos tablas de
-- conversión de prueba de la Admisión 2027, de 0 a 9 correctas.
DELETE FROM contenido.estructura_detalle WHERE estructura_id = (SELECT id FROM contenido.estructura_evaluacion WHERE prueba_id = pg_temp.m1() AND tipo_evaluacion_id = pg_temp.id('tipo_evaluacion', 'ensayo'));
UPDATE contenido.estructura_evaluacion SET cantidad_min = 10, cantidad_max = 10, no_puntuables = 1, duracion_min = 22 WHERE prueba_id = pg_temp.m1() AND tipo_evaluacion_id = pg_temp.id('tipo_evaluacion', 'ensayo');
INSERT INTO contenido.tabla_conversion (prueba_id, proceso_admision_id, anio_admision, publicada_en, cargada_por)
VALUES (pg_temp.m1(), pg_temp.id('proceso_admision', 'regular'), 2027, DATE '2026-12-20', pg_temp.usr('Admin')),
       (pg_temp.m1(), pg_temp.id('proceso_admision', 'invierno'), 2027, DATE '2026-06-20', pg_temp.usr('Admin'));
INSERT INTO contenido.tabla_conversion_fila SELECT t.id, g, CASE WHEN t.publicada_en > DATE '2026-07-01' THEN 100 + g * 100 ELSE 100 END
  FROM contenido.tabla_conversion t, generate_series(0, 9) g WHERE t.anio_admision = 2027;
DO $$ DECLARE ev BIGINT; it BIGINT; r RECORD; tabla INTEGER;
BEGIN
  SELECT id INTO tabla FROM contenido.tabla_conversion WHERE prueba_id = pg_temp.m1() ORDER BY publicada_en DESC LIMIT 1;
  PERFORM pg_temp.debe_pasar('Ensayo sin tabla de conversión: se rinde y se informa que no hay puntaje (CU-10 3.b)',
    format('SELECT app.cerrar_evaluacion(pg_temp.iniciar(%L, %L, 10, 22), %L)', 'Caro', 'ensayo', 'abandonada'));
  PERFORM pg_temp.debe_fallar('Ensayo eligiendo dificultad (sesgaría el puntaje)', format('SELECT pg_temp.iniciar(%L, %L, 10, 22, %L, NULL, now(), %s)', 'Caro', 'ensayo', 'facil', tabla));
  ev := pg_temp.iniciar('Caro', 'ensayo', 10, 22, NULL, NULL, now(), tabla);
  FOR r IN SELECT pregunta_id, row_number() OVER (ORDER BY pregunta_id) AS k FROM contenido.pregunta_version
            WHERE dificultad_id IS NOT NULL AND eje_id IN (SELECT id FROM contenido.eje_tematico WHERE prueba_id = pg_temp.m1()) ORDER BY pregunta_id LIMIT 10 LOOP
    it := pg_temp.item(ev, r.k::int, r.pregunta_id, r.k <> 10);
    IF r.k <= 8 THEN PERFORM pg_temp.responder(it, CASE WHEN r.k <= 6 THEN 'A' ELSE 'D' END); END IF;
  END LOOP;
  PERFORM pg_temp.debe_ser('Ensayo de alumna egresada: entrega contenidos de todos los cursos', format('SELECT (n.codigo = %L)::text FROM app.evaluacion e JOIN contenido.nivel_escolar n ON n.id = e.nivel_escolar_id WHERE e.id = %s', 'EG', ev), 'true');
  PERFORM pg_temp.debe_fallar('Una segunda pregunta sin puntaje (la estructura pide 1)',
    format('UPDATE contenido.estructura_evaluacion SET cantidad_max = 11 WHERE id = (SELECT estructura_id FROM app.evaluacion WHERE id = %s); SELECT pg_temp.item(%s, 11, %s, false)', ev, ev, pg_temp.pq('Geometría', 'dificil', 2)));
  PERFORM app.cerrar_evaluacion(ev, 'entregada');
  PERFORM pg_temp.debe_ser('Ensayo: cuentan las 9 con puntaje (6 buenas, 2 malas, 1 omitida)', format('SELECT puntuables || ''/'' || correctas || ''/'' || incorrectas || ''/'' || omitidas FROM app.resultado_evaluacion WHERE evaluacion_id = %s', ev), '9/6/2/1');
  PERFORM pg_temp.debe_ser('Ensayo: puntaje con la tabla más reciente (6 correctas)', format('SELECT puntaje::text FROM app.resultado_evaluacion WHERE evaluacion_id = %s', ev), '700');
  PERFORM pg_temp.debe_fallar('Puntaje en una práctica', format('SELECT pg_temp.iniciar(%L, %L, 5, NULL, NULL, NULL, now(), %s)', 'Caro', 'practica', tabla));
END $$;

-- ---------- 7. Curso calculado desde el año de egreso (cambia en marzo, hora de Chile) ----------
SELECT pg_temp.grupo('7. Curso del estudiante');
SELECT pg_temp.debe_ser('Egresa en 2029, octubre de 2026: 1° medio', 'SELECT codigo FROM contenido.nivel_escolar WHERE id = app.nivel_escolar_en(2029::smallint, DATE ''2026-10-18'')', '1M');
SELECT pg_temp.debe_ser('Egresa en 2029, febrero de 2027: sigue en 1° medio', 'SELECT codigo FROM contenido.nivel_escolar WHERE id = app.nivel_escolar_en(2029::smallint, DATE ''2027-02-15'')', '1M');
SELECT pg_temp.debe_ser('Egresa en 2029, marzo de 2027: 2° medio', 'SELECT codigo FROM contenido.nivel_escolar WHERE id = app.nivel_escolar_en(2029::smallint, DATE ''2027-03-01'')', '2M');
SELECT pg_temp.debe_ser('Egresó en 2025: egresado', 'SELECT codigo FROM contenido.nivel_escolar WHERE id = app.nivel_escolar_en(2025::smallint, DATE ''2026-10-18'')', 'EG');
SELECT pg_temp.debe_ser('Ejes de M1 que ve un alumno de 1° medio (no ve Probabilidad, de 3° medio)',
  'SELECT COUNT(DISTINCT c.eje_id)::text FROM contenido.contenido_tematico c JOIN contenido.nivel_escolar n ON n.id = c.nivel_escolar_id WHERE c.prueba_id = pg_temp.m1() AND n.orden <= (SELECT orden FROM contenido.nivel_escolar WHERE codigo = ''1M'')', '3');
SELECT pg_temp.debe_fallar('Año de egreso imposible', 'UPDATE app.estudiante SET anio_egreso = 1890 WHERE nombre = ''Dani''');

-- ---------- 8. Historial, progreso y repaso ----------
SELECT pg_temp.grupo('8. Historial, progreso y repaso');
SELECT pg_temp.debe_ser('Historial de Ana, del más nuevo al más antiguo',
  'SELECT string_agg(tipo || '':'' || estado, '', '' ORDER BY iniciada_en DESC, evaluacion_id DESC) FROM app.v_historial WHERE estudiante_id = pg_temp.est(''Ana'')',
  'diagnostico:entregada, practica:entregada, practica:entregada, diagnostico:abandonada');
SELECT pg_temp.debe_ser('Progreso de Ana: ejes con respuestas', 'SELECT COUNT(*)::text FROM app.v_progreso_eje WHERE estudiante_id = pg_temp.est(''Ana'')', '3');
SELECT pg_temp.debe_ser('Acierto ponderado: las difíciles pesan más (Álgebra de Ana)',
  'SELECT acierto_ponderado::text FROM app.v_progreso_eje p JOIN contenido.eje_tematico e ON e.id = p.eje_id WHERE p.estudiante_id = pg_temp.est(''Ana'') AND e.nombre = ''Álgebra y funciones''',
  (SELECT ROUND(100.0 * SUM(d.peso) FILTER (WHERE r.es_correcta) / SUM(d.peso), 1)::text FROM app.v_respuesta_valida r JOIN contenido.dificultad d ON d.id = r.dificultad_id
    JOIN contenido.eje_tematico e ON e.id = r.eje_id WHERE r.estudiante_id = pg_temp.est('Ana') AND e.nombre = 'Álgebra y funciones'));
SELECT pg_temp.debe_ser('Ejes a reforzar de Ana (al menos 5 respuestas y menos de 60 %)',
  'SELECT COALESCE(string_agg(e.nombre, '', '' ORDER BY e.nombre), ''ninguno'') FROM app.v_progreso_eje p JOIN contenido.eje_tematico e ON e.id = p.eje_id WHERE p.estudiante_id = pg_temp.est(''Ana'') AND p.a_reforzar',
  (SELECT COALESCE(string_agg(nombre, ', ' ORDER BY nombre), 'ninguno') FROM (SELECT e.nombre FROM app.v_respuesta_valida r JOIN contenido.dificultad d ON d.id = r.dificultad_id JOIN contenido.eje_tematico e ON e.id = r.eje_id
     WHERE r.estudiante_id = pg_temp.est('Ana') GROUP BY e.nombre HAVING COUNT(*) >= 5 AND 100.0 * SUM(d.peso) FILTER (WHERE r.es_correcta) / SUM(d.peso) < 60) x));
SELECT pg_temp.debe_ser('Preguntas por repasar de Ana (incorrectas y omitidas del diagnóstico, más la práctica)', 'SELECT COUNT(*)::text FROM app.v_preguntas_falladas WHERE estudiante_id = pg_temp.est(''Ana'')',
  (SELECT COUNT(*)::text FROM (SELECT DISTINCT ON (pregunta_id) es_correcta FROM app.v_respuesta_valida WHERE estudiante_id = pg_temp.est('Ana') ORDER BY pregunta_id, fecha DESC, evaluacion_item_id DESC) x WHERE NOT es_correcta));
SELECT pg_temp.debe_ser('Revisión pregunta por pregunta del diagnóstico, tal como lo vio', 'SELECT COUNT(*)::text FROM app.v_revision_evaluacion r JOIN app.evaluacion e ON e.id = r.evaluacion_id WHERE e.estudiante_id = pg_temp.est(''Ana'') AND e.tipo_evaluacion_id = pg_temp.id(''tipo_evaluacion'', ''diagnostico'') AND e.estado_evaluacion_id = pg_temp.id(''estado_evaluacion'', ''entregada'') AND r.enunciado IS NOT NULL', '15');
DO $$ DECLARE ev BIGINT; fallada BIGINT; acertada BIGINT; it BIGINT;
BEGIN
  SELECT pregunta_id INTO fallada FROM app.v_preguntas_falladas WHERE estudiante_id = pg_temp.est('Ana') ORDER BY pregunta_id LIMIT 1;
  -- Una pregunta cuya última respuesta fue correcta (no está entre las falladas).
  SELECT r.pregunta_id INTO acertada FROM app.v_respuesta_valida r WHERE r.estudiante_id = pg_temp.est('Ana') AND r.es_correcta
     AND NOT EXISTS (SELECT 1 FROM app.v_preguntas_falladas f WHERE f.estudiante_id = r.estudiante_id AND f.pregunta_id = r.pregunta_id)
   ORDER BY r.pregunta_id LIMIT 1;
  ev := pg_temp.iniciar('Ana', 'repaso', 5);
  PERFORM pg_temp.debe_fallar('Repaso con una pregunta que el estudiante acertó', format('SELECT pg_temp.item(%s, 1, %s)', ev, acertada));
  it := pg_temp.item(ev, 1, fallada);
  PERFORM pg_temp.debe_fallar('Repaso que descuenta cupo', format('SELECT pg_temp.responder(%s, %L, %L)', it, 'A', 'cupo'));
  PERFORM pg_temp.responder(it, 'A');
  PERFORM pg_temp.debe_ser('Al acertar en el repaso, la pregunta sale de las falladas', format('SELECT COUNT(*)::text FROM app.v_preguntas_falladas WHERE estudiante_id = pg_temp.est(%L) AND pregunta_id = %s', 'Ana', fallada), '0');
  PERFORM app.cerrar_evaluacion(ev, 'entregada');
END $$;

-- ---------- 9. Anular una pregunta con error ----------
SELECT pg_temp.grupo('9. Anulación');
DO $$ DECLARE q BIGINT; ev BIGINT; antes TEXT;
BEGIN
  SELECT i.pregunta_id, i.evaluacion_id INTO q, ev FROM app.evaluacion_item i JOIN app.evaluacion e ON e.id = i.evaluacion_id
   WHERE e.tipo_evaluacion_id = pg_temp.id('tipo_evaluacion', 'ensayo') AND i.es_correcta ORDER BY i.orden LIMIT 1;
  SELECT puntuables || '/' || correctas || '/' || puntaje INTO antes FROM app.resultado_evaluacion WHERE evaluacion_id = ev;
  PERFORM pg_temp.debe_ser('Anular una pregunta recalcula las evaluaciones donde apareció', format('SELECT (app.anular_pregunta(%s) >= 1)::text', q), 'true');
  PERFORM pg_temp.debe_ser('Ensayo recalculado sin la pregunta anulada (antes 9/6/700): 5 de 8 equivalen a 6 de 9 en la tabla', format('SELECT puntuables || ''/'' || correctas || ''/'' || puntaje FROM app.resultado_evaluacion WHERE evaluacion_id = %s', ev), '8/5/700');
  PERFORM pg_temp.debe_ser('La pregunta anulada queda retirada', format('SELECT ep.codigo FROM contenido.pregunta p JOIN contenido.estado_pregunta ep ON ep.id = p.estado_pregunta_id WHERE p.id = %s', q), 'retirada');
  PERFORM pg_temp.debe_ser('Nada se borra: el ítem anulado sigue en la evaluación', format('SELECT anulada::text FROM app.evaluacion_item WHERE evaluacion_id = %s AND pregunta_id = %s', ev, q), 'true');
  PERFORM pg_temp.debe_fallar('Entregar la pregunta retirada', format('SELECT app.cerrar_evaluacion(pg_temp.iniciar(%L, %L, 5), %L) FROM (SELECT pg_temp.item((SELECT MAX(id) FROM app.evaluacion), 1, %s)) x', 'Dani', 'practica', 'abandonada', q));
END $$;

-- ---------- 10. Retomar y cierre por inactividad ----------
SELECT pg_temp.grupo('10. Retomar y cierre automático');
DO $$ DECLARE ev BIGINT;
BEGIN
  ev := pg_temp.iniciar('Dani', 'practica', 5, NULL, NULL, NULL, now() - INTERVAL '3 hours');
  UPDATE app.evaluacion SET ultima_actividad_en = now() - INTERVAL '3 hours' WHERE id = ev;
  PERFORM pg_temp.debe_ser('Retomar: la evaluación abierta del estudiante se encuentra por su índice', 'SELECT COUNT(*)::text FROM app.evaluacion WHERE estudiante_id = pg_temp.est(''Dani'') AND cerrada_en IS NULL', '1');
  PERFORM app.cerrar_vencidas();
  PERFORM pg_temp.debe_ser('Práctica sin actividad por más de 2 horas: se cierra como abandonada', format('SELECT ee.codigo FROM app.evaluacion e JOIN contenido.estado_evaluacion ee ON ee.id = e.estado_evaluacion_id WHERE e.id = %s', ev), 'abandonada');
END $$;

-- ---------- 11. Cuentas y privacidad ----------
SELECT pg_temp.grupo('11. Cuentas y privacidad');
-- Los términos y la política de privacidad 1.0 vienen en los datos iniciales.
INSERT INTO app.consentimiento (estudiante_id, documento_legal_id, aceptado_en) SELECT pg_temp.est('Ana'), d.id, now()
  FROM contenido.documento_legal d JOIN contenido.tipo_documento_legal t ON t.id = d.tipo_documento_legal_id WHERE t.obligatorio;
SELECT pg_temp.debe_fallar('Aceptar dos veces el mismo documento vigente', 'INSERT INTO app.consentimiento (estudiante_id, documento_legal_id, aceptado_en) SELECT pg_temp.est(''Ana''), MIN(id), now() FROM contenido.documento_legal');
SELECT pg_temp.debe_fallar('Dos versiones iguales de un documento', 'INSERT INTO contenido.documento_legal (tipo_documento_legal_id, version, contenido, vigente_desde) VALUES (pg_temp.id(''tipo_documento_legal'', ''terminos''), ''1.0'', ''x'', now())');
INSERT INTO app.estudiante_prueba (estudiante_id, prueba_id, es_principal) SELECT pg_temp.est('Ana'), id, codigo = 'M1' FROM contenido.prueba WHERE codigo IN ('M1', 'CL');
SELECT pg_temp.debe_fallar('Dos pruebas a reforzar', 'UPDATE app.estudiante_prueba SET es_principal = true WHERE estudiante_id = pg_temp.est(''Ana'')');
SELECT pg_temp.debe_fallar('Electivo en una prueba que no es Ciencias', 'UPDATE app.estudiante_prueba SET electivo_area_id = (SELECT id FROM contenido.area WHERE nombre = ''Física'') WHERE estudiante_id = pg_temp.est(''Ana'') AND prueba_id = pg_temp.m1()');
SELECT pg_temp.debe_fallar('Solicitud respondida sin fecha de respuesta',
  'INSERT INTO app.solicitud_derecho (estudiante_id, tipo_derecho_id, estado_solicitud_id, solicitado_en, vence_en) VALUES (pg_temp.est(''Ana''), pg_temp.id(''tipo_derecho'', ''acceso''), pg_temp.id(''estado_solicitud'', ''respondida''), now(), now() + INTERVAL ''30 days'')');
SELECT pg_temp.debe_pasar('Solicitud de acceso pendiente con su plazo',
  'INSERT INTO app.solicitud_derecho (estudiante_id, tipo_derecho_id, estado_solicitud_id, solicitado_en, vence_en) VALUES (pg_temp.est(''Ana''), pg_temp.id(''tipo_derecho'', ''acceso''), pg_temp.id(''estado_solicitud'', ''pendiente''), now(), now() + INTERVAL ''30 days'')');
SELECT pg_temp.debe_fallar('Borrar una evaluación al eliminar una cuenta (se seudonimiza)', 'DELETE FROM app.evaluacion WHERE estudiante_id = pg_temp.est(''Beto'')');
SELECT pg_temp.debe_pasar('Eliminar la cuenta: se seudonimiza y el historial se conserva',
  'UPDATE app.estudiante SET nombre = ''Estudiante eliminado'', correo = ''eliminado-'' || id || ''@supera.invalid'', eliminado_en = now() WHERE nombre = ''Beto''');

-- ---------- 12. Cupo e invitaciones ----------
SELECT pg_temp.grupo('12. Cupo e invitaciones');
SELECT pg_temp.debe_fallar('Usar más preguntas que el cupo del día', 'INSERT INTO app.cupo_diario VALUES (pg_temp.est(''Ana''), app.hoy_chile(), 10, 11)');
SELECT pg_temp.debe_fallar('Invitarse a sí mismo', 'INSERT INTO app.invitacion (invitante_id, invitado_id, registrado_en) VALUES (pg_temp.est(''Ana''), pg_temp.est(''Ana''), now())');
INSERT INTO app.invitacion (invitante_id, invitado_id, registrado_en, verificado_en, bono_entregado) VALUES (pg_temp.est('Ana'), pg_temp.est('Dani'), now(), now(), true);
INSERT INTO app.movimiento_bono (estudiante_id, tipo_movimiento_bono_id, cantidad, invitacion_id, creado_en) SELECT pg_temp.est('Ana'), pg_temp.id('tipo_movimiento_bono', 'abono'), 5, MIN(id), now() FROM app.invitacion;
SELECT pg_temp.debe_fallar('Abonar dos veces la misma invitación', 'INSERT INTO app.movimiento_bono (estudiante_id, tipo_movimiento_bono_id, cantidad, invitacion_id, creado_en) SELECT pg_temp.est(''Ana''), pg_temp.id(''tipo_movimiento_bono'', ''abono''), 5, MIN(id), now() FROM app.invitacion');
SELECT pg_temp.debe_pasar('Consumir el bono con una pregunta respondida', 'INSERT INTO app.movimiento_bono (estudiante_id, tipo_movimiento_bono_id, cantidad, evaluacion_item_id, creado_en) SELECT pg_temp.est(''Ana''), pg_temp.id(''tipo_movimiento_bono'', ''consumo''), 1, MIN(i.id), now() FROM app.evaluacion_item i JOIN app.evaluacion e ON e.id = i.evaluacion_id WHERE e.estudiante_id = pg_temp.est(''Ana'') AND i.tipo_consumo_id = pg_temp.id(''tipo_consumo'', ''bono'')');

-- ---------- 13. Suscripciones y pagos ----------
SELECT pg_temp.grupo('13. Suscripciones y pagos');
INSERT INTO app.suscripcion (estudiante_id, plan_id, estado_suscripcion_id, vigente, canal_venta_id, creado_en)
SELECT pg_temp.est('Caro'), MIN(id), pg_temp.id('estado_suscripcion', 'activa'), false, pg_temp.id('canal_venta', 'google_play'), now() FROM contenido.plan;
SELECT pg_temp.debe_ser('La marca vigente la copia la base desde el estado', 'SELECT vigente::text FROM app.suscripcion WHERE estudiante_id = pg_temp.est(''Caro'')', 'true');
SELECT pg_temp.debe_fallar('Dos suscripciones vigentes del mismo estudiante',
  'INSERT INTO app.suscripcion (estudiante_id, plan_id, estado_suscripcion_id, vigente, canal_venta_id, creado_en) SELECT pg_temp.est(''Caro''), MAX(id), pg_temp.id(''estado_suscripcion'', ''pendiente''), true, pg_temp.id(''canal_venta'', ''app_store''), now() FROM contenido.plan');
SELECT pg_temp.debe_pasar('Una vencida y una nueva vigente', 'UPDATE app.suscripcion SET estado_suscripcion_id = pg_temp.id(''estado_suscripcion'', ''vencida'') WHERE estudiante_id = pg_temp.est(''Caro''); INSERT INTO app.suscripcion (estudiante_id, plan_id, estado_suscripcion_id, vigente, canal_venta_id, creado_en) SELECT pg_temp.est(''Caro''), MAX(id), pg_temp.id(''estado_suscripcion'', ''pendiente''), true, pg_temp.id(''canal_venta'', ''app_store''), now() FROM contenido.plan');
SELECT pg_temp.debe_fallar('Cambio de estado por la tienda sin su aviso',
  'INSERT INTO app.suscripcion_evento (suscripcion_id, estado_nuevo_id, plan_nuevo_id, origen_evento_id, creado_en) SELECT MIN(id), pg_temp.id(''estado_suscripcion'', ''activa''), MIN(plan_id), pg_temp.id(''origen_evento'', ''pasarela''), now() FROM app.suscripcion');
-- Historial con el plan anterior y el nuevo (RN-17). sub() es la primera suscripción; parte pendiente en el plan Una prueba mensual.
CREATE FUNCTION pg_temp.sub() RETURNS BIGINT LANGUAGE sql AS $$ SELECT MIN(id) FROM app.suscripcion $$;
CREATE FUNCTION pg_temp.plan(nom TEXT) RETURNS SMALLINT LANGUAGE sql AS $$ SELECT id FROM contenido.plan WHERE nombre = nom $$;
UPDATE app.suscripcion SET plan_id = pg_temp.plan('Una prueba mensual') WHERE id = pg_temp.sub();
INSERT INTO app.suscripcion_evento (suscripcion_id, estado_nuevo_id, plan_nuevo_id, origen_evento_id, creado_en)
SELECT s.id, pg_temp.id('estado_suscripcion', 'pendiente'), s.plan_id, pg_temp.id('origen_evento', 'estudiante'), now() FROM app.suscripcion s WHERE s.id = pg_temp.sub();
SELECT pg_temp.debe_fallar('Modificar el historial de una suscripción', 'UPDATE app.suscripcion_evento SET detalle = ''x''');
CREATE FUNCTION pg_temp.evento_sql(est_ant TEXT, plan_ant TEXT, est_nuevo TEXT, plan_nuevo TEXT, origen TEXT, aviso TEXT DEFAULT NULL) RETURNS TEXT LANGUAGE sql AS $$
  SELECT format('INSERT INTO app.suscripcion_evento (suscripcion_id, estado_anterior_id, plan_anterior_id, estado_nuevo_id, plan_nuevo_id, origen_evento_id, evento_pasarela_id, creado_en) '
             || 'VALUES (%s, %s, %s, %s, %s, %s, %s, now())', pg_temp.sub(), COALESCE(pg_temp.id('estado_suscripcion', est_ant)::text, 'NULL'),
                COALESCE(pg_temp.plan(plan_ant)::text, 'NULL'), COALESCE(pg_temp.id('estado_suscripcion', est_nuevo)::text, 'NULL'),
                COALESCE(pg_temp.plan(plan_nuevo)::text, 'NULL'), pg_temp.id('origen_evento', origen),
                COALESCE((SELECT id FROM app.evento_pasarela WHERE id_evento_pasarela = aviso)::text, 'NULL')) $$;
SELECT pg_temp.debe_ser('El primer registro guarda el plan con que nace la suscripción y no tiene plan anterior',
  'SELECT p.nombre || '':'' || COALESCE(e.plan_anterior_id::text, ''-'') FROM app.suscripcion_evento e JOIN contenido.plan p ON p.id = e.plan_nuevo_id WHERE e.suscripcion_id = pg_temp.sub()', 'Una prueba mensual:-');
SELECT pg_temp.debe_fallar('Registro sin el plan nuevo', pg_temp.evento_sql('pendiente', 'Una prueba mensual', 'activa', NULL, 'sistema'));
SELECT pg_temp.debe_fallar('Segundo registro sin estado ni plan anterior', pg_temp.evento_sql(NULL, NULL, 'activa', 'Una prueba mensual', 'sistema'));
SELECT pg_temp.debe_fallar('Registro con estado anterior y sin plan anterior', pg_temp.evento_sql('pendiente', NULL, 'activa', 'Una prueba mensual', 'sistema'));
SELECT pg_temp.debe_fallar('Registro que no parte del último estado (salto en el historial)', pg_temp.evento_sql('activa', 'Una prueba mensual', 'cancelada', 'Una prueba mensual', 'sistema'));
SELECT pg_temp.debe_fallar('Registro que no parte del último plan', pg_temp.evento_sql('pendiente', 'Todas las pruebas mensual', 'activa', 'Todas las pruebas mensual', 'sistema'));
SELECT pg_temp.debe_pasar('Cambio de estado con el mismo plan: de pendiente a activa', pg_temp.evento_sql('pendiente', 'Una prueba mensual', 'activa', 'Una prueba mensual', 'sistema'));
INSERT INTO app.evento_pasarela (canal_venta_id, id_evento_pasarela, tipo, suscripcion_id, resultado_evento_id, recibido_en)
VALUES (pg_temp.id('canal_venta', 'google_play'), 'cambio-1', 'SUBSCRIPTION_PURCHASED', pg_temp.sub(), pg_temp.id('resultado_evento', 'procesado'), now());
SELECT pg_temp.debe_pasar('Cambio de plan con el mismo estado: sube a Todas las pruebas cuando la tienda lo confirma',
  pg_temp.evento_sql('activa', 'Una prueba mensual', 'activa', 'Todas las pruebas mensual', 'pasarela', 'cambio-1') || '; UPDATE app.suscripcion SET plan_id = pg_temp.plan(''Todas las pruebas mensual'') WHERE id = pg_temp.sub()');
SELECT pg_temp.debe_fallar('Registro sin ningún cambio de estado ni de plan', pg_temp.evento_sql('activa', 'Todas las pruebas mensual', 'activa', 'Todas las pruebas mensual', 'sistema'));
SELECT pg_temp.debe_pasar('Cambio de periodicidad con el mismo estado: pasa de mensual a anual', pg_temp.evento_sql('activa', 'Todas las pruebas mensual', 'activa', 'Todas las pruebas anual', 'estudiante'));
SELECT pg_temp.debe_pasar('Cambio de estado y de plan en el mismo registro', pg_temp.evento_sql('activa', 'Todas las pruebas anual', 'en_mora', 'Una prueba anual', 'sistema'));
SELECT pg_temp.debe_ser('La línea de tiempo muestra cada estado y cada plan, del primero al último',
  'SELECT string_agg(es.codigo || '' '' || p.nombre, '' / '' ORDER BY e.id) FROM app.suscripcion_evento e JOIN contenido.estado_suscripcion es ON es.id = e.estado_nuevo_id JOIN contenido.plan p ON p.id = e.plan_nuevo_id WHERE e.suscripcion_id = pg_temp.sub()',
  'pendiente Una prueba mensual / activa Una prueba mensual / activa Todas las pruebas mensual / activa Todas las pruebas anual / en_mora Una prueba anual');
SELECT pg_temp.debe_fallar('Primer registro de otra suscripción con plan anterior',
  'INSERT INTO app.suscripcion_evento (suscripcion_id, plan_anterior_id, estado_nuevo_id, plan_nuevo_id, origen_evento_id, creado_en) SELECT MAX(id), pg_temp.plan(''Una prueba mensual''), pg_temp.id(''estado_suscripcion'', ''pendiente''), pg_temp.plan(''Una prueba anual''), pg_temp.id(''origen_evento'', ''estudiante''), now() FROM app.suscripcion');
SELECT pg_temp.debe_fallar('Aviso de la tienda con error y sin motivo',
  'INSERT INTO app.evento_pasarela (canal_venta_id, id_evento_pasarela, tipo, resultado_evento_id, recibido_en) VALUES (pg_temp.id(''canal_venta'', ''google_play''), ''m-1'', ''SUBSCRIPTION_RENEWED'', pg_temp.id(''resultado_evento'', ''error''), now())');
SELECT pg_temp.debe_fallar('Mismo aviso de la tienda registrado dos veces',
  'INSERT INTO app.evento_pasarela (canal_venta_id, id_evento_pasarela, tipo, resultado_evento_id, recibido_en) VALUES (1, ''m-2'', ''X'', pg_temp.id(''resultado_evento'', ''ignorado''), now()), (1, ''m-2'', ''X'', pg_temp.id(''resultado_evento'', ''ignorado''), now())');

-- ---------- 14. Intereses de carrera: opcionales, hasta 3, con pruebas y electivo sugeridos ----------
SELECT pg_temp.grupo('14. Intereses de carrera');
CREATE FUNCTION pg_temp.interes(nom TEXT, cods TEXT[]) RETURNS void LANGUAGE sql AS $$
  INSERT INTO app.estudiante_interes_carrera (estudiante_id, area_carrera_id, creado_en)
  SELECT pg_temp.est(nom), a.id, now() FROM unnest(cods) WITH ORDINALITY u(cod, k) JOIN contenido.area_carrera a ON a.codigo = u.cod ORDER BY u.k $$;
SELECT pg_temp.debe_pasar('Marcar tres áreas de carrera', 'SELECT pg_temp.interes(''Ana'', ARRAY[''salud'', ''educacion'', ''derecho''])');
SELECT pg_temp.debe_fallar('Marcar una cuarta área de carrera', 'SELECT pg_temp.interes(''Ana'', ARRAY[''economia_negocios''])');
SELECT pg_temp.debe_fallar('Marcar cuatro áreas de carrera de una vez', 'SELECT pg_temp.interes(''Caro'', ARRAY[''salud'', ''educacion'', ''derecho'', ''economia_negocios''])');
SELECT pg_temp.debe_fallar('Marcar dos veces la misma área de carrera', 'SELECT pg_temp.interes(''Caro'', ARRAY[''salud'', ''salud''])');
SELECT pg_temp.debe_fallar('Marcar un área de carrera que ya no se ofrece',
  'UPDATE contenido.area_carrera SET activo = false WHERE codigo = ''arte_arquitectura''; SELECT pg_temp.interes(''Caro'', ARRAY[''arte_arquitectura''])');
SELECT pg_temp.debe_pasar('Cambiar un interés: quitar uno y marcar otro',
  'DELETE FROM app.estudiante_interes_carrera WHERE estudiante_id = pg_temp.est(''Ana'') AND area_carrera_id = (SELECT id FROM contenido.area_carrera WHERE codigo = ''derecho''); SELECT pg_temp.interes(''Ana'', ARRAY[''economia_negocios''])');
SELECT pg_temp.debe_ser('Al marcar Salud se sugieren Competencia Lectora, M1 y Ciencias con el electivo Biología',
  'SELECT string_agg(p.codigo, '','' ORDER BY p.codigo) || '' '' || a.nombre FROM contenido.area_carrera ac JOIN contenido.area a ON a.id = ac.electivo_area_id JOIN contenido.area_carrera_prueba x ON x.area_carrera_id = ac.id JOIN contenido.prueba p ON p.id = x.prueba_id WHERE ac.codigo = ''salud'' GROUP BY a.nombre', 'CIE,CL,M1 Biología');
SELECT pg_temp.debe_ser('Pruebas sugeridas a Ana por sus tres intereses, sin repetir',
  'SELECT string_agg(DISTINCT p.codigo, '','' ORDER BY p.codigo) FROM app.estudiante_interes_carrera i JOIN contenido.area_carrera_prueba x ON x.area_carrera_id = i.area_carrera_id JOIN contenido.prueba p ON p.id = x.prueba_id WHERE i.estudiante_id = pg_temp.est(''Ana'')', 'CIE,CL,HCS,M1,M2');
SELECT pg_temp.debe_fallar('Borrar un área de carrera que un estudiante marcó',
  'DELETE FROM contenido.area_carrera_prueba WHERE area_carrera_id = (SELECT id FROM contenido.area_carrera WHERE codigo = ''salud''); DELETE FROM contenido.area_carrera WHERE codigo = ''salud''');

-- ---------- 15. Puntajes PAES: permiso del documento de puntajes, propio y vigente ----------
SELECT pg_temp.grupo('15. Puntajes PAES');
INSERT INTO app.consentimiento (estudiante_id, documento_legal_id, aceptado_en)
SELECT pg_temp.est(v.nom), d.id, now() FROM (VALUES ('Ana'), ('Caro')) v(nom), contenido.documento_legal d
 WHERE d.tipo_documento_legal_id = pg_temp.id('tipo_documento_legal', 'puntajes');
CREATE FUNCTION pg_temp.permiso(nom TEXT, tipo TEXT) RETURNS BIGINT LANGUAGE sql AS $$
  SELECT MAX(c.id) FROM app.consentimiento c JOIN contenido.documento_legal d ON d.id = c.documento_legal_id
   WHERE c.estudiante_id = pg_temp.est(nom) AND d.tipo_documento_legal_id = pg_temp.id('tipo_documento_legal', tipo) $$;
CREATE FUNCTION pg_temp.puntaje_sql(nom TEXT, prueba TEXT, permiso_de TEXT, tipo TEXT, puntaje INT) RETURNS TEXT LANGUAGE sql AS $$
  SELECT format('INSERT INTO app.puntaje_paes (estudiante_id, prueba_id, consentimiento_id, anio_admision, puntaje, creado_en) SELECT %s, id, %s, 2026, %s, now() FROM contenido.prueba WHERE codigo = %L',
                pg_temp.est(nom), pg_temp.permiso(permiso_de, tipo), puntaje, prueba) $$;
SELECT pg_temp.debe_fallar('Cargar un puntaje con el permiso de los términos y condiciones', pg_temp.puntaje_sql('Ana', 'M1', 'Ana', 'terminos', 650));
SELECT pg_temp.debe_fallar('Cargar un puntaje con el permiso de otro estudiante', pg_temp.puntaje_sql('Ana', 'M1', 'Caro', 'puntajes', 650));
SELECT pg_temp.debe_pasar('Cargar un puntaje con el permiso vigente de puntajes', pg_temp.puntaje_sql('Ana', 'M1', 'Ana', 'puntajes', 650));
SELECT pg_temp.debe_fallar('Puntaje fuera del rango de 100 a 1.000', pg_temp.puntaje_sql('Ana', 'CL', 'Ana', 'puntajes', 1200));
SELECT pg_temp.debe_fallar('Cargar un puntaje con el permiso revocado',
  format('UPDATE app.consentimiento SET revocado_en = now() WHERE id = %s; %s', pg_temp.permiso('Caro', 'puntajes'), pg_temp.puntaje_sql('Caro', 'M1', 'Caro', 'puntajes', 600)));

-- ---------- 16. Preguntas extra: abonos por invitación verificada, consumos al responder y saldo nunca negativo ----------
SELECT pg_temp.grupo('16. Preguntas extra');
INSERT INTO app.estudiante (nombre, correo, hash_contrasena, codigo_invitacion, anio_egreso, creado_en) VALUES
  ('Eva', 'eva@prueba.cl', 'x', 'EVAAA2', 2026, now()), ('Fede', 'fede@prueba.cl', 'x', 'FEDEE2', 2028, now()), ('Gabi', 'gabi@prueba.cl', 'x', 'GABAA2', 2028, now());
INSERT INTO app.invitacion (invitante_id, invitado_id, registrado_en, verificado_en, bono_entregado) VALUES
  (pg_temp.est('Eva'), pg_temp.est('Fede'), now(), now(), true), (pg_temp.est('Eva'), pg_temp.est('Gabi'), now(), NULL, false);
CREATE FUNCTION pg_temp.inv(invitado TEXT) RETURNS BIGINT LANGUAGE sql AS $$ SELECT id FROM app.invitacion WHERE invitado_id = pg_temp.est(invitado) $$;
CREATE FUNCTION pg_temp.mov_sql(nom TEXT, tipo TEXT, cantidad INT, invitacion BIGINT, item BIGINT) RETURNS TEXT LANGUAGE sql AS $$
  SELECT format('INSERT INTO app.movimiento_bono (estudiante_id, tipo_movimiento_bono_id, cantidad, invitacion_id, evaluacion_item_id, creado_en) VALUES (%s, %s, %s, %s, %s, now())',
                pg_temp.est(nom), pg_temp.id('tipo_movimiento_bono', tipo), cantidad, COALESCE(invitacion::text, 'NULL'), COALESCE(item::text, 'NULL')) $$;
SELECT pg_temp.debe_fallar('Abono por una invitación cuyo invitado no verificó su correo', pg_temp.mov_sql('Eva', 'abono', 5, pg_temp.inv('Gabi'), NULL));
SELECT pg_temp.debe_fallar('Abono por una invitación que hizo otro estudiante', pg_temp.mov_sql('Caro', 'abono', 5, pg_temp.inv('Fede'), NULL));
SELECT pg_temp.debe_fallar('Abono que nace de una respuesta y no de una invitación', pg_temp.mov_sql('Ana', 'abono', 5, NULL, (SELECT MIN(id) FROM app.evaluacion_item)));
SELECT pg_temp.debe_pasar('Abono por una invitación verificada', pg_temp.mov_sql('Eva', 'abono', 5, pg_temp.inv('Fede'), NULL));
-- Pregunta publicada (versión vigente, no anulada) de un eje de M1 con la dificultad dada.
CREATE FUNCTION pg_temp.pqp(eje_nombre TEXT, dif TEXT, k INT DEFAULT 1) RETURNS BIGINT LANGUAGE sql AS $$
  SELECT p.id FROM contenido.pregunta p JOIN contenido.estado_pregunta ep ON ep.id = p.estado_pregunta_id AND ep.visible_estudiante
    JOIN contenido.pregunta_version v ON v.pregunta_id = p.id AND v.version = p.version JOIN contenido.eje_tematico e ON e.id = v.eje_id
   WHERE e.prueba_id = pg_temp.m1() AND e.nombre = eje_nombre AND v.dificultad_id = pg_temp.id('dificultad', dif)
   ORDER BY p.id OFFSET k - 1 LIMIT 1 $$;
DO $$ DECLARE ev BIGINT; i1 BIGINT; i2 BIGINT; i3 BIGINT;
BEGIN
  ev := pg_temp.iniciar('Eva', 'practica', 5);
  i1 := pg_temp.item(ev, 1, pg_temp.pqp('Números', 'facil'));
  i2 := pg_temp.item(ev, 2, pg_temp.pqp('Geometría', 'facil'));
  i3 := pg_temp.item(ev, 3, pg_temp.pqp('Álgebra y funciones', 'facil'));
  PERFORM pg_temp.responder(i1, 'A', 'bono');
  PERFORM pg_temp.responder(i2, 'A', 'bono');
  PERFORM pg_temp.responder(i3, 'A', 'cupo');
  PERFORM pg_temp.debe_fallar('Consumir más preguntas extra que el saldo (6 con saldo 5)', pg_temp.mov_sql('Eva', 'consumo', 6, NULL, i1));
  PERFORM pg_temp.debe_pasar('Consumir una pregunta extra con saldo', pg_temp.mov_sql('Eva', 'consumo', 1, NULL, i1));
  PERFORM pg_temp.debe_fallar('Consumo con la respuesta de otro estudiante', pg_temp.mov_sql('Ana', 'consumo', 1, NULL, i2));
  PERFORM pg_temp.debe_fallar('Consumo con una respuesta descontada del cupo del día', pg_temp.mov_sql('Eva', 'consumo', 1, NULL, i3));
  PERFORM pg_temp.debe_fallar('Consumo que apunta a una invitación', pg_temp.mov_sql('Eva', 'consumo', 1, pg_temp.inv('Gabi'), NULL));
  PERFORM pg_temp.debe_fallar('Borrar el abono ya usado (el saldo quedaría negativo)',
    format('DELETE FROM app.movimiento_bono WHERE estudiante_id = %s AND tipo_movimiento_bono_id = %s', pg_temp.est('Eva'), pg_temp.id('tipo_movimiento_bono', 'abono')));
  PERFORM pg_temp.debe_ser('Saldo de preguntas extra de Eva: 5 abonadas y 1 usada',
    format('SELECT SUM(t.signo * m.cantidad)::text FROM app.movimiento_bono m JOIN contenido.tipo_movimiento_bono t ON t.id = m.tipo_movimiento_bono_id WHERE m.estudiante_id = %s', pg_temp.est('Eva')), '4');
  PERFORM app.cerrar_evaluacion(ev, 'entregada');
END $$;

-- ---------- 17. Práctica por habilidad: solo en tipos que dejan elegir, de la misma prueba y sin eje ni contenido ----------
SELECT pg_temp.grupo('17. Práctica por habilidad');
CREATE FUNCTION pg_temp.iniciar_hab(nom TEXT, tipo TEXT, hab TEXT, prueba_hab TEXT DEFAULT 'M1', eje SMALLINT DEFAULT NULL, minutos INT DEFAULT NULL) RETURNS BIGINT LANGUAGE sql AS $$
  INSERT INTO app.evaluacion (estudiante_id, tipo_evaluacion_id, unica_por_anio_escolar, prueba_id, estructura_id, eje_id, habilidad_id,
                              anio_escolar, cantidad_preguntas, duracion_min, estado_evaluacion_id, iniciada_en, vence_en)
  SELECT pg_temp.est(nom), s.tipo_evaluacion_id, false, s.prueba_id, s.id, eje,
         (SELECT h.id FROM contenido.habilidad h JOIN contenido.prueba p ON p.id = h.prueba_id WHERE h.codigo = hab AND p.codigo = prueba_hab),
         0, 5, minutos, pg_temp.id('estado_evaluacion', 'en_curso'), now(), now() + minutos * INTERVAL '1 minute'
    FROM contenido.estructura_evaluacion s WHERE s.tipo_evaluacion_id = pg_temp.id('tipo_evaluacion', tipo) AND s.prueba_id = pg_temp.m1()
  RETURNING id $$;
DO $$ DECLARE pid BIGINT; ev BIGINT;
BEGIN
  pid := pg_temp.borrador_m1((SELECT MIN(id) FROM contenido.contenido_tematico WHERE prueba_id = pg_temp.m1()));
  UPDATE contenido.pregunta SET habilidad_id = (SELECT id FROM contenido.habilidad WHERE prueba_id = pg_temp.m1() AND codigo = 'MOD') WHERE id = pid;
  PERFORM pg_temp.publicar(pid, 'media');
  PERFORM pg_temp.debe_fallar('Diagnóstico eligiendo una habilidad', format('SELECT pg_temp.iniciar_hab(%L, %L, %L, %L, NULL, 33)', 'Eva', 'diagnostico', 'RP', 'M1'));
  PERFORM pg_temp.debe_fallar('Práctica de M1 con una habilidad de Competencia Lectora', format('SELECT pg_temp.iniciar_hab(%L, %L, %L, %L)', 'Eva', 'practica', 'LOC', 'CL'));
  PERFORM pg_temp.debe_fallar('Práctica eligiendo un eje y una habilidad a la vez',
    format('SELECT pg_temp.iniciar_hab(%L, %L, %L, %L, %s::smallint)', 'Eva', 'practica', 'RP', 'M1', (SELECT id FROM contenido.eje_tematico WHERE prueba_id = pg_temp.m1() AND nombre = 'Números')));
  ev := pg_temp.iniciar_hab('Eva', 'practica', 'MOD');
  PERFORM pg_temp.debe_pasar('Práctica de Modelar: entrega una pregunta de esa habilidad', format('SELECT pg_temp.item(%s, 1, %s)', ev, pid));
  PERFORM pg_temp.debe_fallar('Práctica de Modelar: rechaza una pregunta de Resolver problemas', format('SELECT pg_temp.item(%s, 2, %s)', ev, pg_temp.pqp('Números', 'facil')));
  PERFORM pg_temp.debe_fallar('Cambiar la habilidad de una práctica ya armada',
    format('UPDATE app.evaluacion SET habilidad_id = (SELECT id FROM contenido.habilidad WHERE prueba_id = %s AND codigo = %L) WHERE id = %s', pg_temp.m1(), 'RP', ev));
  PERFORM pg_temp.debe_ser('El historial muestra la habilidad elegida',
    format('SELECT h.codigo FROM app.evaluacion e JOIN contenido.habilidad h ON h.id = e.habilidad_id WHERE e.id = %s', ev), 'MOD');
  PERFORM app.cerrar_evaluacion(ev, 'abandonada');
END $$;

-- ---------- 18. Listas de opciones nuevas y productos de cada tienda ----------
SELECT pg_temp.grupo('18. Listas de opciones y tiendas');
SELECT pg_temp.debe_fallar('Movimiento de preguntas extra con signo 2', 'UPDATE contenido.tipo_movimiento_bono SET signo = 2 WHERE codigo = ''abono''');
SELECT pg_temp.debe_fallar('Dos tipos de movimiento con el mismo signo', 'UPDATE contenido.tipo_movimiento_bono SET signo = 1 WHERE codigo = ''consumo''');
SELECT pg_temp.debe_fallar('Enlace por correo con 0 horas de vigencia', 'UPDATE contenido.tipo_token_correo SET horas_vigencia = 0 WHERE codigo = ''recuperacion''');
SELECT pg_temp.debe_pasar('Enlace de verificación del correo con la vigencia de su tipo',
  'INSERT INTO app.token_correo (estudiante_id, tipo_token_correo_id, hash_token, hash_codigo, expira_en) SELECT pg_temp.est(''Eva''), id, ''h-1'', ''c-1'', now() + horas_vigencia * INTERVAL ''1 hour'' FROM contenido.tipo_token_correo WHERE codigo = ''verificacion''');
SELECT pg_temp.debe_fallar('Enlace por correo de un tipo que no existe', 'INSERT INTO app.token_correo (estudiante_id, tipo_token_correo_id, hash_token, expira_en) VALUES (pg_temp.est(''Eva''), 99, ''h-2'', now())');
SELECT pg_temp.debe_ser('Los datos iniciales traen el producto de los 4 planes en Google Play y en la App Store',
  'SELECT COUNT(*) || ''/'' || COUNT(DISTINCT plan_id) || ''/'' || COUNT(DISTINCT canal_venta_id) FROM contenido.plan_producto_tienda', '8/4/2');
SELECT pg_temp.debe_pasar('Cambiar el producto de un plan en Google Play',
  'UPDATE contenido.plan_producto_tienda SET id_producto = ''supera.una_prueba.mensual'' WHERE canal_venta_id = pg_temp.id(''canal_venta'', ''google_play'') AND plan_id = (SELECT id FROM contenido.plan WHERE nombre = ''Una prueba mensual'')');
SELECT pg_temp.debe_fallar('El mismo producto de una tienda en dos planes',
  'UPDATE contenido.plan_producto_tienda SET id_producto = ''supera.una_prueba.mensual'' WHERE canal_venta_id = pg_temp.id(''canal_venta'', ''google_play'') AND plan_id = (SELECT id FROM contenido.plan WHERE nombre = ''Una prueba anual'')');
SELECT pg_temp.debe_fallar('Dos productos del mismo plan en la misma tienda',
  'INSERT INTO contenido.plan_producto_tienda (plan_id, canal_venta_id, id_producto) SELECT p.id, pg_temp.id(''canal_venta'', ''app_store''), ''otro'' FROM contenido.plan p WHERE p.nombre = ''Una prueba mensual''');

-- ---------- 19. Estructura y tablas de conversión por electivo ----------
SELECT pg_temp.grupo('19. Electivo de Ciencias y tablas');
CREATE FUNCTION pg_temp.area(nom TEXT) RETURNS SMALLINT LANGUAGE sql AS $$ SELECT id FROM contenido.area WHERE nombre = nom $$;
CREATE FUNCTION pg_temp.est_id(tipo TEXT, prueba TEXT) RETURNS INTEGER LANGUAGE sql AS $$
  SELECT s.id FROM contenido.estructura_evaluacion s JOIN contenido.tipo_evaluacion t ON t.id = s.tipo_evaluacion_id JOIN contenido.prueba p ON p.id = s.prueba_id
   WHERE t.codigo = tipo AND p.codigo = prueba $$;
CREATE FUNCTION pg_temp.tabla(prueba TEXT, electivo TEXT DEFAULT NULL) RETURNS INTEGER LANGUAGE sql AS $$
  SELECT t.id FROM contenido.tabla_conversion t JOIN contenido.prueba p ON p.id = t.prueba_id
   WHERE p.codigo = prueba AND t.anio_admision = 2026 AND t.electivo_area_id IS NOT DISTINCT FROM pg_temp.area(electivo) $$;
-- Inicia una evaluación de cualquier prueba con su electivo y su tabla.
CREATE FUNCTION pg_temp.iniciar_en(nom TEXT, tipo TEXT, prueba TEXT, cantidad INT, minutos INT, electivo TEXT, tabla INTEGER DEFAULT NULL) RETURNS BIGINT LANGUAGE sql AS $$
  INSERT INTO app.evaluacion (estudiante_id, tipo_evaluacion_id, unica_por_anio_escolar, prueba_id, estructura_id, electivo_area_id,
                              anio_escolar, tabla_conversion_id, cantidad_preguntas, duracion_min, estado_evaluacion_id, iniciada_en, vence_en)
  SELECT pg_temp.est(nom), t.id, t.unica_por_anio_escolar, p.id, pg_temp.est_id(tipo, prueba), pg_temp.area(electivo),
         0, tabla, cantidad, minutos, pg_temp.id('estado_evaluacion', 'en_curso'), now(), now() + minutos * INTERVAL '1 minute'
    FROM contenido.tipo_evaluacion t, contenido.prueba p WHERE t.codigo = tipo AND p.codigo = prueba
  RETURNING id $$;
SELECT pg_temp.debe_fallar('Módulo electivo en la estructura de M1',
  format('INSERT INTO contenido.estructura_detalle (estructura_id, prueba_id, es_electivo, cantidad) VALUES (%s, %s, true, 5)', pg_temp.est_id('practica', 'M1'), pg_temp.m1()));
SELECT pg_temp.debe_fallar('Módulo electivo con eje',
  format('UPDATE contenido.estructura_detalle SET eje_id = (SELECT MIN(id) FROM contenido.eje_tematico WHERE prueba_id = prueba_id) WHERE estructura_id = %s AND es_electivo', pg_temp.est_id('ensayo', 'CIE')));
SELECT pg_temp.debe_fallar('Dos módulos electivos en el ensayo de Ciencias',
  format('UPDATE contenido.estructura_detalle SET cantidad = 13 WHERE estructura_id = %1$s AND es_electivo; INSERT INTO contenido.estructura_detalle (estructura_id, prueba_id, es_electivo, cantidad) SELECT %1$s, prueba_id, true, 13 FROM contenido.estructura_evaluacion WHERE id = %1$s', pg_temp.est_id('ensayo', 'CIE')));
SELECT pg_temp.debe_fallar('Preguntas sin puntaje del reparto que no suman las de la estructura (6 en vez de 5)',
  format('UPDATE contenido.estructura_detalle SET no_puntuables = 3 WHERE estructura_id = %s AND es_electivo', pg_temp.est_id('ensayo', 'CIE')));
SELECT pg_temp.debe_fallar('Ensayo de Ciencias sin elegir el electivo', format('SELECT pg_temp.iniciar_en(%L, %L, %L, 80, 160, NULL)', 'Gabi', 'ensayo', 'CIE'));
SELECT pg_temp.debe_fallar('Mini-ensayo de Ciencias sin elegir el electivo', format('SELECT pg_temp.iniciar_en(%L, %L, %L, 27, 54, NULL)', 'Gabi', 'mini_ensayo', 'CIE'));
SELECT pg_temp.debe_fallar('Ensayo de Ciencias con electivo Historia', format('SELECT pg_temp.iniciar_en(%L, %L, %L, 80, 160, %L)', 'Gabi', 'ensayo', 'CIE', 'Historia'));
SELECT pg_temp.debe_fallar('Ensayo de M1 con electivo', format('SELECT pg_temp.iniciar_en(%L, %L, %L, 65, 140, %L, %s)', 'Gabi', 'ensayo', 'M1', 'Biología', pg_temp.tabla('M1')));
SELECT pg_temp.debe_fallar('Ensayo de Ciencias electivo Biología con la tabla de Física',
  format('SELECT pg_temp.iniciar_en(%L, %L, %L, 80, 160, %L, %s)', 'Gabi', 'ensayo', 'CIE', 'Biología', pg_temp.tabla('CIE', 'Física')));
SELECT pg_temp.debe_pasar('Ensayo de Ciencias electivo Biología con la tabla de Biología',
  format('SELECT app.cerrar_evaluacion(pg_temp.iniciar_en(%L, %L, %L, 80, 160, %L, %s), %L)', 'Gabi', 'ensayo', 'CIE', 'Biología', pg_temp.tabla('CIE', 'Biología'), 'abandonada'));
SELECT pg_temp.debe_fallar('Tabla de Ciencias sin electivo',
  'INSERT INTO contenido.tabla_conversion (prueba_id, proceso_admision_id, anio_admision, publicada_en) SELECT id, pg_temp.id(''proceso_admision'', ''invierno''), 2026, DATE ''2026-07-01'' FROM contenido.prueba WHERE codigo = ''CIE''');
SELECT pg_temp.debe_fallar('Tabla de M1 con electivo',
  'INSERT INTO contenido.tabla_conversion (prueba_id, proceso_admision_id, anio_admision, electivo_area_id, publicada_en) VALUES (pg_temp.m1(), pg_temp.id(''proceso_admision'', ''invierno''), 2026, pg_temp.area(''Física''), DATE ''2026-07-01'')');
SELECT pg_temp.debe_fallar('Segunda tabla de Biología del mismo año y proceso',
  'INSERT INTO contenido.tabla_conversion (prueba_id, proceso_admision_id, anio_admision, electivo_area_id, publicada_en) SELECT id, pg_temp.id(''proceso_admision'', ''regular''), 2026, pg_temp.area(''Biología''), DATE ''2026-01-06'' FROM contenido.prueba WHERE codigo = ''CIE''');
SELECT pg_temp.debe_pasar('Tabla de Física del proceso de invierno (otra tabla por electivo)',
  'WITH t AS (INSERT INTO contenido.tabla_conversion (prueba_id, proceso_admision_id, anio_admision, electivo_area_id, publicada_en) SELECT id, pg_temp.id(''proceso_admision'', ''invierno''), 2026, pg_temp.area(''Física''), DATE ''2026-07-01'' FROM contenido.prueba WHERE codigo = ''CIE'' RETURNING id) INSERT INTO contenido.tabla_conversion_fila SELECT t.id, g, 100 + g * 12 FROM t, generate_series(0, 75) g');
SELECT pg_temp.debe_fallar('Tabla con un salto (falta la fila de 2 correctas)',
  'WITH t AS (INSERT INTO contenido.tabla_conversion (prueba_id, proceso_admision_id, anio_admision, publicada_en, cargada_por) VALUES (pg_temp.m1(), pg_temp.id(''proceso_admision'', ''regular''), 2028, DATE ''2027-12-20'', pg_temp.usr(''Admin'')) RETURNING id) INSERT INTO contenido.tabla_conversion_fila SELECT t.id, g, 100 + g * 10 FROM t, generate_series(0, 9) g WHERE g <> 2');
SELECT pg_temp.debe_fallar('Tabla en que el puntaje baja',
  'WITH t AS (INSERT INTO contenido.tabla_conversion (prueba_id, proceso_admision_id, anio_admision, publicada_en, cargada_por) VALUES (pg_temp.m1(), pg_temp.id(''proceso_admision'', ''regular''), 2028, DATE ''2027-12-20'', pg_temp.usr(''Admin'')) RETURNING id) INSERT INTO contenido.tabla_conversion_fila SELECT t.id, g, CASE WHEN g = 5 THEN 100 ELSE 100 + g * 10 END FROM t, generate_series(0, 9) g');
SELECT pg_temp.debe_fallar('Tabla de M1 que llega a 61 correctas (cuentan 60)',
  'WITH t AS (INSERT INTO contenido.tabla_conversion (prueba_id, proceso_admision_id, anio_admision, publicada_en, cargada_por) VALUES (pg_temp.m1(), pg_temp.id(''proceso_admision'', ''regular''), 2028, DATE ''2027-12-20'', pg_temp.usr(''Admin'')) RETURNING id) INSERT INTO contenido.tabla_conversion_fila SELECT t.id, g, 100 + g * 10 FROM t, generate_series(0, 61) g');
SELECT pg_temp.debe_fallar('Borrar una fila del medio de la tabla oficial',
  format('DELETE FROM contenido.tabla_conversion_fila WHERE tabla_conversion_id = %s AND correctas = 30', pg_temp.tabla('M1')));

-- ---------- 20. Puntaje cuando la tabla llega a menos correctas que las preguntas que cuentan ----------
-- Como la tabla oficial de M2, que llega a 49: las correctas se escalan al máximo de la tabla antes de buscar el puntaje.
SELECT pg_temp.grupo('20. Puntaje escalado');
INSERT INTO contenido.tabla_conversion (prueba_id, proceso_admision_id, anio_admision, publicada_en, cargada_por)
VALUES (pg_temp.m1(), pg_temp.id('proceso_admision', 'regular'), 2028, DATE '2027-12-20', pg_temp.usr('Admin'));
INSERT INTO contenido.tabla_conversion_fila SELECT t.id, g, 100 + g * 100 FROM contenido.tabla_conversion t, generate_series(0, 7) g
 WHERE t.prueba_id = pg_temp.m1() AND t.anio_admision = 2028;
DO $$ DECLARE ev BIGINT; it BIGINT; r RECORD; tabla INTEGER;
BEGIN
  SELECT id INTO tabla FROM contenido.tabla_conversion WHERE prueba_id = pg_temp.m1() AND anio_admision = 2028;
  ev := pg_temp.iniciar('Caro', 'ensayo', 10, 22, NULL, NULL, now(), tabla);
  FOR r IN SELECT p.id AS pregunta_id, row_number() OVER (ORDER BY p.id) AS k FROM contenido.pregunta p
             JOIN contenido.estado_pregunta ep ON ep.id = p.estado_pregunta_id AND ep.visible_estudiante
            WHERE p.prueba_id = pg_temp.m1() ORDER BY p.id LIMIT 10 LOOP
    it := pg_temp.item(ev, r.k::int, r.pregunta_id, r.k <> 10);
    IF r.k <= 8 THEN PERFORM pg_temp.responder(it, CASE WHEN r.k <= 6 THEN 'A' ELSE 'D' END); END IF;
  END LOOP;
  PERFORM app.cerrar_evaluacion(ev, 'entregada');
  PERFORM pg_temp.debe_ser('Tabla de 0 a 7 y 9 preguntas que cuentan: 6 correctas equivalen a 5 (600 puntos)',
    format('SELECT puntuables || ''/'' || correctas || ''/'' || puntaje FROM app.resultado_evaluacion WHERE evaluacion_id = %s', ev), '9/6/600');
END $$;

-- ---------- 21. Correos con enlace y código (RN-32) ----------
SELECT pg_temp.grupo('21. Correos con código');
CREATE FUNCTION pg_temp.token_sql(nom TEXT, tipo TEXT, h TEXT, cod TEXT) RETURNS TEXT LANGUAGE sql AS $$
  SELECT format('INSERT INTO app.token_correo (estudiante_id, tipo_token_correo_id, hash_token, hash_codigo, expira_en) SELECT %s, id, %L, %L, now() + horas_vigencia * INTERVAL %L FROM contenido.tipo_token_correo WHERE codigo = %L',
                pg_temp.est(nom), h, cod, '1 hour', tipo) $$;
CREATE FUNCTION pg_temp.token(h TEXT) RETURNS BIGINT LANGUAGE sql AS $$ SELECT id FROM app.token_correo WHERE hash_token = h $$;
SELECT pg_temp.debe_fallar('Correo de verificación sin código', pg_temp.token_sql('Fede', 'verificacion', 'f-0', NULL));
SELECT pg_temp.debe_fallar('Correo de recuperación con código', pg_temp.token_sql('Fede', 'recuperacion', 'f-r0', 'c'));
SELECT pg_temp.debe_fallar('Correo que nace usado',
  'INSERT INTO app.token_correo (estudiante_id, tipo_token_correo_id, hash_token, hash_codigo, expira_en, usado_en) SELECT pg_temp.est(''Fede''), id, ''f-u'', ''c'', now() + INTERVAL ''1 hour'', now() FROM contenido.tipo_token_correo WHERE codigo = ''verificacion''');
SELECT pg_temp.debe_pasar('Primer correo de verificación con enlace y código', pg_temp.token_sql('Fede', 'verificacion', 'f-1', 'c-1'));
SELECT pg_temp.debe_pasar('Pedir otro correo de verificación', pg_temp.token_sql('Fede', 'verificacion', 'f-2', 'c-2'));
SELECT pg_temp.debe_ser('Al pedir otro, el anterior queda anulado y solo uno sirve',
  format('SELECT (SELECT (anulado_en IS NOT NULL)::text FROM app.token_correo WHERE id = %s) || ''/'' || COUNT(*) FROM app.token_correo WHERE estudiante_id = %s AND usado_en IS NULL AND anulado_en IS NULL', pg_temp.token('f-1'), pg_temp.est('Fede')), 'true/1');
SELECT pg_temp.debe_fallar('Usar el enlace del correo anulado', format('UPDATE app.token_correo SET usado_en = now() WHERE id = %s', pg_temp.token('f-1')));
SELECT pg_temp.debe_pasar('Código equivocado 5 veces (se cuentan los intentos)', format('UPDATE app.token_correo SET intentos_fallidos = 5 WHERE id = %s', pg_temp.token('f-2')));
SELECT pg_temp.debe_fallar('Sexto intento con el mismo código', format('UPDATE app.token_correo SET intentos_fallidos = 6 WHERE id = %s', pg_temp.token('f-2')));
SELECT pg_temp.debe_fallar('Volver a cero los intentos', format('UPDATE app.token_correo SET intentos_fallidos = 0 WHERE id = %s', pg_temp.token('f-2')));
SELECT pg_temp.debe_fallar('Cambiar el código de un correo enviado', format('UPDATE app.token_correo SET hash_codigo = %L WHERE id = %s', 'otro', pg_temp.token('f-2')));
SELECT pg_temp.debe_pasar('El correo de recuperación no anula el de verificación', pg_temp.token_sql('Fede', 'recuperacion', 'f-r1', NULL));
SELECT pg_temp.debe_ser('Siguen vigentes uno de cada tipo', format('SELECT COUNT(*)::text FROM app.token_correo WHERE estudiante_id = %s AND usado_en IS NULL AND anulado_en IS NULL', pg_temp.est('Fede')), '2');
SELECT pg_temp.debe_pasar('Usar el enlace de recuperación', format('UPDATE app.token_correo SET usado_en = now() WHERE id = %s', pg_temp.token('f-r1')));
SELECT pg_temp.debe_fallar('Usar dos veces el mismo enlace', format('UPDATE app.token_correo SET usado_en = now() + INTERVAL %L WHERE id = %s', '1 minute', pg_temp.token('f-r1')));

-- ---------- 22. Código de invitación, versión de los documentos legales y racha ----------
SELECT pg_temp.grupo('22. Invitación, versiones y racha');
SELECT pg_temp.debe_fallar('Código de invitación con minúsculas', 'UPDATE app.estudiante SET codigo_invitacion = ''abcdef'' WHERE nombre = ''Gabi''');
SELECT pg_temp.debe_fallar('Código de invitación con la letra O (se confunde con el cero)', 'UPDATE app.estudiante SET codigo_invitacion = ''ABCDO2'' WHERE nombre = ''Gabi''');
SELECT pg_temp.debe_fallar('Código de invitación con el número 1 (se confunde con la I)', 'UPDATE app.estudiante SET codigo_invitacion = ''ABCD12'' WHERE nombre = ''Gabi''');
SELECT pg_temp.debe_fallar('Código de invitación de 5 caracteres', 'UPDATE app.estudiante SET codigo_invitacion = ''ABCD2'' WHERE nombre = ''Gabi''');
SELECT pg_temp.debe_fallar('Código de invitación repetido', 'UPDATE app.estudiante SET codigo_invitacion = ''ANAAA2'' WHERE nombre = ''Gabi''');
SELECT pg_temp.debe_fallar('Versión de documento legal sin número menor', 'INSERT INTO contenido.documento_legal (tipo_documento_legal_id, version, contenido, vigente_desde) VALUES (pg_temp.id(''tipo_documento_legal'', ''terminos''), ''2'', ''x'', now())');
SELECT pg_temp.debe_fallar('Versión de documento legal con letras', 'INSERT INTO contenido.documento_legal (tipo_documento_legal_id, version, contenido, vigente_desde) VALUES (pg_temp.id(''tipo_documento_legal'', ''terminos''), ''v1.1'', ''x'', now())');
SELECT pg_temp.debe_pasar('Publicar la versión 1.1 de la política de privacidad', 'INSERT INTO contenido.documento_legal (tipo_documento_legal_id, version, contenido, vigente_desde) VALUES (pg_temp.id(''tipo_documento_legal'', ''privacidad''), ''1.1'', ''x'', now())');
DO $$ DECLARE ev BIGINT; i1 BIGINT; i2 BIGINT; i3 BIGINT; g BIGINT := pg_temp.est('Gabi');
BEGIN
  ev := pg_temp.iniciar('Gabi', 'practica', 5);
  i1 := pg_temp.item(ev, 1, pg_temp.pqp('Números', 'facil'));
  i2 := pg_temp.item(ev, 2, pg_temp.pqp('Geometría', 'facil'));
  i3 := pg_temp.item(ev, 3, pg_temp.pqp('Álgebra y funciones', 'facil'));
  PERFORM pg_temp.debe_ser('Racha de quien aún no practica', format('SELECT racha_dias || ''/'' || COALESCE(ultimo_dia_practica::text, ''-'') FROM app.estudiante WHERE id = %s', g), '0/-');
  PERFORM pg_temp.responder(i1, 'A', 'cupo');
  PERFORM pg_temp.debe_ser('Primera respuesta: racha de 1 día con el día de hoy (hora de Chile)',
    format('SELECT racha_dias || ''/'' || (ultimo_dia_practica = app.hoy_chile()) FROM app.estudiante WHERE id = %s', g), '1/true');
  UPDATE app.estudiante SET racha_dias = 4, ultimo_dia_practica = app.hoy_chile() - 1 WHERE id = g;
  PERFORM pg_temp.responder(i2, 'A', 'cupo');
  PERFORM pg_temp.debe_ser('Practicó ayer y responde hoy: la racha sube de 4 a 5', format('SELECT racha_dias::text FROM app.estudiante WHERE id = %s', g), '5');
  UPDATE app.estudiante SET racha_dias = 7, ultimo_dia_practica = app.hoy_chile() - 3 WHERE id = g;
  PERFORM pg_temp.responder(i3, 'A', 'cupo');
  PERFORM pg_temp.debe_ser('Pasaron días sin practicar: la racha vuelve a 1', format('SELECT racha_dias::text FROM app.estudiante WHERE id = %s', g), '1');
  PERFORM pg_temp.debe_ser('Otra respuesta el mismo día no suma', format('SELECT pg_temp.responder(pg_temp.item(%s, 4, pg_temp.pqp(%L, %L, 2)), %L, %L); SELECT racha_dias::text FROM app.estudiante WHERE id = %s', ev, 'Números', 'facil', 'A', 'cupo', g), '1');
  PERFORM pg_temp.debe_fallar('Racha negativa', format('UPDATE app.estudiante SET racha_dias = -1 WHERE id = %s', g));
  PERFORM app.cerrar_evaluacion(ev, 'entregada');
END $$;

-- ---------- 23. Lo que recibe la app de cada pregunta (RN-06) ----------
SELECT pg_temp.grupo('23. Lo que recibe la app (RN-06)');
DO $$ DECLARE ev BIGINT; i1 BIGINT; i2 BIGINT; m1 BIGINT;
  oculto CONSTANT TEXT := 'SELECT (NOT corregida AND alternativa_correcta_id IS NULL AND es_correcta IS NULL AND explicacion IS NULL AND alternativas_con_explicacion IS NULL)::text FROM app.v_item_evaluacion WHERE evaluacion_item_id = %s';
  visible CONSTANT TEXT := 'SELECT (corregida AND alternativa_correcta_id IS NOT NULL AND es_correcta IS NOT NULL AND explicacion IS NOT NULL AND alternativas_con_explicacion IS NOT NULL)::text FROM app.v_item_evaluacion WHERE evaluacion_item_id = %s';
BEGIN
  ev := pg_temp.iniciar('Gabi', 'practica', 5);
  i1 := pg_temp.item(ev, 1, pg_temp.pqp('Geometría', 'facil'));
  PERFORM pg_temp.debe_ser('Antes de responder no llegan la clave, la corrección ni las explicaciones', format(oculto, i1), 'true');
  PERFORM pg_temp.debe_ser('Llegan el enunciado y las alternativas de la versión que vio el estudiante',
    format('SELECT enunciado || '':'' || jsonb_array_length(alternativas) || '':'' || (SELECT string_agg(a ->> ''letra'', '''' ORDER BY a ->> ''letra'') FROM jsonb_array_elements(alternativas) a) FROM app.v_item_evaluacion WHERE evaluacion_item_id = %s', i1), 'Enunciado:4:ABCD');
  PERFORM pg_temp.debe_ser('Cada alternativa llega solo con id, letra y texto (sin marca de correcta ni explicación)',
    format('SELECT string_agg(DISTINCT k, '','' ORDER BY k) FROM app.v_item_evaluacion v, jsonb_array_elements(v.alternativas) a, jsonb_object_keys(a) k WHERE v.evaluacion_item_id = %s', i1), 'id,letra,texto');
  PERFORM pg_temp.responder(i1, 'B', 'cupo');
  PERFORM pg_temp.debe_ser('En la práctica, al responder llegan la corrección, la correcta y las explicaciones',
    format('SELECT corregida || '':'' || es_correcta || '':'' || (alternativa_correcta_id = (SELECT id FROM contenido.alternativa a WHERE a.pregunta_id = v.pregunta_id AND a.letra = ''A'')) || '':'' || explicacion || '':'' || jsonb_array_length(alternativas_con_explicacion) FROM app.v_item_evaluacion v WHERE evaluacion_item_id = %s', i1), 'true:false:true:Explicación:4');
  i2 := pg_temp.item(ev, 2, pg_temp.pqp('Geometría', 'facil', 2));
  PERFORM pg_temp.debe_ser('La pregunta siguiente llega sin su clave', format(oculto, i2), 'true');
  PERFORM app.cerrar_evaluacion(ev, 'entregada');
  PERFORM pg_temp.debe_ser('Al cerrar la práctica, la pregunta sin responder muestra la correcta y la explicación, sin marcarse como acierto ni error',
    format('SELECT (corregida AND alternativa_correcta_id IS NOT NULL AND explicacion IS NOT NULL AND es_correcta IS NULL)::text FROM app.v_item_evaluacion WHERE evaluacion_item_id = %s', i2), 'true');
  ev := pg_temp.iniciar('Gabi', 'mini_ensayo', 20, 44);
  m1 := pg_temp.item(ev, 1, pg_temp.pqp('Números', 'media'));
  PERFORM pg_temp.responder(m1, 'A');
  PERFORM pg_temp.debe_ser('En el mini-ensayo, una pregunta respondida no muestra la clave antes de entregar', format(oculto, m1), 'true');
  PERFORM app.cerrar_evaluacion(ev, 'entregada');
  PERFORM pg_temp.debe_ser('Al entregar el mini-ensayo llegan la corrección y las explicaciones', format(visible, m1), 'true');
  PERFORM pg_temp.debe_ser('La vista entrega una fila por cada pregunta del estudiante',
    format('SELECT ((SELECT COUNT(*) FROM app.v_item_evaluacion WHERE estudiante_id = %s) = (SELECT COUNT(*) FROM app.evaluacion_item i JOIN app.evaluacion e ON e.id = i.evaluacion_id WHERE e.estudiante_id = %s))::text', pg_temp.est('Gabi'), pg_temp.est('Gabi')), 'true');
END $$;

-- ---------- Resultado ----------
\o
SELECT n, grupo, caso, esperado, obtenido, left(detalle, 80) AS motivo FROM resultado_caso
 WHERE NOT (obtenido = esperado OR (esperado = 'rechazo' AND obtenido = 'rechazado')) ORDER BY n;
SELECT grupo, COUNT(*) FILTER (WHERE obtenido = esperado OR (esperado = 'rechazo' AND obtenido = 'rechazado')) AS correctos, COUNT(*) AS total
  FROM resultado_caso GROUP BY grupo ORDER BY MIN(n);
SELECT COUNT(*) FILTER (WHERE obtenido = esperado OR (esperado = 'rechazo' AND obtenido = 'rechazado')) AS correctos, COUNT(*) AS total FROM resultado_caso;
\o /tmp/resultado_pruebas_v12.txt
SELECT n, grupo, caso, esperado, obtenido, left(detalle, 100) AS motivo FROM resultado_caso ORDER BY n;
\o
ROLLBACK;
