# Plan HU-25 · Clasificar dificultad del banco semilla (D03)

Estado al 13/11/2026: **opción a aprobada por Nicolas (D1); D2 a D5 según la recomendación. HU-25.1 (servidor) confirmada; HU-25.2 (consola) terminada y verificada, sin confirmar. Falta la etapa de cierre.** Rama `feat/hu-25-clasificar-dificultad`, creada desde `origin/main` en `258001a`. Este plan no modifica el esquema, las migraciones, las semillas ni los documentos oficiales. Prompt: `D03_Clasificar_dificultad_HU-25.md`.

Fuentes leídas: DAS 1.21, 03 Historias de Usuario v1.8, 04 Product Backlog, Sprint Backlogs 7 a 9, C2 v1.13 (copias de `referencia_oficial` de la biblioteca del proyecto; no existe `docs/referencia_oficial/` en el equipo), `001_esquema_inicial.sql`, los módulos `revision` y `preguntas`, y la consola (`paginas/revision`, `paginas/desempates`, `paginas/clasificar-dificultad`, `rutas/secciones.ts`). Boceto `D03_clasificar_dificultad.png` solo como referencia visual.

## 1. Fuentes

| Fuente | Qué dice |
| --- | --- |
| 03 v1.8, HU-25 | «Como docente revisor necesito clasificar rápido la dificultad del banco existente, con la finalidad de publicar antes las preguntas importadas». Esc. 1 «Clasificación con un clic»: hay preguntas importadas por clasificar; el sistema muestra la pregunta y permite elegir fácil, media o difícil con un clic. |
| 04 Product Backlog | Orden 70, HU-25: 3 puntos, Should, **Pendiente**. |
| 05 Sprint Backlog | Ninguno contiene HU-25. |
| C2 v1.13 | No hay caso de prueba de HU-25, RF-G12, CU-19a ni D03. |
| DAS §2.3 RF-G12 | «El sistema debe permitir una clasificación rápida de la dificultad del banco semilla». Should, HU-25 (pendiente), CU-19a. |
| DAS §4, lista de casos de uso | CU-19a «Clasificar dificultad del banco semilla (extend, pendiente)», actor docente revisor. **No tiene ficha.** |
| DAS §4, CU-19 | Pasos: 2 muestra la pregunta completa **sin la dificultad sugerida** ni la decisión del otro; 3 el docente responde **cada punto de la pauta**; 4 asigna la dificultad; 5 decide aprobar, observar o rechazar; 7 combina las dos revisiones según RN-11. Referencias: HU-25, RF-G12; «extendido por CU-19a». |
| DAS §4, CU-18 7.a | Las importadas siguen el camino de siempre: el administrador las envía a revisión (CU-18) y los docentes asignan su dificultad (CU-19 **o CU-19a**), porque la IA o el autor solo la sugieren (RN-12). |
| RN-10 | Cada pregunta la revisan dos docentes especialistas en su área, que no sean su autor ni quien solicitó el lote, de forma independiente. |
| RN-11 | Dos aprobaciones: aprobada; dos rechazos: rechazada; alguno observa: observada. Aprueba y rechaza, o dos aprobaciones con dificultades distintas: decide un tercer docente. |
| RN-12 | La IA o el autor solo sugieren la dificultad. Cada revisor asigna la suya **sin ver la sugerencia**; fácil contra difícil marca la pregunta como posiblemente confusa. |
| RN-13 | Solo puede publicarse una pregunta aprobada y con dificultad asignada por un docente. |
| DAS §7.4, fila D03 | «Una pregunta importada por pantalla, con su clasificación, y la dificultad con un clic; al elegir pasa a la siguiente». HU-25 (pendiente), CU-19a, RF-G12. |
| DAS §7.4, D01 | Pauta con los 8 criterios (Sí o No, con observación), dificultad a ciegas, decisión y motivo obligatorio al observar o rechazar. |
| Modelo | `contenido.pregunta`: `importacion_id` («importación de la que proviene»), `dificultad_sugerida_id` («los docentes no la ven»), `dificultad_asignada_id` («definida por los docentes, obligatoria para publicar»). `asignacion_revision` (rol `revisor` o `desempate`, estado, plazo, `UNIQUE (pregunta_id, ronda, docente_id)`), `revision` (`decision_revision_id` y `dificultad_id` **obligatorios**, comentario), `revision_criterio` (`cumple` obligatorio por criterio). No hay tabla, rol, columna ni acción de auditoría propios de la clasificación rápida. |

Contradicciones y vacíos (los decide el equipo en la documentación; el código no los resuelve):

