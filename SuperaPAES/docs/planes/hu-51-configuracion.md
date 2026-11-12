# Plan HU-51 · Configuración de la consola (C12)

Estado al 12/11/2026: **HU-51.1 y HU-51.2 están implementadas y verificadas en la rama (commits locales, sin push); falta registrar HU-51 en la documentación oficial**. Rama `feat/hu-51-configuracion`, creada desde `origin/main` en `ce6556d`. Este plan no modifica el modelo de datos ni las fuentes oficiales.

## 1. Alcance y fuentes

| Fuente | Hallazgo |
| --- | --- |
| 02 Documento de Épicas e Historias de Usuario v1.8 | No contiene una descripción localizable de HU-51; el criterio detallado está en la planilla 03. |
| 03 Plantilla Historias de Usuario v1.8, hoja «Historias de Usuario», fila 215 | HU-51: el administrador cambia parámetros para ajustar reglas sin tocar código. Su escenario 1 enumera cupos, invitaciones, revisión, repaso, selección, cierre por inactividad, solicitudes de datos y topes de IA. |
| 04 Product Backlog, hoja `Product_Backlog`, fila 87 | HU-51 tiene 3 puntos, prioridad **Should** y sprint **Pendiente**. |
| 05 Sprint 7 y Sprint 8 Backlog suministrados | No contienen HU-51. No se recibió una planilla oficial del sprint vigente que la incorpore. El plan de reparto del equipo también la declara fuera del alcance de esta versión. |
| DAS v1.21 §2.3, RF-C04 | Autoriza cambiar desde la consola los parámetros enumerados; remite a la tabla del final de §2.4. Prioridad Should; HU-51 pendiente. |
| DAS v1.21 §2.4, tabla «Parámetro / Valor inicial / Regla o requisito que lo usa» | Enumera 23 claves: 16 iniciales y 7 de IA. La migración `001_esquema_inicial.sql` inserta 16; `005_parametros_ia.sql` añade 7. |
| DAS v1.21, CU-24, alternativa 1.a | La edición de parámetros corresponde a HU-51, pendiente en el Product Backlog. |
| DAS v1.21 §7.4, pantalla C12 | Dice «los 16 parámetros» y exige auditoría de cada cambio. Contradice las 23 filas de §2.4 y de las migraciones. |
| C2 Plan de Pruebas y Evidencias v1.13 | No se encontró un caso CP específico de HU-51; habrá que incorporarlo cuando se planifique la historia. |
| `CLAUDE.md`, `docs/arquitectura.md`, modelo 11.0 y `docs/convenciones.md` | `administracion` es dueño de `contenido.configuracion`; otros módulos leen sus valores por el servicio. SQL en repositorios, respuesta `{ data, error, meta }`, rutas admin y errores del catálogo. |

**Bloqueo de alcance:** antes de programar, el equipo debe registrar HU-51 en el Sprint Backlog vigente con HU-51.1 (API), HU-51.2 (consola), responsables y horas, y actualizar la fila del 04 para que deje de decir «Pendiente». El equipo debe agregar los casos CP de HU-51 al C2. No se editan aquí esas fuentes.

## 2. Parámetros y reglas propuestas

La columna «Fuente» señala la fila de la tabla del DAS §2.4 y el requisito que justifica su uso. Todos los nombres de clave son los de `contenido.configuracion`; los valores iniciales son referencias, **no** valores para incrustar en el código. Las validaciones son propuestas para HU-51, no límites ya aprobados por el DAS. Ningún máximo numérico distinto de 100 % está documentado.

