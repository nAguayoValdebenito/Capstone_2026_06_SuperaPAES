# HU-40.1, HU-40.2 y HU-40.4: mini-ensayos con tiempo en el servidor

El estudiante puede iniciar un mini-ensayo, retomarlo con sus respuestas, cambiarlas antes del
vencimiento y entregarlo. Las preguntas y la hora de término quedan fijadas al iniciar. La API no
devuelve claves ni explicaciones antes del cierre y reutiliza el resultado y la revisión existentes.

## Comportamiento

- El armado lee la estructura activa, las cuotas de dificultad y el curso del estudiante. Respeta
  el reparto provisional por eje, redistribuye los ejes todavía no enseñados y conserva completos
  los textos de Competencia Lectora, con sus preguntas en orden. Ciencias requiere el electivo
  elegido y arma 18 preguntas comunes más 9 de ese electivo. M1 arma 22 preguntas en 48 minutos.
- RN-19: una práctica o un repaso abiertos se cierran como abandonados conservando lo respondido.
  Una evaluación con tiempo abierta produce `409 EVALUACION_CON_TIEMPO_ABIERTA` y devuelve cuál es.
  Dos inicios simultáneos producen un `201` y un `409`, con una sola evaluación y un solo uso gratis.
- El uso gratis se registra por la interfaz pública de `cupo-invitaciones`, con el cliente de la
  misma transacción. El período mensual usa `America/Santiago` (RN-02). No se descuenta cupo diario.
  **`cubrePrueba` devuelve `false` hasta HU-44: actualmente todos pasan por el uso gratis mensual**,
  aunque exista una suscripción registrada. Esta implementación no habilita beneficios de pago.
- El límite mensual produce `409 USO_GRATIS_AGOTADO`, con motivo y las opciones de esperar al próximo
  mes o ver planes. Un banco que no permite cumplir el armado produce
  `409 SIN_PREGUNTAS_SUFICIENTES`; no queda evaluación ni uso consumido. Cualquier fallo revierte
  también el abandono de la práctica o del repaso anterior.
- Las respuestas usan `clock_timestamp()` después del bloqueo, en la sentencia que guarda. Se
  rechazan al alcanzar `vence_en`; los 10 segundos que tolera el trigger de la base no habilitan
  respuestas tardías por HTTP. Guardar una respuesta no la corrige ni expone su clave.
- Entrega, consulta de la abierta, resultado y revisión reutilizan `app.cerrar_evaluacion`. La tarea
  periódica existente llama `app.cerrar_vencidas`, que usa esa misma función y `SKIP LOCKED`.
  El cierre corrige una sola vez, guarda el resultado y registra las omitidas para el repaso.
  Anuladas y no puntuables quedan fuera del resultado. Repetir la entrega devuelve el cierre ya
  guardado sin recalcularlo.
- Como la función SQL utiliza `now()` de la transacción, si una espera por un bloqueo cruza el
  vencimiento se deshace y renueva la transacción antes de cerrar. Así se conserva exactamente
  `vence_en` como hora de cierre, sin modificar la función ni las migraciones.

## Rutas y reutilización

| Método | Ruta de la app                                       | Respuesta principal                                                            |
| ------ | ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| POST   | `/api/v1/app/evaluaciones/mini-ensayos`              | Recibe `pruebaId`; crea la evaluación y devuelve sus ítems y `venceEn`         |
| GET    | `/api/v1/app/evaluaciones/abierta`                   | Agrega los ítems y las respuestas guardadas a la evaluación con tiempo abierta |
| POST   | `/api/v1/app/evaluaciones/:id/items/:item/respuesta` | Guarda o cambia la respuesta; devuelve solo el acuse mientras está abierta     |
| POST   | `/api/v1/app/evaluaciones/:id/entregar`              | Cierra y deja disponible el resultado                                          |
| GET    | `/api/v1/app/evaluaciones/:id/resultado`             | Consulta existente, con cierre al vencer                                       |
| GET    | `/api/v1/app/evaluaciones/:id/revision`              | Consulta existente, con cierre al vencer                                       |