1. **«Un clic» contra la pauta y la decisión.** CU-19 exige responder la pauta (paso 3) y decidir (paso 5), y el modelo guarda una revisión solo con decisión y dificultad. D03 y HU-25 solo piden la dificultad. Sin la ficha de CU-19a, el DAS no dice qué pasa con la pauta y la decisión en la clasificación rápida.
2. **«Un clic» contra RN-10 y RN-13.** La pregunta importada solo se publica aprobada (RN-13), y aprobar exige dos revisiones (RN-10, RN-11). Una clasificación de un solo docente no basta para publicar.
3. **CU-19a sin ficha.** Este plan se apoya en RF-G12, HU-25, CU-18 7.a, CU-19 y la fila D03.
4. **Boceto contra CU-18 7.a.** El boceto dice «Preguntas importadas del banco existente que aún no tienen dificultad»; CU-18 7.a dice que primero el administrador las envía a revisión. Este plan sigue a CU-18 7.a.
5. **Redacción de CU-19 paso 7.** Tiene dos versiones de la misma frase seguidas (la antigua y la que remite a RN-11). Solo de redacción.
6. **Registro oficial.** HU-25 está «Pendiente» en el 04 y no figura en ningún Sprint Backlog ni en el C2. El equipo debe registrarla (con HU-25.1 y HU-25.2) antes de programar.

## 2. Pregunta central: cómo encaja «un clic» con RN-10 y RN-11 (decide Nicolas)

### Opción a · La clasificación rápida es una revisión de la ronda (recomendada)

El docente ve en D03 sus propias asignaciones de revisor pendientes cuyas preguntas son importadas. Un clic en Fácil, Media o Difícil entrega su revisión de la ronda con esa dificultad, la decisión «aprobar» y la pauta completa marcada «se cumple». Cuenta como uno de los dos revisores; cuando el otro entrega (en D03 o en D01), se combinan según RN-11 con el código que ya existe: misma dificultad, aprobada; dificultades distintas, desempate (D02); fácil contra difícil, posiblemente confusa.

- Encaja con CU-18 7.a («CU-19 o CU-19a»), con «extend» (CU-19a es una variante de CU-19 dentro de la misma ronda), con RN-10 (los revisores los elige CU-18: área, ni autor ni solicitante) y con RN-11, RN-12 y RN-13 sin excepciones.
- Para no dar por cumplida una pauta que el docente no quiso aprobar, la pantalla tiene, además de los tres botones, **«Revisar con la pauta»**, que abre esa misma asignación en D01 para observar o rechazar con su motivo. Los tres botones dicen junto a ellos que el clic aprueba la pregunta y da por cumplida la pauta (decisión D2).
- **Modelo: alcanza sin migración.** Se escribe `revision` (decisión `aprobar`, dificultad elegida, sin comentario) y sus 8 filas de `revision_criterio` con `cumple = true`, igual que una entrega de D01, en la misma transacción y con el mismo bloqueo (`FOR UPDATE` de la asignación).
- Límite: el modelo no distingue una revisión rápida de una completa, porque no hay columna ni acción de auditoría para eso. Las rápidas suben la estadística de la pauta (`v_calidad_criterio`) como si el docente hubiera marcado cada punto. Si el equipo quiere distinguirlas, hace falta un cambio del modelo, que este plan no propone (decisión D3).

### Opción b · La clasificación rápida solo fija la dificultad

Un docente cualquiera del área toma una importada sin dificultad, elige una y se guarda; la pregunta igual pasa después por la revisión completa (CU-18 y CU-19).

- No acelera la publicación, que es el objetivo de HU-25: la pregunta sigue necesitando dos revisiones completas.
- Choca con RN-11 y RN-12: si se guarda en `dificultad_asignada_id`, la combinación de la ronda la reemplaza al aprobar (`preguntas.edicion.repositorio.ts` la escribe con la dificultad en que coincidieron); si se guarda en `dificultad_sugerida_id`, deja de ser «de la IA o del autor» y los revisores no la ven.
- **Modelo: técnicamente alcanza** (un `UPDATE` de `contenido.pregunta`), pero no hay dónde guardar quién clasificó: no existe una acción de auditoría para esto y agregarla cambia las semillas. El reparto entre docentes tendría que hacerse con `FOR UPDATE SKIP LOCKED` sobre la pregunta, sin registro.
- No recomendada.

### Opción c · Un solo docente basta para el banco semilla (sale del DAS solo cambiándolo)

El banco existente ya fue usado y validado fuera del sistema, así que la clasificación de un docente aprobaría la pregunta con esa dificultad.

- Es la lectura más literal de «publicar antes», pero **cambia una regla de negocio**: es una excepción a RN-10 y a RN-13 que el DAS no tiene. Antes de programarla, el equipo tendría que escribir la ficha de CU-19a y la excepción en RN-10.
- Modelo: alcanzaría sin migración (una ronda con un revisor), pero `revisores_requeridos` es un solo parámetro para todas las preguntas y la regla saldría del código, no del modelo.
- No se programa sin el cambio del DAS. Se deja escrita solo para que el equipo la descarte o la registre.