| Clave | Inicial y unidad | Fuente | Edición y validación propuesta |
| --- | --- | --- | --- |
| `cupo_inicial` | 10 preguntas/día | §2.4, RN-01; RF-C04 | Editable; entero positivo. |
| `cupo_verificado` | 20 preguntas/día | §2.4, RN-01; RF-C04 | Editable; entero positivo. |
| `bono_invitacion` | 5 preguntas | §2.4, RN-03; RF-C04 | Editable; entero positivo. |
| `tope_invitaciones_mes` | 10 invitaciones/mes | §2.4, RN-03; RF-C04 | Editable; entero positivo. |
| `dias_sin_repetir` | 30 días | §2.4, RF-A07; RF-C04 | Editable; entero positivo. |
| `revisores_requeridos` | 2 docentes | §2.4, RN-10; RF-C04 | Editable; entero positivo; decidir si se exige mínimo 2. |
| `dias_plazo_revision` | 3 días | §2.4, RF-G17; RF-C04 | Editable; entero positivo. |
| `repaso_sin_plan` | 10 preguntas | §2.4, RN-04/RN-05; RF-C04 | Editable; entero positivo. |
| `min_respuestas_eje` | 5 respuestas | §2.4, RN-14; RF-C04 | Editable; entero positivo. |
| `umbral_eje_debil` | 60 % | §2.4, RN-14; RF-C04 | Editable; entero de 0 a 100, inclusive. El consumidor actual lo lee como entero. |
| `horas_inactividad_practica` | 2 horas | §2.4, RN-19; RF-C04 | Editable; entero positivo, como lo lee la API. |
| `max_preguntas_lote` | 10 preguntas/solicitud | §2.4, CU-17; RF-C04 («topes de uso de la IA») | Editable propuesto; entero positivo. Requiere confirmar que «topes» incluye este límite por lote. |
| `tope_diario_ia` | 100 preguntas/día | §2.4, RNF-03; RF-C04 | Editable; entero positivo. |
| `tope_mensual_ia_usd` | US$ 10/mes | §2.4, RNF-03; RF-C04 | Editable; decimal positivo con hasta dos decimales. |
| `plazo_derechos_dias` | 30 días corridos | §2.4, RF-A21/RNF-09; RF-C04 | Editable según RF-C04; entero positivo. La maqueta lo bloquea: resolver esta diferencia antes de implementar. |
| `modelo_ia` | Nombre del modelo | §2.4, RF-G03; párrafo «Parámetros del sistema» | Solo lectura: el DAS indica migración al retirar el nombre del proveedor. |
| `temperatura_ia_deepseek`, `temperatura_ia_gemini` | 0,7 cada una | §2.4, RF-G03 | Solo lectura: RF-C04 no las enumera y no define edición de temperatura. |
| `precio_entrada_ia_deepseek`, `precio_salida_ia_deepseek`, `precio_entrada_ia_gemini`, `precio_salida_ia_gemini` | US$ por millón de tokens | §2.4, RNF-03 | Solo lectura: tarifas de proveedor, no topes administrables en RF-C04. |
| `concurrencia_ia` | 1 pregunta simultánea | §2.4, CU-17 | Solo lectura: RF-C04 no la enumera como tope editable. |

Resultado propuesto: **15 editables y 8 de solo lectura**, si el equipo confirma `max_preguntas_lote`. La consola lista las 23. Las siete claves añadidas por la migración 005 siguen visibles aunque no se puedan editar. No se necesita otra migración.

**Decisiones de validación para el equipo:** RF-C04 no fija máximos ni reglas entre parámetros. Confirmar si `cupo_verificado >= cupo_inicial`, si `revisores_requeridos >= 2` por RN-10, si algunos cupos o topes admiten cero, si se edita `max_preguntas_lote` y qué mínimo legal o máximo corresponde a `plazo_derechos_dias`. No incorporar ninguna de esas reglas sin documentarla. Los rangos 1–50, 1–100 y similares de `maquetas_consola/app.js` son datos de la maqueta, no reglas aprobadas.

## 3. Efecto de cambios sobre datos existentes

| Parámetros | Consumo actual y efecto observado |
| --- | --- |
| Cupos | `cupo-invitaciones.cupo.servicio.ts` lee el valor al crear el cupo del día; una fila `app.cupo_diario` ya creada conserva su máximo. La verificación de correo puede subir el máximo de ese día usando el valor vigente. No se propone recalcular filas anteriores. |
| Bono y tope de invitaciones | `cupo-invitaciones.bono.servicio.ts` lee ambos al premiar una verificación. El saldo ya abonado permanece; la siguiente invitación se evalúa con el tope vigente. |
| Revisores y plazo docente | `revision.servicio.ts` toma ambos al asignar y guarda la fecha límite. Asignaciones ya creadas no cambian de cantidad ni vencimiento. `revision.seguimiento.servicio.ts` usa los valores actuales para sus indicadores; un cambio puede hacer que ese indicador difiera de una asignación anterior. |
| Repaso, repetición y eje débil | Los servicios de `evaluaciones` leen los valores en cada consulta/selección. Cambia el siguiente resultado o selección; no se reescriben respuestas ni resultados persistidos. La vista de progreso en la base también consulta los parámetros actuales. |
| Horas de inactividad | `evaluaciones.abierta.servicio.ts` y la función de cierre en la base leen el valor vigente al revisar la práctica; una práctica abierta puede cerrarse antes o después de lo previsto cuando cambia la regla. No cambia una práctica ya cerrada. |
| Topes de IA | `generador.productor.servicio.ts` compara el uso diario y gasto acumulado del mes con los topes nuevos al crear un lote; `generador.turno.ts` vuelve a leer el tope mensual al procesar. El gasto ya registrado no se borra. Un tope reducido puede bloquear nuevos lotes o un lote pendiente. |
| Plazo de solicitudes de datos | Se inserta en la configuración inicial, pero no se encontró lectura de `plazo_derechos_dias` en los servicios TypeScript actuales. La pantalla podría guardarlo, pero falta confirmar qué flujo lo aplica y si altera solicitudes ya abiertas. No prometer un efecto automático que el código no tiene. |

