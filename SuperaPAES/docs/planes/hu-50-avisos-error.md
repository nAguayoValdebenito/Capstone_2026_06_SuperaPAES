# Plan HU-50 · Avisos de error (C13)

Estado: **etapa 1, solo plan. No hay código.** Esperando el visto bueno sobre las decisiones de la sección 9.
Rama: `feat/hu-50-avisos-error` (desde `origin/main` en `ce6556d`). Fecha: 12/11/2026.

## 1. Verificación de alcance

| Fuente | Qué dice |
| --- | --- |
| 03 Historias v1.8, HU-50 | Esc. 1 «Bandeja de avisos»: el sistema muestra los avisos con acceso directo a la pregunta. Esc. 2 «Cierre del aviso»: marcarlo como resuelto o descartado. Esc. 3 «Anular una pregunta»: deja de entregarse, no cuenta en los resultados de las evaluaciones donde apareció y esos resultados se recalculan. |
| 03 Historias v1.8, HU-37 | Un solo escenario: el estudiante elige un motivo y escribe un comentario. |
| 04 Product Backlog | Fila 77, HU-37: 2 puntos, Should, **Pendiente**. Fila 80, HU-50: 5 puntos, Should, **Pendiente**. |
| 05 Sprint Backlog (sprints 4 a 9) | Ninguna de las dos aparece. El Sprint 9 trae HU-39, 46, 47, 57 a 60, 62 y 63. |
| DAS 1.21, RF-C08 | Bandeja de avisos, cerrarlos como resueltos o descartados y anular una pregunta con error, que deja de entregarse y deja de contar en los resultados donde apareció, que se recalculan. HU-50 (pendiente), CU-26 y CU-26a. |
| DAS 1.21, RF-A16 | Avisar que una pregunta tiene un error, con motivo y comentario. HU-37 (pendiente), CU-13. |
| DAS 1.21, CU-26 y CU-26a | Solo aparecen en el índice de casos de uso: «Atender avisos de error (pendiente)» y «Anular pregunta y recalcular resultados (extend, pendiente)». **No tienen ficha con curso normal ni alternativo.** |
| DAS 1.21, RN-22 | Las anuladas no cuentan en el resultado. El resultado queda guardado y solo se recalcula si el administrador anula una pregunta con error. |
| DAS 1.21, CU-30 (historial) 2.b | Si una pregunta fue anulada después, la evaluación muestra el resultado recalculado y lo indica (CU-26a). |
| DAS 1.21, glosario «Pregunta anulada» | Pregunta **publicada** con un error comprobado que el administrador anula: deja de entregarse y no cuenta en los resultados donde apareció, que se recalculan. |
| DAS 1.21, modelo de clases (Pregunta) | Anular marca la pregunta como anulada en las evaluaciones donde apareció, la retira y recalcula esos resultados. |
| DAS 1.21, 7.3 prototipo C13 | Bandeja de avisos con acceso a la pregunta; cerrar como resuelto o descartado y anular la pregunta. HU-50 · CU-26, CU-26a · RF-C08 · RN-22. |
| DAS 1.21, 7.4 flujos | Avisos de error (C13) → Abrir pregunta (C03). |
| Boceto C13 | Tabla con fecha, pregunta, motivo, **cantidad de avisos** y estado; panel con el comentario, «La pregunta aparece en N evaluaciones cerradas», selector Resuelto o Descartado, «Cerrar aviso» y «Anular pregunta» con la advertencia del efecto. El comentario se muestra sin datos del estudiante. |

**Conclusión:** HU-50 no está en ningún sprint. Antes de programar, el equipo debe registrarla en el 04 y en el Sprint Backlog vigente. Como CU-26 y CU-26a no tienen ficha, lo que este plan propone para los cursos alternativos (aviso ya cerrado, pregunta ya anulada, avisos hermanos) son decisiones, no citas.

## 2. Lo que ya existe

