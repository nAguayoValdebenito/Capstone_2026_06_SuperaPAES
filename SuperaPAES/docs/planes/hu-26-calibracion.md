# Plan HU-26 y HU-53 · Calibración (D04)

Estado: el 13/11/2026 Nicolas respondió «sigue» al plan. Se tomaron D1 (tarea horaria) y D2 (criterio de 3.2), que no tocan el esquema. **Etapa 2 (HU-53.1) construida el 13/11/2026**: `evaluaciones.estadisticas.repositorio.ts` recalcula `app.estadistica_pregunta` y la tarea periódica lo llama al final e informa `estadisticasActualizadas`. Hay pruebas sin base y con PostgreSQL. Ese mismo día Nicolas eligió «la a» para D3 (tabla nueva) y se siguió con las recomendadas de D4 a D7. **Etapa 0 construida**: migración `008_calibracion.sql` (tabla `contenido.calibracion_pregunta`, que no se modifica ni se borra, y las acciones `confirmar_calibracion` y `descartar_calibracion`). probar:bd suma el grupo 25 (274 de 274) y la base queda con 87 tablas y 162 claves foráneas. **Etapa 3 (HU-26.1) construida**: `GET /admin/revision/calibracion` y `POST /admin/revision/calibracion/:id`, solo para el docente. `evaluaciones` entrega las preguntas fuera de rango con `estadisticasFueraDeRango(30)`; `revision` filtra por área y por lo que el docente ya decidió. **Etapa 4 (HU-26.2) construida el 14/11/2026**, con un cambio respecto de 7: el banco no suma el filtro ni las columnas en su propia ruta. `preguntas` se crea antes que `evaluaciones` y `revision`, que dependen de él, así que no puede pedirles datos sin crear un ciclo. En su lugar hay dos rutas del administrador: `GET /admin/revision/calibracion/confirmadas` (las publicadas con alguna confirmación para su versión y dificultad actuales, con sus estadísticas) y `GET /admin/evaluaciones/estadisticas?preguntas=1,2,3` (las estadísticas de una página del banco, hasta 100). La consola las une en C02 en la etapa 5. Retirar, volver a borrador y enviar a revisión siguen con las rutas que ya existían; una prueba con PostgreSQL comprueba que, al retirarla, deja de estar confirmada y de entregarse, y que entra a una ronda nueva con dos revisores. Etapas 5 y 6 pendientes.
Rama: `feat/hu-26-calibracion` (desde `origin/main` en `258001a`). Fecha: 13/11/2026.

## 1. Verificación de alcance

| Fuente | Qué dice |
| --- | --- |
| 03 Historias v1.8, HU-26 | Un escenario, «Bandeja de calibración»: si una pregunta tiene 30 o más respuestas y su dificultad no coincide con los resultados, cuando el docente revisa su bandeja, el sistema la muestra. |
| 03 Historias v1.8, HU-53 | Un escenario, «Estadísticas de la pregunta»: si una pregunta tiene respuestas de estudiantes, **cuando el administrador revisa el banco**, el sistema muestra intentos, porcentaje de acierto y tiempo promedio. |
| 04 Product Backlog | Fila 85, HU-26: 3 puntos, Could, **Pendiente**. Fila 86, HU-53: 3 puntos, Could, **Pendiente**. |
| 05 Sprint Backlog (sprints 4 a 9) | Ninguna de las dos aparece. El Sprint 9 trae HU-39, 46, 47, 57 a 60, 62 y 63. |
| DAS 1.21, RF-G13 | «Calcular estadísticas por pregunta y mostrar en la bandeja de calibración de los docentes las preguntas cuya dificultad no coincide con el porcentaje de acierto.» |
| DAS 1.21, RN-15 | Con 30 o más intentos, la pregunta cuyo acierto no coincide con su dificultad aparece en la bandeja de calibración de **los docentes especialistas del área**; **si confirman** que la dificultad no corresponde, el administrador la retira y la envía a una nueva revisión con dos docentes (RN-10). Rangos guardados en la lista de dificultades: fácil 70 a 100 %, media 40 a 70 %, difícil 0 a 40 %. |
| DAS 1.21, RF-G09 | Una pregunta publicada no se edita: el administrador la retira, vuelve a borrador y se envía a una nueva revisión con dos docentes. |
| DAS 1.21, CU-19 | Referencia RF-G13, RN-15, HU-26 y HU-53, pero **su curso normal y sus alternativos no tienen ningún paso de calibración**. |
| DAS 1.21, CU-25 (pendiente) 4.a | «Las estadísticas de calibración (RF-G13) se agregan con HU-49 y HU-53, también pendientes.» No dice cuándo se calculan. |
| DAS 1.21, 4.3.5 tareas periódicas | Un flujo de GitHub Actions llama cada hora a la ruta protegida: cierra vencidas, avisa renovaciones y, con HU-28, reasignará revisiones vencidas. **No menciona estadísticas.** |
| DAS 1.21, modelo de clases | EstadisticaPregunta: «intentos y porcentaje de acierto de cada pregunta». |
| DAS 1.21, 7.3 prototipo C02 | El banco lista HU-53 (pendiente) entre sus historias. |
| DAS 1.21, 7.3 prototipo D04 | Preguntas con 30 o más intentos fuera de su rango; el docente confirma si la dificultad no corresponde y el administrador la retira y la envía a una nueva revisión. HU-26, HU-53 · CU-19, CU-25 · RF-G13 · RN-15. |
| DAS 1.21, 7.5 navegación | El menú del docente lleva a D01, D02, D03 y D04. |