Todas requieren la sesión del estudiante y verifican la pertenencia. El armado por cuotas y el cierre
quedan separados del inicio específico del mini-ensayo para reutilizarlos en otros tipos. No se agregan
rutas de inicio de diagnóstico ni de ensayo completo.

## Validación real

Ejecutada en Windows con Node y PostgreSQL 18, usando una base local de pruebas y bases temporales.

| Comprobación                       | Resultado                                                       |
| ---------------------------------- | --------------------------------------------------------------- |
| `npm run lint`                     | TypeScript, ESLint y Prettier sin errores                       |
| `npm run test` con `CI=true`       | API: 931 pasadas; consola: 115 pasadas; ningún fallo ni omisión |
| `npm run build`                    | API y consola correctas                                         |
| `npm audit --audit-level=moderate` | 0 vulnerabilidades                                              |
| `npm run codigo-muerto`            | Knip sin hallazgos                                              |
| `npm run circulares`               | Madge sin ciclos en API ni consola                              |
| `npm run duplicacion`              | jscpd: 0,05 %, 2 clones previos, bajo el límite de 1 %          |
| `npm run revisar-secretos`         | Secretlint sin hallazgos                                        |
| `npm run probar:bd -w api`         | 249 de 249 casos correctos                                      |
| `git diff --check`                 | Sin errores                                                     |

La primera corrida sin `CI` dio 883 pruebas de API pasadas y omitió las 48 comprobaciones
`exigirBaseEnCi`. La corrida final con `CI=true` ejecutó las 931, incluidas las aserciones de la
revisión tras el inicio por HTTP, sin omisiones. Las pruebas con PostgreSQL sí se ejecutaron.
Madge avisa que omite la dependencia externa `react-router` en la consola; no detecta ciclos.
No se modifican sus exclusiones ni los límites de calidad.

Las pruebas nuevas cubren RN-19 con práctica y repaso respondidos, doble inicio, consumo único y
agotamiento mensual, cambio de mes en Chile, banco insuficiente, reparto por curso, Ciencias y textos
indivisibles, cambio de respuesta, frontera de vencimiento y espera por bloqueo, ausencia de claves,
aislamiento entre estudiantes, entrega idempotente y cierre concurrente con la tarea periódica.
El caso de no puntuables usa un fixture de ensayo, porque el modelo solo permite esas preguntas en
ese tipo; no implementa su inicio. Las preguntas de prueba son sintéticas, sin material del DEMRE.

## Alcance pendiente y relación con el DAS

- El uso mensual corresponde a RF-A14, RN-05 y HU-40.5. RN-28 regula la redistribución de los ejes
  omitidos por el curso; no es la regla del uso gratis.
- HU-40.3 y las pantallas de la app quedan fuera, al igual que HU-36, HU-42, compras, avisos de
  renovación y acceso de pago de HU-44. El workflow de tareas ya existente se conserva sin cambios.
- No se cambian esquema, migraciones ni semillas. La tolerancia del trigger se mantiene, con el
  límite HTTP más estricto exigido por RN-21. No se agregan servicios ni variables de despliegue.
- **HU-61.1 todavía no puede declararse completamente terminada.** Sus consultas de resultado y
  revisión ya existen, se reutilizan y pasan sus pruebas, incluida la versión histórica de
  enunciado, alternativas y explicaciones después de reeditar una pregunta. Sin embargo,
  `pregunta_version.copia` conserva solo `texto_estimulo_id`: tanto `v_item_evaluacion` como la
  revisión leen título, contenido e imagen de la fila actual de `contenido.texto_estimulo`.
  No hay versionado ni protección de inmutabilidad de esa fila en el modelo actual. Falta garantizar
  el texto de lectura tal como lo vio el estudiante si se edita después (criterio 2 de HU-61).
  Se informa esta limitación previa sin alterar el modelo en este trabajo. HU-61.2 sigue siendo
  la implementación separada de las pantallas.

Descripción preparada para revisión local. Sin push ni creación de PR.
