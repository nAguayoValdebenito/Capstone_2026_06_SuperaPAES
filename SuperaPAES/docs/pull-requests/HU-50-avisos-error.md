# Avisos de error de los estudiantes (C13, HU-50)

Construye la bandeja de avisos de error y la anulación de preguntas con error (RF-C08, CU-26, CU-26a,
RN-22). HU-50 sigue «Pendiente» en el 04: el equipo debe registrarla en el 04 y en el Sprint Backlog
vigente. HU-37 (el estudiante envía el aviso desde A23) sigue pendiente: las pruebas crean los avisos
directo en la base (decisión D1 del plan `docs/planes/hu-50-avisos-error.md`).

## Contrato

Todas las rutas requieren la sesión de la consola y el rol admin. Respuesta `{ data, error, meta }`.

| Método y ruta | Entrada | data de éxito | Errores |
| --- | --- | --- | --- |
| GET /api/v1/admin/preguntas/avisos | Consulta `estado` (pendiente por defecto, resuelto, descartado o todos), `motivo` (código), `pagina`, `porPagina` | Lista de preguntas: `pregunta` (id, versionActual, estado, prueba, contenido, resumen), `pendientes` y `avisos` (id, version, motivo, comentario, estado, creadoEn, resueltoEn, resueltoPor). `meta` pagina por pregunta | 400 VALIDACION, 401, 403 |
| PATCH /api/v1/admin/preguntas/avisos/:id | `{ estado: "resuelto" \| "descartado" }` | El aviso cerrado, con quién y cuándo | 400, 401, 403, 404, 409 si ya estaba cerrado |
| POST /api/v1/admin/preguntas/:id/anulacion | Sin cuerpo | `{ preguntaId, estado, evaluacionesRecalculadas, avisosCerrados }` | 401, 403, 404, 409 si no está publicada |
| GET /api/v1/admin/evaluaciones/preguntas/:id/impacto | Sin cuerpo | `{ evaluacionesCerradas, evaluacionesAbiertas }` | 400, 401, 403 |

## Decisiones (sección 9 del plan)

- Cerrar un aviso cierra solo ese aviso; el DAS no dice que se cierren los demás de la misma pregunta.
- Solo se anula una pregunta publicada (glosario del DAS). Así anular dos veces da 409 y no recalcula.
- Los avisos que cierra la anulación quedan dentro de la auditoría `anular_pregunta`.
- La bandeja no entrega datos del estudiante.

## Pendiente para el equipo

- En una evaluación abierta, la pregunta anulada se sigue mostrando y se puede responder; al cerrar no
  cuenta. Corregirlo es trabajo del módulo `evaluaciones`.
- CU-26 y CU-26a no tienen ficha en el DAS 1.21.

## Consola (C13)

`/avisos-error`, solo administrador. Bandeja agrupada por pregunta (fecha, pregunta, prueba, motivo,
cantidad y estado con etiqueta de texto), filtros por estado y motivo, paginación, carga, error con
Reintentar y vacío («No hay avisos pendientes.»). El panel de la pregunta abre C03 (`/banco/:id`),
muestra cada aviso con motivo, comentario, fecha y versión (y la actual si cambió), y ofrece Resolver
y Descartar en los pendientes. «Anular pregunta» solo aparece en una publicada y abre una confirmación
fuerte: explica el efecto, muestra cuántas evaluaciones cerradas se recalcularán, exige marcar
«Entiendo que la anulación no se puede deshacer» y se cierra con Escape o Cancelar sin enviar nada,
devolviendo el foco al botón.

Capturas (datos de ejemplo simulados en el navegador, sin la base):

- `capturas/hu-50-c13-confirmar-anular-1440.jpg`: bandeja y confirmación a 1440 px.
- `capturas/hu-50-c13-bandeja-390.jpg` y `capturas/hu-50-c13-detalle-390.jpg`: 390 px, en una columna
  y sin desplazamiento horizontal de la página.

La consola no tiene tema oscuro, así que solo se revisó el claro.

## Verificación

- API sin base: 1.118 pruebas aprobadas (14 nuevas de HU-50), 841 omitidas que necesitan PostgreSQL.
- API con PostgreSQL (`DATABASE_URL_PRUEBAS` sobre una base temporal `_test`): las 6 pruebas nuevas de
  HU-50 aprobadas (bandeja, cierre con autor, fecha y auditoría, auditoría que falla sin guardar nada,
  anulación con recálculo y práctica abierta, anular dos veces sin recalcular).
- Consola: 381 pruebas aprobadas (15 nuevas de C13).
- Lint, Prettier, Madge, jscpd (sin duplicación nueva) y secretlint aprobados para los archivos de
  HU-50. El build y Knip de la rama dependen además de los archivos de HU-51, que comparte la rama.
- Sin cambios en el esquema, las migraciones ni las semillas.