**Conclusión:** ninguna de las dos historias está en un sprint. Antes de programar, el equipo debe registrarlas en el 04 y en el Sprint Backlog vigente. El DAS fija la regla (30 intentos, rangos, quién ve y quién actúa), pero **no dice** cuándo se calculan las estadísticas, qué respuestas cuentan, cuántos docentes deben confirmar ni qué pasa con un descarte: todo eso, abajo, es decisión, no cita.

## 2. Lo que ya existe

**Modelo (sin cambios).**
- `app.estadistica_pregunta (pregunta_id PK, intentos, aciertos, tiempo_promedio_seg, actualizado_en)`, con `aciertos <= intentos`. **Nadie la llena hoy.** El repositorio de `evaluaciones` la declara como suya.
- `contenido.dificultad.acierto_esperado_min` y `acierto_esperado_max` con 70/100, 40/70 y 0/40.
- `app.evaluacion_item`: `version_pregunta`, `alternativa_id`, `tiempo_seg`, `es_correcta`, `puntuable`, `anulada`. El disparador `tg_item` corrige al responder si el tipo tiene `correccion_inmediata` (práctica y repaso) y al cerrar en los demás (`cerrar_evaluacion` reescribe los ítems; una omitida queda `es_correcta = false`).
- `app.v_respuesta_valida`: respuestas que cuentan para el progreso (tipo con `cuenta_para_progreso`, `es_correcta` no nulo, no anulada). Hoy los cinco tipos cuentan para el progreso.
- `contenido.pregunta.version` y `dificultad_asignada_id`; `contenido.docente_especialidad (usuario_interno_id, area_id)` y `contenido_tematico.area_id` para el área.
- Acciones de auditoría: `retirar_pregunta`, `enviar_a_revision` y otras. **No hay ninguna para confirmar o descartar una calibración.**

**API.** `POST /admin/preguntas/:id/retirar`, `POST /admin/preguntas/:id/borrador` y `POST /admin/revision/preguntas/:id` (enviar a revisión, asigna dos revisores en una ronda nueva) ya existen. La tarea periódica vive en `api/trabajos/tareas-periodicas.ts`.

**Consola.** `paginas/calibracion/PaginaCalibracion.tsx` muestra `EnConstruccion`; la ruta `/calibracion` ya está en `rutas/secciones.ts`, solo para docente. Clasificar dificultad (D03) sale del menú en la rama de HU-25, que aún no está en `main`; esta rama no toca esa entrada.

## 3. Estadísticas por pregunta (HU-53)

### 3.1 Cuándo se actualizan (el DAS no lo dice: decisión D1)

