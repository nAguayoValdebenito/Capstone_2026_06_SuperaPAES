# HU-36.1 y HU-36.3: diagnóstico en el servidor

## Comportamiento

- El diagnóstico usa la estructura activa de cada prueba: cinco preguntas por eje o, en Competencia Lectora, por habilidad. Respeta el curso, omite los ejes aún no enseñados y redistribuye sus preguntas (RN-24 y RN-28). En Ciencias no requiere electivo, de acuerdo con RN-35.
- Cada estudiante puede iniciar uno por prueba y año escolar. El año cambia el 1 de marzo en hora de Chile; el índice único del modelo protege también dos inicios simultáneos. Un diagnóstico abandonado o cerrado por tiempo cuenta como rendido. Un armado fallido revierte la transacción completa y permite intentar de nuevo.
- El inicio comparte el armado, las respuestas, el reloj de PostgreSQL, la entrega, la retoma, el cierre y la tarea periódica de HU-40. No descuenta cupo diario ni uso gratis mensual. Una práctica o repaso abiertos se cierran como abandonados; otra evaluación con tiempo abierta responde `409 EVALUACION_CON_TIEMPO_ABIERTA`.
- El resultado conserva sus cantidades por eje y habilidad, y añade `aReforzar`, `ejesAReforzar` y `habilidadesAReforzar`. Las marcas se obtienen al consultar del mismo servicio de progreso que usa RN-14: al menos cinco respuestas acumuladas entre prácticas y evaluaciones, menos de 60 % de acierto ponderado (valores configurables) y eje enseñado en el curso. Por ser acumuladas, pueden cambiar después de nuevas prácticas; las cantidades guardadas del diagnóstico no cambian. En Lectora se refuerza por habilidad. La API no expone claves antes del cierre.

## Rutas

| Método | Ruta | Contrato |
| --- | --- | --- |
| `GET` | `/api/v1/app/evaluaciones/diagnosticos/disponibilidad?pruebaId=N` | `{pruebaId, anioEscolar, disponible, motivo}`; `motivo` es `ya_rendido` o `null` |
| `POST` | `/api/v1/app/evaluaciones/diagnosticos` | Recibe `{pruebaId}`; `201` con `{id, pruebaId, cantidad, duracionMin, venceEn, preguntas}`, como `mini-ensayos` |
| `GET` | `/api/v1/app/evaluaciones/abierta` | Devuelve también el diagnóstico y sus respuestas guardadas para retomarlo |

Las rutas existentes de respuesta, entrega, resultado y revisión funcionan para el diagnóstico. Todas requieren la sesión del estudiante y verifican la pertenencia.

## Validación real

Ejecutada en Windows con Node y PostgreSQL 18, sobre bases temporales de prueba.

| Comprobación | Resultado |
| --- | --- |
| `npm run lint` | TypeScript, ESLint y Prettier correctos |
| `npm test` | Corrida previa a las tres pruebas adicionales de inicio: API 931 pasadas, 48 comprobaciones condicionadas a CI omitidas; consola 130 pasadas |
| `CI=true npm run test -w api -- --maxWorkers=2` | Una corrida completa: 982 de 982 pasadas, sin omisiones. Repetida tras la última prueba añadida: 982 aserciones pasadas, con timeout de un hook `afterAll` ajeno a HU-36 |
| Pruebas HU-36 y HU-40 con PostgreSQL | 33 de 33 pasadas; archivos de pruebas HU-40 sin cambios |
| `npm run build` | API y consola correctas |
| `npm audit --audit-level=low` | 0 vulnerabilidades |
| `npm run codigo-muerto` | Knip sin hallazgos |
| `npm run circulares` | Madge sin ciclos en API ni consola |
| `npm run duplicacion` | jscpd: 0,05 %, dos clones previos; ninguno en HU-36 |
| `npm run revisar-secretos` | Secretlint sin hallazgos |
| `npm run probar:bd -w api` | 249 de 249 casos correctos |
| `git diff --check` | Sin errores |

Las pruebas nuevas cubren banco insuficiente sin quemar el diagnóstico, año escolar entre el 28 de febrero y el 1 de marzo en Chile, inicios simultáneos (201 y 409), estructura por curso, Lectora y Ciencias, disponibilidad y aislamiento por estudiante, ausencia de claves antes del cierre, retoma, entrega, vencimiento, tarea periódica y marcas del resultado coherentes con el progreso acumulado.

Una corrida CI completa con cuatro workers ejecutó las 982 pruebas, pero dos hooks `afterAll` ajenos a HU-36 agotaron sus 10 segundos durante checkpoints de PostgreSQL. Las dos suites pasaron aisladas (14 de 14). Una corrida completa con dos workers pasó sin fallos; al repetirla después de la última prueba añadida, las 982 aserciones volvieron a pasar, pero el hook de `reintegracion-bloqueos-bd.test.ts` volvió a agotar sus 10 segundos. Esa suite pasó aislada otra vez (6 de 6). No se cambiaron esos tests ni la configuración de CI.

Después de esas corridas, la rama se rebasó sin conflictos sobre `origin/main` con el PR #62 de HU-12. En esa base se repitieron las 33 pruebas PostgreSQL de HU-36/HU-40, lint, build, audit, Knip, Madge, jscpd, Secretlint y `probar:bd`; todos pasaron. Las cifras de la suite completa de API y consola de la tabla pertenecen a la base anterior al rebase.

## Alcance

Solo servidor. Las pantallas de HU-36.2, el ensayo completo de HU-42 y las compras quedan fuera. No se modificaron esquema, migraciones ni semillas. Se reutilizaron las preguntas sintéticas de las pruebas, sin material del DEMRE. No se hizo push ni se creó un PR.