**Modelo (sin cambios).**
- `app.reporte_pregunta`: estudiante, pregunta, versión vista, motivo, comentario, estado, `resuelto_por`, `creado_en`, `resuelto_en`. Índice `ix_reporte_pendientes (estado_reporte_id, creado_en)`.
- Listas `contenido.motivo_reporte` (enunciado, alternativas, respuesta, explicacion, otro) y `contenido.estado_reporte` (pendiente; resuelto y descartado con `es_final`).
- Acciones de auditoría `atender_reporte` y `anular_pregunta`.
- `app.anular_pregunta(p_pregunta_id)`: retira la pregunta si está visible para el estudiante, marca `anulada` en **todos** sus ítems (también los de evaluaciones abiertas) y llama a `app.calcular_resultado` en cada evaluación **cerrada** donde aparece, que deja `recalculado_en`. Devuelve cuántas recalculó. El cambio a `retirada` pasa por el disparador de la pregunta: valida la transición y escribe el historial con `supera.usuario_id`.
- La función **no es idempotente en el recálculo**: si se llama dos veces, la segunda vuelve a recalcular todas las evaluaciones cerradas y a mover `recalculado_en`. El servicio debe impedirlo (ver 4.3).

**API.** `preguntas` declara en su repositorio que es dueño de `app.reporte_pregunta` y de `app.anular_pregunta`, pero no hay rutas ni consultas. `preguntas.rutas.app.ts` está vacío. `preguntas.publicacion.servicio.ts` ya resuelve publicar y retirar con transacción, `fijarAutor`, bloqueo de la pregunta y auditoría: es el patrón a seguir.

**Lo que ve el estudiante después de anular (ya construido).**
- Historial (A34): `evaluaciones.historial.repositorio.ts` entrega `recalculadoEn`; la app muestra «Recalculado: se anuló una pregunta con error».
- Resultado: `recalculadoEn` en el resultado; la app muestra el aviso de resultado recalculado.
- Revisión pregunta por pregunta: el ítem trae `anulada` y la app lo marca.
- Progreso y repaso: `app.v_respuesta_valida` excluye `anulada`, así que progreso, ejes a reforzar y preguntas falladas dejan de contarla sin código nuevo.

**Consola.** `paginas/avisos-error/PaginaAvisosError.tsx` muestra `EnConstruccion`; la ruta `/avisos-error` ya está en `secciones.ts`, solo para administrador. C03 se abre en `/banco/:id` y muestra la **versión actual** de la pregunta.

## 3. Dependencia con HU-37

Sin HU-37 nadie crea avisos, así que en uso real la bandeja estaría siempre vacía.

- **a) Solo HU-50 (recomendada).** Las pruebas con PostgreSQL crean los avisos directo en la base. HU-37 queda completa (servidor y A23) para cuando se registre. Mantiene el alcance en lo que pide la historia y no programa una segunda historia pendiente. Para una demostración, los avisos se cargan con un script de SQL fuera del repositorio.
- **b) Servidor de HU-37 en una etapa previa.** Agrega `POST /api/v1/app/preguntas/avisos` (motivo y comentario sobre un ítem que el estudiante recibió, con la versión de ese ítem). Permite crear avisos reales desde la API, pero obliga a registrar también HU-37 en el 04 y el sprint, y a decidir qué módulo valida que el estudiante vio la pregunta (el ítem es de `evaluaciones`, que ya depende de `preguntas`: la ruta iría en `evaluaciones` y este pediría a `preguntas` guardar el aviso). Suma unas 6 horas.

## 4. Módulo responsable y comunicación

| Parte | Dueño | Motivo |
| --- | --- | --- |
| Listar y cerrar avisos | `preguntas` | Es dueño de `app.reporte_pregunta` (CLAUDE.md y arquitectura.md). |
| Anular la pregunta | `preguntas` | Es dueño de la función `app.anular_pregunta` y del estado de la pregunta. La función escribe en tablas de `evaluaciones` (`evaluacion_item`, `resultado_*`), pero eso lo decidió el modelo y ocurre dentro de la base, no por SQL de la API. |
| Contar evaluaciones afectadas antes de anular | `evaluaciones` | Lee sus propias tablas. Una ruta propia en `evaluaciones.rutas.admin.ts`. |
| Nombres de prueba y contenido en la bandeja | `temario` | `preguntas` ya los pide al servicio de temario, como en el banco. |
| Auditoría | `administracion` | `registrarAuditoria(entrada, tx)` dentro de la misma transacción. |