- **a) En la tarea periódica horaria (recomendada).** Una sola consulta recalcula todo desde `app.evaluacion_item` con `INSERT … ON CONFLICT (pregunta_id) DO UPDATE`. Es idempotente por construcción (volver a correrla da lo mismo), capta las evaluaciones que cierra la base en `cerrar_vencidas` y las anulaciones sin tocar esas funciones. El retraso de hasta una hora no importa para un umbral de 30 intentos.
- b) Al corregir cada respuesta, en la misma transacción. En práctica sería en el servicio de respuestas, pero las evaluaciones que cierra `cerrar_vencidas` se corrigen dentro de la base y la API no sabe cuáles: habría que cambiar la función (esquema), y anular una pregunta obligaría a restar. Descartada.
- c) Al cerrar cada evaluación desde la API. Mismo problema con `cerrar_vencidas` y con la práctica, que se corrige al responder.

### 3.2 Qué respuestas cuentan (decisión D2)

Propuesta: las de `app.v_respuesta_valida` (el mismo criterio que el progreso del estudiante, RF-A10), con dos filtros más:
- **Solo respondidas** (`alternativa_id` no nulo): una omitida en un ensayo no es un intento sobre la pregunta. Así la cuenta coincide con «30 o más respuestas» de HU-26.
- **Solo la versión actual** de la pregunta (`version_pregunta = pregunta.version`): si se edita tras una nueva revisión, las respuestas de la versión anterior no deben volver a llevarla a la bandeja.
- Cuentan las no puntuables (las responde el estudiante igual) y no cuentan las anuladas (la vista ya las excluye).
- Tiempo promedio: promedio de `tiempo_seg` no nulos, redondeado a segundos.
- Una pregunta que se queda sin respuestas válidas (por ejemplo, anulada) queda con `intentos = 0`, para no mostrar números viejos.

### 3.3 Dónde vive

En `evaluaciones`, dueño de la tabla y de los ítems: `evaluaciones.estadisticas.repositorio.ts` (la consulta) y un método `recalcularEstadisticas()` en su servicio. La tarea periódica lo llama como a `cerrarVencidas()` y suma `estadisticasActualizadas` al resultado. Una lectura `estadisticasDe(ids)` del mismo servicio la usan `preguntas` (banco) y `revision` (bandeja); ninguno lee la tabla directo.

## 4. Qué preguntas entran a la bandeja

- Estado **publicada** (las que reciben respuestas y que el administrador puede retirar), del área del docente (`docente_especialidad` contra el `area_id` del contenido).
- `intentos >= 30` (fijo en RN-15; no hay parámetro en la configuración).
- Acierto = `100 * aciertos / intentos`, fuera de `[acierto_esperado_min, acierto_esperado_max]` de su `dificultad_asignada_id`. Los extremos cuentan dentro: 70 % no sale de fácil ni de media.
- Sin una confirmación pendiente del mismo docente y sin un descarte suyo para la misma versión y dificultad (sección 5).

## 5. Confirmación del docente: hueco en el modelo (me detengo aquí)

Ninguna tabla actual sirve sin forzarla:

| Candidata | Por qué no |
| --- | --- |
| `contenido.auditoria` | Es un registro de acciones, no un estado que se consulta. Además no hay acción `confirmar_calibracion` ni `descartar_calibracion`: agregarlas ya es un cambio en las semillas. Usar una acción existente (por ejemplo `editar_pregunta`) mentiría en el registro. Para saber qué está pendiente habría que leer el JSON `despues`. |
| `contenido.revision` / `asignacion_revision` | Exigen una asignación con ronda, rol (revisor o desempate), plazo, decisión aprobar/observar/rechazar y dificultad. Una confirmación de calibración no es nada de eso, y crear asignaciones falsas ensuciaría D01, C06 y la combinación de RN-11. |
| `app.reporte_pregunta` | Son avisos de estudiantes, con `estudiante_id` obligatorio y motivos de error. |
| `app.estadistica_pregunta` | Es de `evaluaciones`, una fila por pregunta; no tiene quién confirmó ni cuándo. |

**Cambio de modelo que haría falta (no lo hice):**

