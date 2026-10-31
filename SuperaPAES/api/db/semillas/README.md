# Semillas

Datos de referencia que no vienen en la migración inicial. `npm run semillas -w api` ejecuta en orden
cada archivo `NNN_descripcion.sql` de esta carpeta, cada uno en su propia transacción.

Reglas:

- Cada semilla es **idempotente** y **nunca borra filas** (por ejemplo, `INSERT ... ON CONFLICT DO NOTHING`):
  ejecutarla dos veces deja los mismos conteos.
- Los parámetros del sistema, los planes y la pauta de revisión no van aquí: vienen en
  `db/migraciones/001_esquema_inicial.sql`.

Archivos (modelo 12.0; las semillas no cambiaron respecto del 11.0):

- `001_temario_paes_2027.sql`: copia exacta de
  `docs/base-de-datos/Supera_PAES_Semilla_Temario_PAES_2027.sql` (versión 1.1). Temario PAES
  Regular, Admisión 2027: 6 áreas, 5 pruebas, 19 habilidades, 16 ejes y 85 contenidos, con el curso
  en que se enseña cada uno (salvo Competencia Lectora, que no depende del curso).
- `002_evaluaciones.sql`: copia exacta de `docs/base-de-datos/Supera_PAES_Semilla_Evaluaciones.sql`.
  Estructura de cada evaluación por prueba, pruebas sugeridas por área de carrera y tablas de
  conversión del DEMRE. Necesita el temario: sin él no inserta nada.
- `003_documentos_legales.sql`: copia exacta de
  `docs/base-de-datos/Supera_PAES_Semilla_Documentos_Legales.sql`. Versión 1.0 de los términos, la
  privacidad y el permiso de puntajes, con el correo de contacto superapaes@gmail.com y la vigencia
  del 19 de octubre de 2026. Falta «dirección de la consola» (la dirección pública de la consola en
  Vercel), que se completa antes de publicarla, junto con la revisión de RN-30.
  No reemplaza una versión ya cargada: una base local con el texto anterior se recrea.
- `004_acciones_auditoria_usuarios.sql`: acciones de auditoría para editar y activar usuarios
  internos (HU-04, RF-C02, RNF-08).
- `005_tipos_pregunta_por_prueba.sql`: tipos de pregunta que admite cada prueba
  (`contenido.prueba_tipo_pregunta`): selección múltiple en todas y suficiencia de datos solo en M2.
  Sin estas filas no se guarda ninguna pregunta (HU-12). Necesita el temario.
- `006_acciones_auditoria_textos.sql`: acciones de auditoría para crear y editar textos de lectura
  (HU-12.2, RNF-08).

La semilla `003_documentos_legales.sql` y la migración `003_acciones_usuario_interno.sql` comparten
el número, pero están en carpetas distintas y cada ejecutor lleva su propia cuenta: no chocan.

Los archivos traen su propio `BEGIN;`/`COMMIT;`; el ejecutor los quita y usa su transacción.

`SEMILLAS_OMITIDAS` (nombres separados por comas) deja fuera semillas al cargar. En la base publicada
se usa `SEMILLAS_OMITIDAS=003_documentos_legales.sql` hasta que un docente o el cliente revise los
textos (RN-30). Un nombre que no existe detiene la carga, para no publicar por un error de tipeo.