**Por qué el conteo va aparte:** `crearServicios` crea `preguntas` antes que `evaluaciones`, y `evaluaciones` ya recibe `preguntas`. Si `preguntas` pidiera el conteo a `evaluaciones` habría un ciclo. Ninguno de los dos lee el repositorio del otro: la consola pide el conteo a `evaluaciones` al abrir la confirmación y la anulación a `preguntas`.

## 5. Contrato propuesto

Todas con `exigirRol('admin')`, respuesta `{ data, error, meta }` y errores del catálogo.

### 5.1 Listar avisos (HU-50.1, esc. 1)

`GET /api/v1/admin/preguntas/avisos?estado=pendiente&motivo=&pagina=1&porPagina=20`

- `estado`: `pendiente` (por defecto), `resuelto`, `descartado` o `todos`. `motivo`: código de `motivo_reporte`, opcional.
- **Agrupado por pregunta** (como el boceto): una fila por pregunta que tiene al menos un aviso que cumple el filtro, ordenadas por el aviso más reciente. La paginación cuenta preguntas.

```json
{
  "data": [
    {
      "pregunta": {
        "id": "205", "versionActual": 3, "estado": { "codigo": "publicada", "nombre": "Publicada" },
        "prueba": "M1", "contenido": "Función lineal y afín", "resumen": "primeros 120 caracteres del enunciado"
      },
      "pendientes": 3,
      "avisos": [
        {
          "id": "41", "version": 2, "motivo": { "codigo": "respuesta", "nombre": "La respuesta correcta está mal" },
          "comentario": "…", "estado": { "codigo": "pendiente", "nombre": "Pendiente" },
          "creadoEn": "2026-10-20T13:00:00Z", "resueltoEn": null, "resueltoPor": null
        }
      ]
    }
  ],
  "error": null,
  "meta": { "pagina": 1, "porPagina": 20, "total": 4 }
}
```

- No se entrega nada del estudiante (ni id, ni nombre, ni correo). `resueltoPor` es el nombre del administrador.
- Errores: 400 `VALIDACION` (estado o motivo desconocido, página fuera de rango), 401, 403 (docente).

### 5.2 Cerrar un aviso (HU-50.1, esc. 2)

`PATCH /api/v1/admin/preguntas/avisos/:id` con `{ "estado": "resuelto" | "descartado" }`

- En una transacción: bloquea el aviso, lo pasa al estado pedido con `resuelto_por` = administrador y `resuelto_en` = `reloj.ahora()`, y registra `atender_reporte` (`entidad: 'reporte_pregunta'`, antes `{ estado: 'pendiente' }`, después `{ estado, resueltoPor }`).
- Devuelve el aviso actualizado.
- Errores: 404 aviso inexistente; 409 `CONFLICTO` si ya está resuelto o descartado; 400 si el estado no es final.
- **Cierra solo ese aviso.** El DAS no dice si cerrar un aviso cierra los demás de la misma pregunta (RF-C08 y HU-50 esc. 2 hablan de «cerrarlos», y CU-26 no tiene ficha). Es una decisión (sección 9). La recomendación es cerrar de a uno, porque dos avisos de la misma pregunta pueden merecer cierres distintos (uno con razón, otro sin ella).

### 5.3 Anular la pregunta (HU-50.2, esc. 3)

`POST /api/v1/admin/preguntas/:id/anulacion` sin cuerpo.

En una sola transacción:
1. `fijarAutor(administrador)` para que el historial de la pregunta registre quién la retiró.
2. Bloquea la pregunta. 404 si no existe.
3. **Solo se anula una pregunta `publicada`** (glosario del DAS: «pregunta publicada con un error comprobado»). Si está en otra etapa, 409 `CONFLICTO` («La pregunta está «Retirada»: solo se anulan preguntas publicadas»). Esto hace que anular dos veces no vuelva a recalcular ni duplique la auditoría, porque la primera la deja retirada.
4. `SELECT app.anular_pregunta($1)` devuelve las evaluaciones recalculadas.
5. Cierra como `resuelto` todos sus avisos `pendiente`, con autor y fecha.
6. Registra `anular_pregunta` (`entidad: 'pregunta'`, antes `{ estado: 'publicada' }`, después `{ estado: 'retirada', evaluacionesRecalculadas, avisosCerrados: [ids] }`). Los avisos cerrados así no llevan además una fila `atender_reporte` cada uno: quedan dentro de la anulación (decisión, sección 9).

Respuesta:

```json
{ "data": { "preguntaId": "205", "estado": { "codigo": "retirada", "nombre": "Retirada" }, "evaluacionesRecalculadas": 41, "avisosCerrados": 3 }, "error": null, "meta": null }
```

Errores: 404, 409, 403 (docente). Si falla la función, el cierre de avisos o la auditoría, no se guarda nada.

### 5.4 Contar lo que afectaría la anulación

`GET /api/v1/admin/evaluaciones/preguntas/:id/impacto` → `{ "evaluacionesCerradas": 41, "evaluacionesAbiertas": 2 }`

Cuenta las evaluaciones distintas donde aparece la pregunta, con el mismo criterio que la función (`cerrada_en` no nulo). No cambia nada. Es lo que muestra el boceto («La pregunta aparece en 41 evaluaciones cerradas»).

## 6. Riesgo de la anulación

Es irreversible: no hay «desanular» en el modelo ni en el DAS, y cambia resultados ya entregados (porcentaje, puntaje estimado del ensayo, resultado por eje y por habilidad). Por eso: solo administrador, confirmación fuerte con el número de evaluaciones, todo en una transacción y en la auditoría con el antes y el después.

Lo que ve el estudiante después ya está construido (sección 2). Faltan o quedan abiertos estos puntos:

1. **Evaluaciones abiertas.** La función marca `anulada` también los ítems de evaluaciones abiertas, pero el código de `evaluaciones` no mira `anulada` al entregar ni al responder: el estudiante que tiene la pregunta en una evaluación abierta todavía la ve y la puede responder. No cuenta al cerrar, así que el resultado queda bien, pero «deja de entregarse» no se cumple del todo para lo ya asignado. Corregirlo es trabajo de `evaluaciones` y queda fuera de este plan; lo dejo anotado para el equipo.
2. **Nadie avisa al estudiante** de que su resultado cambió, fuera de la marca en historial y resultado. El DAS no pide más (CU-30 2.b).
3. **Estadística por pregunta** (`app.estadistica_pregunta`): nadie la calcula hoy (HU-53), así que no hay nada que corregir.

## 7. Acceso a la pregunta

El enlace «Abrir pregunta» lleva a C03 en `/banco/:id`. C03 muestra la versión **actual**, no la que vio el estudiante, y no existe una vista de versiones anteriores. Propuesta: el panel muestra «Versión reportada 2 · versión actual 3» cuando difieren, para que el administrador sepa que la pregunta cambió desde el aviso. No se construye un visor de versiones.

## 8. Pantalla C13

- Encabezado «Avisos de error» y «Enviados por los estudiantes desde la app».
- Filtros con `Selector`: estado (Pendientes por defecto, Resueltos, Descartados, Todos) y motivo.
- Tabla con `EncabezadoTabla` y `Paginacion`: fecha del último aviso, pregunta (id y prueba), motivo del último aviso, cantidad de avisos y estado con etiqueta de forma y texto (no solo color). La fila se elige con teclado.
- Panel de la pregunta elegida: prueba y contenido, «Abrir pregunta», la lista de sus avisos (motivo, comentario, versión, fecha, estado) y, por cada aviso pendiente, Resolver y Descartar. Un aviso cerrado se muestra sin acciones, con quién y cuándo lo cerró.
- «Anular pregunta» con el botón de peligro, solo si la pregunta está publicada. Abre una confirmación fuerte: explica que deja de entregarse, que no se puede deshacer y que se recalculan los resultados de **N evaluaciones cerradas** (de 5.4), y pide escribir el id de la pregunta o marcar una casilla antes de habilitar «Anular». Escape cierra sin enviar y devuelve el foco al botón.
- Estados: carga (`SegunCarga`), error con reintento (`MensajeError`), vacío «No hay avisos pendientes» y `Alerta` con el resultado de cada acción.
- Lógica en `consola/src/estado/avisos-error.ts`; llamadas en `consola/src/servicios/preguntas.ts` (avisos y anulación) y `servicios/evaluaciones.ts` (impacto). Estilos en `paginas/avisos-error/avisos-error.css`, solo con tokens.

## 9. Decisiones que necesito