**Recomendación: opción a.** Es la única que no contradice ninguna regla y no pide cambios del modelo. El resto del plan supone la opción a.

## 3. Bandeja: qué preguntas entran y cómo se reparten

- Entran las asignaciones del docente de la sesión con rol `revisor`, estado `pendiente`, de la ronda vigente de la pregunta (`ronda = pregunta.ronda_actual`), cuya pregunta está `en_revision` y tiene `importacion_id` no nulo. Las que generó la IA o escribió el administrador siguen solo en D01.
- El área no se filtra aparte: CU-18 ya asignó la pregunta a docentes con el área de su contenido (`docente_especialidad`). Si el docente pierde el área después, la asignación sigue siendo suya, igual que en D01.
- Reparto: no hay toma libre de preguntas. Cada pregunta tiene exactamente sus dos asignaciones (RN-10), y que los dos revisores clasifiquen la misma pregunta es lo que pide RN-10, cada uno a ciegas. Un tercer docente no puede tomarla porque no tiene asignación. Si el mismo docente la entrega dos veces a la vez (dos pestañas), el `FOR UPDATE` de la asignación hace que la segunda reciba 409, como en D01.
- Orden: fecha límite más próxima primero y, a igual fecha, la asignación más antigua (`vence_en, id`), como D01.
- Plazo vencido: como en D01, cuando se construyan HU-27 y HU-28; hoy no se controla.
- Consecuencia práctica: D03 queda vacía hasta que el administrador envíe las importadas a revisión (CU-18 7.a), hoy de a una desde el banco. Un envío en bloque no está en el DAS y queda fuera de este plan (punto 9).

## 4. Contrato propuesto (módulo `revision`, HU-25.1)

Rutas en `revision.rutas.admin.ts`, cada una con `exigirRol('docente')` (administrador sin rol docente 403, token de la app 401):

- `GET /api/v1/admin/revision/clasificar/siguiente?despuesDe=<asignacionId>` → `{ data: { pregunta, quedan } }`. `pregunta` es la siguiente asignación de la bandeja (sección 3) con el mismo formato que `GET /mis-revisiones/:id` sin la pauta ni las decisiones: `asignacionId`, `preguntaId`, prueba, eje, contenido, habilidad, enunciado, alternativas con la correcta marcada, explicación, texto de lectura si tiene (con su imagen) y `venceEn`; además `dificultades` (código y nombre, en orden). `null` si no queda ninguna. `quedan` cuenta todas las de la bandeja. `despuesDe` (opcional) sirve para **saltar**: devuelve la siguiente en el orden después de esa asignación y, si no hay más, vuelve a la primera; una saltada vuelve a aparecer al dar la vuelta.
- `POST /api/v1/admin/revision/clasificar/:id`, cuerpo `{ dificultad: 'facil' | 'media' | 'dificil' }` → 200 con `{ data: { guardada: { asignacionId, dificultad }, siguiente: { pregunta, quedan } } }`. Entrega la revisión como en la sección 2a y, si es la última de la ronda, combina según RN-11 en la misma transacción (`resolverRonda`, el mismo de D01).
- Errores: dificultad que no existe, 400 `VALIDACION`; asignación que no existe, de otro docente o cuya pregunta no es importada, 404 `NO_ENCONTRADO` (no se revela si existe, como D01); asignación ya entregada o cancelada, 409 `CONFLICTO`.
- **La dificultad sugerida no se muestra** (RN-12 y CU-19 paso 2), ni la revisión del otro docente.
- Auditoría: la entrega de una revisión no se audita hoy en D01 (no hay acción en `accion_auditoria`); queda registrada en `revision` y, al combinar, en `historial_estado_pregunta`. D03 hace lo mismo. Si el equipo quiere auditarla, falta la acción en las semillas (decisión D4).
- Archivos: `revision.clasificacion.repositorio.ts` (siguiente, conteo) y `revision.clasificacion.servicio.ts`, que reutiliza la entrega de `revision.bandeja.servicio.ts` con la pauta completa armada en el servidor; validador `esquemaClasificacion` en `revision.validadores.ts`; dos acciones en `revision.controlador.ts`. Se registran las rutas con ids en `comun/ids-respuesta.ts`, `pruebas/inventario-ids.ts` y el escenario de `escenario-ids*.ts`.

## 5. Pantalla D03 (HU-25.2)

