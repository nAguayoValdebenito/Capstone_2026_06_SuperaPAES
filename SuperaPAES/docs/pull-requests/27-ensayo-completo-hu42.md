# HU-42.1 y HU-42.2: ensayo completo y puntaje estimado

El estudiante con un plan vigente de Todas las pruebas puede rendir un ensayo en formato oficial. El armado reutiliza las cuotas y la selección de los mini-ensayos, pero abarca todo el temario de la prueba, sin limitarlo al curso ni excluir preguntas vistas durante 30 días. El banco prioriza las no vistas y puede repetir preguntas entre ensayos; nunca duplica una dentro del mismo ensayo.

## Contrato y reglas

| Método | Ruta                                                         | Respuesta                                                                             |
| ------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| GET    | `/api/v1/app/evaluaciones/ensayos/disponibilidad?pruebaId=N` | `pruebaId`, `cantidad`, `duracionMin`, `textos`, `sinPuntaje`, `disponible`, `motivo` |
| POST   | `/api/v1/app/evaluaciones/ensayos` con `{ "pruebaId": N }`   | `201`: `id`, `pruebaId`, `cantidad`, `duracionMin`, `venceEn`, `preguntas`            |

Ambas rutas requieren JWT y la prueba elegida en el perfil. La consulta específica `permiteEnsayoCompleto` de la interfaz pública de suscripciones comprueba el alcance `todas` y los estados `activa` o `en_mora`; no interpreta el nombre visible del plan. Sin ese alcance, el inicio devuelve `403 SIN_PERMISO`, motivo `plan_todas_requerido`. Ciencias exige electivo; la disponibilidad indica `electivo_requerido` y el inicio rechaza su ausencia.

La estructura oficial vigente fija preguntas, minutos, textos y cinco preguntas sin puntaje. Competencia Lectora usa 65 preguntas, siete textos y 150 minutos; M1 65 y 140; M2 55 y 140; Historia 65 y 120; Ciencias 80 y 160, con 54 comunes y 26 del electivo. El reparto por ejes y habilidades y la mezcla 30 % fácil, 45 % media y 25 % difícil se toman de la configuración y del armado compartido. Un banco que no satisface toda la estructura produce `409 SIN_PREGUNTAS_SUFICIENTES`: se revierte el inicio completo, incluida cualquier intención de abandonar una práctica previa. Una evaluación con tiempo abierta produce `409 EVALUACION_CON_TIEMPO_ABIERTA`. El bloqueo del perfil y el índice de la base dejan un solo inicio ante dos solicitudes simultáneas.

Las cinco preguntas sin puntaje se sortean al iniciar mediante el generador inyectable y se guardan en `app.evaluacion_item.puntuable`. Ciencias reparte una por cada eje común y dos del electivo; las demás pruebas sortean cinco del total. La respuesta de inicio, la disponibilidad y la retoma no muestran cuál es la marca. Tampoco muestran respuestas correctas ni explicaciones. La marca solo aparece en la revisión posterior al cierre.

El inicio fija la tabla de conversión cargada más reciente para la prueba y, en Ciencias, para el electivo elegido. La base calcula y conserva el resultado al entregar, vencer o cerrar desde la tarea periódica, usando esa tabla incluso si después se carga una nueva. Excluye las no puntuables y las anuladas. Si se anula una pregunta, escala `round(correctas × máximo_de_la_tabla / puntuables)` y recalcula mediante el mecanismo existente. Si no hay tabla cargada, se puede rendir y el resultado expone `puntaje: null`, `tablaConversion: null` y `motivoSinPuntaje: tabla_no_disponible`. En ensayos el resultado incluye `puntajeEstimado: true`, pues no es un puntaje oficial. Se reutilizan los endpoints de respuesta, entrega, `/abierta`, resultado y revisión de HU-40 y HU-61.1.

## Validación

Las pruebas nuevas usan PostgreSQL y preguntas sintéticas: comprueban permisos, rollback, formato M1/M2/HCS/CL/CIE, textos completos, cuotas, electivo, ausencia de marcas antes del cierre, doble inicio, temario completo sin filtro de curso, repetición con preferencia por no vistas, tabla fijada al inicio, Ciencias por electivo, puntaje y escala tras anulación, y falta de tabla. Se ejecuta la batería existente de HU-40 sin modificar sus pruebas. No se cambia esquema, migraciones ni semillas.

La primera CI del PR encontró que `candados-bd.test.ts` contaba candados de otras bases temporales ejecutadas en paralelo. Su consulta ahora limita el conteo a la base temporal propia; conserva la misma aserción y no cambia el código productivo ni los tests de HU-40.

| Comprobación                                                                                                                  | Resultado                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `npm run lint`                                                                                                                | TypeScript, ESLint y Prettier correctos                                    |
| `CI=true npm run test -w api -- --no-file-parallelism`                                                                        | 135 archivos, 1491 pruebas correctas, incluidas las de HU-40 sin modificar |
| `CI=true npm run test -w api`                                                                                                 | 135 archivos, 1491 pruebas correctas en paralelo                           |
| `CI=true npm run test -w api -- --project postgresql --run pruebas/mini-ensayo pruebas/ensayo-completo --no-file-parallelism` | Tras rebase sobre `main` con PR #70: 7 archivos, 38 pruebas correctas      |
| `CI=true npm run test -w consola`                                                                                             | 19 archivos, 147 pruebas correctas                                         |
| `npm run build`                                                                                                               | API y consola correctas                                                    |
| `npm audit --audit-level=moderate`                                                                                            | 0 vulnerabilidades                                                         |
| `npm run codigo-muerto`                                                                                                       | Knip sin hallazgos                                                         |
| `npm run circulares`                                                                                                          | Madge sin ciclos; aviso por una dependencia externa de consola             |
| `npm run duplicacion`                                                                                                         | jscpd: 4 clones previos, 0,08 % total; ninguno en el cambio                |
| `npm run revisar-secretos`                                                                                                    | Secretlint sin hallazgos                                                   |
| `npm run probar:bd -w api`                                                                                                    | 249 de 249 casos correctos                                                 |