## 4. Contrato propuesto de API

Ubicación: módulo `administracion`, porque ya posee `contenido.configuracion`, `contenido.auditoria` y el servicio lector que usan los demás módulos. No se agrega un módulo ni se llama a repositorios ajenos.

- `GET /api/v1/admin/administracion/configuracion`, solo `exigirRol('admin')`: `{ data: { parametros: [{ clave, nombre, descripcion, valor, unidad, editable, regla, actualizadoEn, actualizadoPor }] }, error: null, meta: null }`. `actualizadoPor` es el nombre de `contenido.usuario_interno` mediante unión simple o `null` para datos iniciales. `nombre`, `unidad`, `editable` y `regla` salen de un catálogo único de presentación/validación del módulo; `valor`, `descripcion` y fecha salen de la base.
- `PATCH /api/v1/admin/administracion/configuracion/:clave`, solo `exigirRol('admin')`, cuerpo `{ valor, actualizadoEn }`: valida clave y valor, comprueba que `actualizadoEn` coincide con la fila, actualiza `valor`, `actualizado_por` y `actualizado_en`, registra `cambiar_configuracion` en `contenido.auditoria` con antes y después, todo en una transacción. Devuelve el parámetro actualizado dentro de `{ data, error, meta }`. Para evitar perder cambios simultáneos, bloquear la fila o hacer actualización condicional por clave y fecha. `CONFLICTO` (409) si la fecha ya cambió; `NO_ENCONTRADO` (404) si no existe; `VALIDACION` (400) si la clave es de solo lectura o el cuerpo/valor no cumple la regla. No incluir secretos ni textos libres en el registro.

Archivos previstos: `administracion.configuracion.repositorio.ts` (SQL y unión con autor), `administracion.configuracion.reglas.ts` (catálogo/validación), `administracion.configuracion.servicio.ts` (transacción y auditoría), tipos y validadores del módulo, `administracion.controlador.ts`, `administracion.rutas.admin.ts`; actualizar `docs/arquitectura.md` y las pruebas. Reutilizar las abstracciones actuales de transacción, `responder()` y auditoría, sin duplicar su implementación.

## 5. Pantalla C12

La ruta `/configuracion` ya existe y `PaginaConfiguracion.tsx` todavía muestra «En construcción». Se propone dividir la vista en **cupos e invitaciones**, **revisión docente**, **práctica y progreso**, **generación con IA** y **solicitudes de datos**. Cada fila muestra nombre, descripción, valor y unidad, regla aplicable y última modificación (fecha y autor si existe). Los ocho valores de solo lectura se identifican con texto y no tienen control editable.

**Edición por fila.** El contrato PATCH es atómico por clave y permite mostrar en la confirmación exactamente el valor anterior y el nuevo, sin una falsa promesa de guardado masivo. Al guardar, aviso de éxito; ante validación, error junto al campo; ante `CONFLICTO`, avisar y recargar el valor vigente. Si queda un campo sin guardar al cambiar de sección, mantener el borrador o advertir antes de descartarlo.

Implementación prevista: `consola/src/servicios/administracion.ts` (o `configuracion.ts`), tipos, hook `src/estado/configuracion.ts`, `PaginaConfiguracion.tsx`, componentes de fila/confirmación si hacen falta y `configuracion.css`. Usar `SegunCarga`, `MensajeError` y tokens del rediseño. Estados de carga, vacío y error; navegación con teclado, foco visible, confirmación cerrable con Escape y retorno del foco, `aria-describedby` para unidad/error y `aria-invalid` para valor inválido. Revisar a 1440 y 390 px, temas claro/oscuro, y controles táctiles de 44 px.

Referencia visual revisada: `BOCETOS COMPLETOS/C12.png` del ZIP entregado y `maquetas_consola/app.js`. Ambas muestran grupos y valores, pero no gobiernan validaciones. La maqueta usa guardado masivo, rangos no documentados y bloquea `plazo_derechos_dias`; el comportamiento final debe seguir RF-C04 y las decisiones que el equipo registre.

## 6. Pruebas y estimación