- Hook `consola/src/estado/clasificar-dificultad.ts`: carga la siguiente, guarda, salta y lleva el aviso; la página no tiene lógica.
- `PaginaClasificarDificultad.tsx` reemplaza `EnConstruccion`. Encabezado «Clasificar dificultad» con el contador «Quedan N por clasificar». La pregunta con `PreguntaRevisada` de D01 (ubicación en el temario, texto de lectura, alternativas con la correcta marcada, explicación y fecha límite) y la etiqueta «Importada».
- Tres botones grandes Fácil, Media y Difícil con atajos **1, 2 y 3**. La consola no tiene hoy ningún atajo global de teclado y D03 no tiene campos de texto, así que no chocan; el atajo se ignora si el foco está en un campo o hay un modificador (Ctrl, Alt, Meta). Junto a los botones: «Al elegir, apruebas la pregunta con esa dificultad y das por cumplida la pauta. Pasa a la siguiente.»
- Debajo: **Saltar** y **Revisar con la pauta** (enlace a `/revision` con esa asignación abierta, para observar o rechazar).
- Al guardar: aviso breve con `role="status"` («Guardada como Media»), avance automático y foco en el primer botón al cargar la siguiente. Mientras guarda, los botones quedan deshabilitados para evitar dos clics.
- Estados: carga, error con reintento, error al guardar (no avanza y muestra `MensajeError`), y vacío final «No quedan preguntas por clasificar».
- Estilos en `paginas/clasificar-dificultad/clasificar-dificultad.css`, solo con los tokens de `estilos/global.css`; el estado nunca solo con color; 44 px en pantallas táctiles; revisión a 1440 y 390 px en claro y oscuro.

## 6. Pruebas

Servidor (Vitest, primero las pruebas):

- Reglas: el cuerpo de la entrega rápida arma los 8 criterios activos con `cumple = true` y la decisión `aprobar`.
- HTTP: docente 200; administrador sin rol docente 403; token de la app 401; dificultad inválida 400; asignación de otro docente o de una pregunta no importada 404; ya entregada 409; sin preguntas, `pregunta: null` y `quedan: 0`; `despuesDe` salta y da la vuelta; la respuesta no trae la dificultad sugerida.
- Con PostgreSQL: dos docentes de otra área no ven la pregunta; dos entregas simultáneas de la misma asignación, una 200 y otra 409; dos revisores con la misma dificultad, aprobada con `dificultad_asignada_id`; con dificultades distintas, en desempate con su asignación de tercer docente; fácil contra difícil, `posible_ambigua`; una rápida y una completa de D01 se combinan igual.

Consola (Vitest y Testing Library): carga, error con reintento, vacío final; clic y atajo guardan y avanzan; saltar; error al guardar no avanza; foco en el primer botón tras avanzar; atajo ignorado con modificador; uso solo con teclado. Se quita `/clasificar-dificultad` de la lista «En construcción» de las pruebas de navegación si aparece.

## 7. Estimación

| Tarea | Horas |
| --- | --- |
| HU-25.1 servidor (repositorio, servicio, validador, controlador, rutas e inventario de ids) | 5 |
| HU-25.1 pruebas, incluidas las de PostgreSQL | 4 |
| HU-25.2 servicio, tipos y hook de la consola | 3 |
| HU-25.2 página, atajos, foco y estilos | 4 |
| HU-25.2 pruebas de la consola | 3 |
| Cierre (verificación, `docs/arquitectura.md`, PR) | 2 |
| **Total** | **21** |

Cuadra con los 3 puntos del 04.

## 8. Decisiones que necesitan visto bueno

- **D1. Opción a, b o c** (sección 2). Recomendada: a.
- **D2.** En la opción a, el clic aprueba y da por cumplida la pauta, con el aviso junto a los botones y la salida «Revisar con la pauta» hacia D01.
- **D3.** Aceptar que el modelo no distinga una revisión rápida de una completa (y que las rápidas cuenten en la calidad de la pauta). Distinguirlas pide un cambio del modelo que el equipo decidiría aparte.
- **D4.** Sin auditoría propia de la entrega, igual que D01.
- **D5.** Atajos 1, 2 y 3, y «Saltar» que da la vuelta a la bandeja.

## 9. Documentación pendiente para el equipo

1. Registrar HU-25 en el 04 (pasa de «Pendiente» al sprint vigente) y en el Sprint Backlog con HU-25.1 (servidor) y HU-25.2 (consola), con sus horas.
2. Escribir la ficha de CU-19a en el DAS con la opción elegida: qué pasa con la pauta y la decisión, y que cuenta como uno de los dos revisores.
3. Agregar a la C2 un caso de prueba de HU-25 (RF-G12, CU-19a).
4. Corregir la doble frase de CU-19 paso 7.
5. Alinear el texto del boceto D03 («que aún no tienen dificultad») con CU-18 7.a.
6. Si se quiere vaciar el banco semilla más rápido: el envío en bloque de importadas a revisión (CU-18) no está en el DAS; sería otra historia.