- **Opción A (recomendada).** Una migración `008_calibracion.sql` con:
  - `contenido.calibracion_pregunta`: `id`, `pregunta_id`, `version_pregunta`, `dificultad_id` (la que tenía al confirmar), `docente_id`, `dificultad_corresponde BOOLEAN` (false = confirma que no corresponde, true = descarta), `intentos`, `aciertos` (los que vio), `creado_en`. Única por `(pregunta_id, version_pregunta, dificultad_id, docente_id)`. Claves foráneas con `ON DELETE RESTRICT` y comentarios como el resto del modelo. Dueño: `revision`.
  - Dos acciones de auditoría: `confirmar_calibracion` y `descartar_calibracion`.
  - Sin columna de «atendida»: una confirmación está pendiente mientras la pregunta siga publicada con la misma versión y dificultad. Cuando el administrador la retira, deja de estarlo sola.
- Opción B (mínima). Solo las dos acciones de auditoría y guardar la decisión en `contenido.auditoria` con `entidad = 'pregunta'` y el detalle en `despues`. Menos esquema, pero la bandeja y el filtro del banco tendrían que consultar JSON del registro, y la auditoría pasaría a ser estado de negocio.

Las dos requieren cambiar el DAS (modelo de datos, sección 4.4, y la lista de acciones) y el script del modelo en `docs/base-de-datos/`.

## 6. Decisiones para Nicolas

| # | Pregunta | Opciones | Recomendación |
| --- | --- | --- | --- |
| D1 | Cuándo se actualizan las estadísticas | a) tarea horaria; b) al corregir; c) al cerrar | **a** |
| D2 | Qué respuestas cuentan | Las de 3.2 o todas las de `v_respuesta_valida` (con omitidas como no acertadas) | **3.2** |
| D3 | Dónde se guarda la confirmación | A) tabla nueva; B) auditoría con dos acciones nuevas | **A** (requiere aprobar la migración) |
| D4 | Cuántos docentes deben confirmar (RN-15 dice «si confirman», en plural, sin número) | a) basta uno, y el administrador ve cuántos confirmaron y cuántos descartaron; b) dos, como RN-10; c) la mayoría del área | **a**: el administrador decide igual, y con pocos docentes por área b) y c) pueden no cumplirse nunca (lo mismo que pasó con el tercer docente en HU-23) |
| D5 | Qué hace un descarte | a) la quita de la bandeja de ese docente mientras sigan la versión y la dificultad; b) la quita para todos | **a** |
| D6 | Dónde ve el administrador las confirmadas | a) banco (C02) con un filtro «Calibración: confirmada» y las columnas de HU-53; b) panel (C01) | **a**: HU-53 ya pide verlo en el banco, C02 ya tiene retirar, volver a borrador y enviar a revisión, y el panel (CU-25) sigue pendiente |
| D7 | Cómo pasa a la nueva revisión | a) con las tres acciones que ya existen en C02, una tras otra; b) una ruta nueva que haga las tres en una transacción | **a**: no agrega rutas; cada paso ya audita |

## 7. Contrato propuesto (si se aprueba D3 opción A)

Todas con `{ data, error, meta }` y camelCase.

**Docente** (`revision.rutas.admin.ts`, `exigirRol('docente')`):

- `GET /api/v1/admin/revision/calibracion` → `data: ItemCalibracion[]`, `meta: { total }`. Cada ítem: `preguntaId`, `enunciado` (recortado), `prueba`, `contenido`, `dificultad { codigo, nombre, aciertoEsperadoMin, aciertoEsperadoMax }`, `intentos`, `aciertos`, `porcentajeAcierto` (un decimal), `tiempoPromedioSeg`, `confirmaciones`, `descartes`.
- `POST /api/v1/admin/revision/calibracion/:preguntaId` con `{ dificultadCorresponde: boolean }` → `201` con el registro. Guarda versión, dificultad e intentos del momento y audita `confirmar_calibracion` o `descartar_calibracion` en la misma transacción. Errores: `NO_ENCONTRADO` (no existe o no está en su bandeja: otra área, menos de 30 intentos, dentro del rango, no publicada) y `CONFLICTO` (ya decidió para esta versión y dificultad).

**Administrador** (`preguntas.rutas.admin.ts`, `exigirRol('admin')`):