| Bloque | Pruebas previstas | Estimación |
| --- | --- | ---: |
| API HU-51.1 | Admin obtiene 23 parámetros y envoltorio; docente 403, token app 401; clave inexistente, solo lectura, cuerpo vacío, tipo y rango inválidos; fecha vieja 409; transacción guarda valor/autor/fecha y auditoría; fallo de auditoría revierte; consumidor real lee valor nuevo. Integración PostgreSQL se omite sin `DATABASE_URL`. | 5 h |
| Consola HU-51.2 | Carga, error y reintento, vacío, cinco grupos, unidades y solo lectura; campo inválido no envía; confirmación, éxito y conflicto; teclado/Escape/foco; tamaños, temas y accesibilidad. | 5 h |
| Cierre | Lint, test y build; controles CI pertinentes; capturas 1440/390 y descripción del PR cuando corresponda. | 1 h |

**Total preliminar: 11 h**, sujeto al Sprint Backlog y a las decisiones de validación. No hay CP específico de HU-51 en el C2 recibido; crear los CP y la matriz de evidencias antes de implementar. Las pruebas de API deben cubrir las reglas de negocio, no solo el formato de respuesta.

## 7. Secuencia de cinco commits manuales

Ninguno de estos commits lo hace el asistente. Cada uno se prepara y valida por separado en esta rama. Los commits 2 a 4 ya están en la rama (`0f14ad2`, `956f332`, `a45cb97`, `7d5690a`); quedan el 1 y el 5, más el ajuste de estilos de C12. El registro en el sprint sigue pendiente.

1. `docs: planificar HU-51 configuracion de la consola` — este documento, sin código.
2. `feat: consultar y actualizar parametros de HU-51.1` — GET, PATCH, control de concurrencia, auditoría y pruebas.
3. `feat: conectar datos de configuracion en HU-51.2` — servicio de consola, tipos, hook y pruebas de estado.
4. `feat: construir pantalla C12 de HU-51.2` — vista, estilos, accesibilidad y pruebas de interacción.
5. `docs: cerrar evidencias de HU-51` — documentación de rutas, resultados de CI y evidencias visuales, si se incorporan al repositorio.

Antes de cada commit de código: `npm run lint`, `npm test`, `npm run build` en `SuperaPAES/`, más los controles de calidad aplicables del CI. Nunca borrar o debilitar pruebas para hacerlas pasar. No hacer push ni PR sin indicación de la usuaria.

## 8. Documentación y decisiones pendientes

1. Incorporar HU-51 al 04 y al Sprint Backlog vigente, con las tareas HU-51.1/HU-51.2, responsables, horas y CP del C2. El plan de reparto actual la deja fuera de alcance.
2. Corregir la cifra «16» de C12 §7.4 o precisar si C12 muestra 16 de 23. La propuesta de este plan muestra 23, con 15 editables y 8 de solo lectura.
3. Resolver si `max_preguntas_lote` es editable y si se aplican reglas entre parámetros o límites máximos concretos. La maqueta no es fuente normativa para esos rangos.
4. Resolver el conflicto sobre `plazo_derechos_dias`: RF-C04 lo incluye entre los editables, mientras el README y `app.js` de la maqueta lo bloquean y afirman un mínimo legal. Se requiere decisión respaldada en la documentación oficial; no se implementa la regla de la maqueta por su cuenta.
5. Definir el efecto esperado de `plazo_derechos_dias` en solicitudes abiertas y cómo reflejar cambios de umbrales en indicadores ya calculados. El código actual no ofrece esa garantía.
6. Alinear el valor inicial de `modelo_ia` del DAS §2.4 (`deepseek-flash`) con la migración 001 (`deepseek-chat`) o documentar la migración que lo actualiza. No cambiar el modelo desde C12.

7. El anillo de foco global de la consola (`--foco`) es ámbar, y el bloque común de los prompts pide evitarlo. Es un cambio de toda la consola, fuera de HU-51.

**Punto de parada (cierre de HU-51.2):** se agregaron 5 pruebas de interacción real de C12 en jsdom (hook y cliente reales, solo `fetch` simulado; `jsdom` como dependencia de desarrollo de la consola). Lint, Prettier, pruebas (API 1.118 y consola 400, con `--maxWorkers=2`), build, Knip, Madge, jscpd y secretlint aprobados. Las 2 pruebas de HU-51 con PostgreSQL pasaron sobre una base temporal `_test`. La revisión en el navegador se hizo con la API local sobre una base temporal (migraciones y semillas, administrador de prueba; la base se borró): 1440 y 390 px sin desplazamiento horizontal, controles de 44 px (se subió el alto de los campos), contraste AA en tema claro, foco visible, Escape devuelve el foco, guardado con auditoría y conflicto real. La consola no tiene tema oscuro. Capturas y descripción del PR en `docs/pull-requests/hu-51-1-configuracion-api.md`. El equipo aún debe registrar HU-51 en el sprint vigente.