| # | Decisión | Recomendación |
| --- | --- | --- |
| D1 | HU-37: opción a (solo HU-50) o b (servidor de HU-37 antes) | **a** |
| D2 | Dueños: `preguntas` para avisos y anulación; `evaluaciones` solo cuenta el impacto en una ruta propia | Como en la sección 4 |
| D3 | Cerrar un aviso como resuelto o descartado: ¿solo ese aviso o todos los pendientes de la pregunta? (el DAS no lo dice) | **Solo ese aviso**. Anular sí cierra todos los pendientes como resueltos, porque lo pide el prompt y la anulación confirma el error |
| D4 | Solo se anula una pregunta publicada (409 si no) | Sí. Una retirada a mano ya no se puede anular; si hiciera falta, se decide aparte |
| D5 | Los avisos cerrados por la anulación quedan dentro de la auditoría `anular_pregunta`, sin una fila `atender_reporte` por aviso | Sí |
| D6 | La bandeja va agrupada por pregunta y pagina por pregunta | Sí, como el boceto |
| D7 | Evaluaciones abiertas que ya tienen la pregunta (6.1) | Anotarlo para el equipo; no se corrige aquí |

## 10. Archivos previstos

**API (etapas 2 y 3):** `preguntas.avisos.repositorio.ts`, `preguntas.avisos.servicio.ts` y `preguntas.anulacion.servicio.ts` (nuevos, para respetar los límites de calidad); cambios en `preguntas.servicio.ts`, `preguntas.controlador.ts`, `preguntas.rutas.admin.ts` y `preguntas.validadores.ts`; en `evaluaciones` un método de conteo en un repositorio y su ruta en `evaluaciones.rutas.admin.ts`; `app.ts` solo si el router admin de evaluaciones necesita otro servicio. Pruebas en `api/pruebas/`.
**Consola (etapa 4):** `estado/avisos-error.ts`, `servicios/preguntas.ts`, `servicios/evaluaciones.ts`, `tipos/`, `paginas/avisos-error/PaginaAvisosError.tsx` y `avisos-error.css`, y sus pruebas.
**Documentos:** este plan, `docs/arquitectura.md` y `docs/pull-requests/HU-50-avisos-error.md`.
Sin cambios en esquema, migraciones ni semillas.

## 11. Plan de pruebas

**HU-50.1 (sin base):** administrador 200; docente 403; token de la app 401; filtros por estado y motivo; validación de parámetros; aviso inexistente 404; aviso ya cerrado 409; la lista no trae datos del estudiante.
**HU-50.1 (con `DATABASE_URL`):** el cierre guarda estado, autor, fecha y auditoría; si la auditoría falla no se guarda nada; agrupación y conteo por pregunta.
**HU-50.2 (con `DATABASE_URL`):** la pregunta queda retirada y deja de aparecer en `v_preguntas_publicadas`; sus ítems quedan anulados; una evaluación cerrada cambia su resultado y queda con `recalculado_en`; una evaluación abierta sigue respondiéndose y al cerrarla no cuenta la anulada; sus avisos pendientes quedan resueltos; anular dos veces da 409 y no vuelve a recalcular ni duplica la auditoría; el historial de la pregunta registra al administrador; docente 403; el conteo de impacto coincide con lo que devuelve la anulación.
**Consola:** carga, error con reintento, vacío, filtros, resolver y descartar, aviso cerrado sin acciones, anular con confirmación (Escape cancela y no envía), aviso de versión distinta, uso con teclado; revisión visual a 1440 y 390 px en claro y oscuro.

Todas las pruebas usan datos inventados, sin material del DEMRE (RN-29) ni datos personales.

## 12. Estimación

| Etapa | Horas |
| --- | --- |
| 2. Bandeja y cierre (HU-50.1) | 6 |
| 3. Anulación e impacto (HU-50.2) | 7 |
| 4. Consola (HU-50.3) | 9 |
| 5. Cierre, documentos y capturas | 3 |
| **Total** | **25** (unas 6 más con la opción b) |

## 13. Commits previstos (3 a 5)

1. `docs(HU-50): plan de avisos de error` (este archivo).
2. `feat(HU-50.1): listar y cerrar avisos de error`.
3. `feat(HU-50.2): anular una pregunta y recalcular resultados`.
4. `feat(HU-50.3): bandeja de avisos de error en la consola (C13)`.
5. `docs(HU-50): arquitectura, descripción del PR y estado del plan`.