- ~~`GET /api/v1/admin/preguntas` suma el filtro `calibracion=confirmada` y las estadísticas en cada fila.~~ Cambió en la etapa 4 por el orden de los servicios:
  - `GET /api/v1/admin/revision/calibracion/confirmadas` → `data: ConfirmadaCalibracion[]`, `meta: { total }`. Cada una: `preguntaId`, `enunciado`, `prueba`, `contenido`, `dificultad { codigo, nombre, aciertoEsperadoMin, aciertoEsperadoMax }`, `confirmaciones`, `descartes`, `confirmadaEn`, `intentos`, `aciertos`, `porcentajeAcierto`, `tiempoPromedioSeg`.
  - `GET /api/v1/admin/evaluaciones/estadisticas?preguntas=<ids separados por comas, hasta 100>` → `data: [{ preguntaId, intentos, aciertos, porcentajeAcierto, tiempoPromedioSeg, actualizadoEn }]`; una pregunta sin respuestas no aparece. Una lista mal formada responde 400.
- La ficha (C03) muestra las mismas estadísticas.
- Retirar, volver a borrador y enviar a revisión: las rutas que ya existen, sin cambios.

## 8. Pantalla D04

- Encabezado «Calibración» y una línea: «Preguntas con 30 o más intentos cuyo porcentaje de acierto no coincide con su dificultad».
- `SegunCarga` con carga, `MensajeError` con «Reintentar» y vacío «No hay preguntas para calibrar».
- Tabla con `EncabezadoTabla`: pregunta (enunciado recortado y contenido), dificultad (etiqueta con texto), acierto, intentos, tiempo promedio y acciones.
- Acierto: una barra con el rango esperado sombreado y una marca en el valor real, **siempre con el texto al lado** («28 % · esperado 40–70 %») y un `aria-label` con lo mismo. La barra es decorativa (`aria-hidden`); el color no indica el estado solo: el texto dice «bajo el rango» o «sobre el rango».
- Acciones «La dificultad no corresponde» y «La dificultad está bien», cada una con confirmación que se cierra con Escape y devuelve el foco. Tras confirmar, la fila sale de la lista y un `Alerta` lo informa.
- Lógica en `consola/src/estado/calibracion.ts`; estilos en `paginas/calibracion/calibracion.css` solo con tokens. Revisión a 1440 y 390 px.
- En C02: el filtro «Calibración» y tres columnas (intentos, acierto, tiempo), con «Sin datos» cuando no hay estadísticas.

## 9. Etapas, pruebas y estimación

| Etapa | Qué | Pruebas | Horas |
| --- | --- | --- | --- |
| 0 | Migración `008_calibracion.sql` (solo si se aprueba D3) | Con PostgreSQL: claves, unicidad, comentarios | 2 |
| 2 · HU-53.1 | `recalcularEstadisticas` en `evaluaciones`, llamado desde la tarea periódica; lectura por servicio | Con PostgreSQL: suben solo con las respuestas que cuentan; omitidas, anuladas y versiones anteriores no suman; no puntuables sí; volver a correr no duplica; una anulada queda en 0. Sin base: la ruta de tareas informa `estadisticasActualizadas` | 6 |
| 3 · HU-26.1 | Bandeja y decisión del docente en `revision` | Solo 30+ intentos fuera de rango, publicadas y del área; extremos del rango; confirmar y descartar guardan y auditan; segunda decisión `CONFLICTO`; otra área no las ve; admin sin rol docente 403 | 8 |
| 4 · HU-26.2 | Filtro y estadísticas en el banco; nueva revisión con las rutas existentes | Con PostgreSQL: el filtro trae solo las pendientes; tras retirar deja de estar pendiente y de entregarse; tras borrador y envío entra a una ronda nueva con dos revisores (RN-10) | 4 |
| 5 · HU-26.3 | D04 y columnas de C02 | Carga, error con reintento, vacío, valor y rango en texto, confirmar y descartar, teclado y Escape | 10 |
| 6 | Cierre | lint, test, build, Knip, Madge, jscpd, secretlint; capturas | 3 |
| | **Total** | | **33** |

## 10. Documentación pendiente para el equipo

- Registrar HU-26 y HU-53 en el 04 y en el Sprint Backlog vigente.
- Si se aprueba D3: actualizar el modelo de datos del DAS (tabla nueva y acciones de auditoría) y el script en `docs/base-de-datos/`.
- Dejar en el DAS lo decidido en D1, D2, D4 y D5 (RN-15, RF-G13 y la tarea periódica de 4.3.5), y agregar a CU-19 un curso para la calibración.
