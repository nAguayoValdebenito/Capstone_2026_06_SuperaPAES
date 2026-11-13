# Plan HU-55 + HU-09 · Solicitudes de datos (C14 y servidor de la app)

Estado al 13/11/2026: **terminado en la rama, sin push. Plan y decisiones D1 a D9 aprobados por Nicolas; HU-09.1, HU-55.1 y HU-55.2 implementadas, verificadas y confirmadas (`da58b8b`, `3911cc9`, `df99e08`, `93ec14d`)**. Falta registrar HU-09 y HU-55 en la documentación oficial (sección 10). Rama `feat/hu-55-solicitudes-datos`, creada desde `origin/main` en `f8f7672` (ya incluye HU-50 y HU-51). Este plan no modifica el esquema, las migraciones, las semillas ni los documentos oficiales. Prompt: `C14_Solicitudes_de_datos_HU-55_v2.md`.

Fuentes leídas: DAS 1.21, 02 Épicas e Historias v1.8, 03 Historias de Usuario v1.8, 04 Product Backlog y Sprint Backlogs 4 a 9 (copias de `referencia_oficial` de la biblioteca del proyecto; no existe `docs/referencia_oficial/` en el equipo), C2 v1.13, la política de privacidad 1.0 (semilla `003_documentos_legales.sql`, texto de DOC-06), `001_esquema_inicial.sql`, el módulo `privacidad`, el borrado de cuenta de `cuentas` y la consola (`paginas/solicitudes-datos`, C13 como referencia). Boceto `C14_solicitudes_datos.png` solo como referencia visual.

## 1. Fuentes y contradicciones

| Fuente | Qué dice |
| --- | --- |
| 03 v1.8, HU-09 | Esc. 1 «Enviar una solicitud»: el estudiante con sesión elige el tipo y la envía; queda pendiente con fecha límite a 30 días corridos. Esc. 2 «Ver la respuesta»: ve si fue respondida o rechazada y la respuesta. No pide detalle obligatorio ni limita envíos. |
| 03 v1.8, HU-55 | Esc. 1 «Bandeja ordenada»: ve las pendientes con la fecha límite más próxima primero. Esc. 2 «Responder»: responde o rechaza con un texto; cambia de estado y queda quién la atendió y cuándo. |
| 02 v1.8 | Mismas historias y escenarios (filas HU-09 y HU-55); E1 incluye «las solicitudes de datos». |
| 04 Product Backlog | Orden 71 HU-09: 3 puntos, Should, **Pendiente**. Orden 82 HU-55: 3 puntos, Should, **Pendiente**. |
| 05 Sprint Backlog 4 a 9 | Ninguno contiene HU-09 ni HU-55. |
| C2 v1.13 | No hay caso de prueba de HU-09, HU-55, RF-A21 ni RF-C10. |
| DAS §2.3 RF-A21 | Solicitar desde la app acceso, corrección, supresión, oposición, portabilidad o bloqueo, con fecha límite de 30 días corridos, y consultar estado y respuesta. |
| DAS §2.3 RF-C10 | Mostrar las pendientes ordenadas por fecha límite; responder o rechazar con un texto, registrando quién y cuándo. |
| DAS §2.4 RNF-09 | Cumplir la Ley 21.719. Dice que HU-09 y HU-55 están pendientes y que **mientras tanto** las solicitudes llegan al correo de contacto y se responden en 30 días. |
| DAS §2.4, tabla de parámetros | `plazo_derechos_dias` = 30 días corridos (RF-A21, RNF-09). |
| DAS §4, CU-14 | Referencia HU-09 (pendiente); alternativa 3.b remite las solicitudes formales a HU-09. |
| DAS §4, CU-33 | Solo aparece en la lista como «Atender solicitudes de datos (pendiente)». **No tiene ficha.** |
| DAS §7.2, A40 | «Seis tipos de solicitud según la Ley 21.719, con su detalle, el plazo de respuesta de 30 días corridos y el estado y la respuesta de cada una» (pendiente). |
| DAS §7.2, C14 | «Solicitudes de la Ley 21.719 pendientes, ordenadas por fecha límite; responder o rechazar con un texto, con registro de quién y cuándo» (pendiente). |
| DOC-06, política de privacidad 1.0 | §3: los correos del servicio incluyen «respuestas a tus solicitudes». §7: «El registro de las solicitudes sobre datos se conserva para acreditar que se respondieron». §8: lista lo que se hace desde la app (descarga, perfil, borrado, permiso de puntajes) y para «cualquier otra solicitud» remite al correo de contacto, con respuesta en 30 días corridos. |
| Modelo 11.0 | `app.solicitud_derecho` con `detalle TEXT` **opcional** («Lo que pide el estudiante, si lo explica»), `vence_en` «calculado al recibirla», `CHECK (vence_en > solicitado_en)`, disparador que exige `respondido_en` si y solo si el estado es final, índice `ix_solicitud_pendientes (estado_solicitud_id, vence_en)`. Listas: `tipo_derecho` (acceso, rectificacion, supresion, oposicion, portabilidad, bloqueo, con nombre y descripción) y `estado_solicitud` (pendiente, respondida, rechazada, con `es_final`). Acción de auditoría `responder_solicitud`. |

Contradicciones y vacíos (no se resuelven en el código; los decide el equipo en la documentación):

1. **Correo al responder.** La política (§3) promete correos con las respuestas a las solicitudes. El DAS (RF-A21, RF-C10, A40, C14) y HU-09 esc. 2 solo dicen que el estudiante ve el estado y la respuesta en la app, y el boceto C14 dice «El estudiante ve el estado y la respuesta en la app». Ver punto 4.
2. **La política no menciona las solicitudes desde la app.** Su §8 remite al correo para «cualquier otra solicitud». Cuando HU-09 exista habrá que actualizar la política (cambio menor, RN-30) y el texto de RNF-09 («mientras tanto… por correo»).
3. **CU-33 sin ficha** en el DAS. Este plan se apoya en RF-C10, HU-55 y C14.
4. **Detalle.** El modelo lo deja opcional y HU-09 esc. 1 solo exige elegir el tipo; el prompt pide rechazar el detalle vacío. A40 dice «con su detalle» sin decir si es obligatorio. Recomendación: opcional, como el modelo (decisión D2).
5. **Comentario de `atendido_por`**: «Vacío si la atendió el sistema, como en una descarga o eliminación automática». Sugiere que la descarga (HU-07) o el borrado (HU-08) podrían crear o cerrar solicitudes, pero ningún documento lo describe. No se implementa.
6. **Registro oficial.** HU-09 y HU-55 están «Pendiente» en el 04 y no figuran en ningún Sprint Backlog ni en el C2. Igual que en HU-51, el equipo debe registrarlas (con HU-09.1, HU-55.1 y HU-55.2) antes de programar.

## 2. Servidor de HU-09 (lado app) · HU-09.1

Rutas en `privacidad.rutas.app.ts` (JWT de la app; el token de la consola da 401):

- `GET /api/v1/app/privacidad/tipos-derecho` → `{ data: { tipos: [{ codigo, nombre, descripcion }] } }`. A40 necesita los seis tipos con su explicación; la app nunca usa ids de la lista.
- `POST /api/v1/app/privacidad/solicitudes`, cuerpo `{ tipo: <codigo>, detalle?: string }` → 201 con la solicitud creada: `{ id, tipo: { codigo, nombre }, detalle, estado: { codigo, nombre }, solicitadoEn, venceEn, respondidoEn: null, respuesta: null }`.
- `GET /api/v1/app/privacidad/solicitudes` → las propias, de la más reciente a la más antigua, con el mismo formato (incluye `respuesta` y `respondidoEn` si ya se atendió). Sin paginación: un estudiante tendrá pocas; si el equipo prefiere, se pagina igual que la consola.

Reglas:

- `tipo` debe existir en `contenido.tipo_derecho` (por `codigo`): si no, 400 `VALIDACION`.
- `detalle`: opcional; se recortan los espacios y uno vacío se guarda como `null`. Largo máximo propuesto 2.000 caracteres (400 si se excede). El DAS no fija largo; RNF-02 exige validar toda entrada (decisión D2).
- `solicitado_en` = `reloj()`; `vence_en` = `solicitado_en + plazo_derechos_dias` días corridos, con el plazo leído por `administracion.obtenerParametroEntero('plazo_derechos_dias')`, nunca por su repositorio. El estado inicial es `pendiente`. Así un cambio del parámetro en C12 solo afecta a las solicitudes nuevas (el modelo dice «calculado al recibirla»), lo que cierra el punto 5 pendiente del plan de HU-51.
- Más de una pendiente del mismo tipo, límite de envíos o límite de intentos: **el DAS no dice nada** (RNF-02 limita ingreso, registro, invitaciones y reenvío de correo, no solicitudes). No se agrega ninguna regla (decisión D3).
- El estudiante solo ve las suyas: el repositorio filtra siempre por el `estudiante_id` de la sesión.

Archivos: `privacidad.repositorio.ts` (o `privacidad.solicitudes.repositorio.ts` si crece), `privacidad.solicitudes.servicio.ts` integrado en `privacidad.servicio.ts`, `privacidad.validadores.ts` (zod), `privacidad.controlador.ts`, `privacidad.rutas.app.ts`. En `app.ts`, `crearPrivacidadServicio` recibe además `administracion` (con `Pick<…, 'obtenerParametroEntero' | 'registrarAuditoria'>`); `administracion` ya se crea antes. Se quita la etiqueta `@esqueleto` del repositorio. Las rutas con ids se registran en `comun/ids-respuesta.ts`, `pruebas/inventario-ids.ts` y el escenario de `escenario-ids*.ts`. La descarga de datos (HU-07) no cambia: CU-14 3.a no incluye las solicitudes.

## 3. Servidor de HU-55 (lado consola) · HU-55.1

Rutas en `privacidad.rutas.admin.ts`, cada una con `exigirRol('admin')` (docente 403, token de la app 401):

- `GET /api/v1/admin/privacidad/solicitudes?estado=pendiente&pagina=1&porPagina=20`. `estado` ∈ `pendiente` (por defecto), `respondida`, `rechazada`. Pendientes ordenadas por `vence_en` ascendente (usa `ix_solicitud_pendientes`); respondidas y rechazadas por `respondido_en` descendente (el DAS solo ordena las pendientes; decisión D6). `meta` = `{ pagina, porPagina, total }`. Además `data.conteo` con el total de pendientes, para la pestaña.
- `GET /api/v1/admin/privacidad/solicitudes/:id` → una solicitud; 404 si no existe.
- `PATCH /api/v1/admin/privacidad/solicitudes/:id`, cuerpo `{ estado: 'respondida' | 'rechazada', respuesta: string }`.

Cada solicitud en la consola: `{ id, tipo: { codigo, nombre }, detalle, estado: { codigo, nombre }, solicitadoEn, venceEn, diasRestantes, vencida, respondidoEn, respuesta, atendidoPor: { id, nombre } | null, estudiante: { id, nombre, correo, cuentaEliminada } }`.

- `diasRestantes` y `vencida` los calcula el servicio con `reloj()`: `vencida = ahora > venceEn` (solo en pendientes); `diasRestantes` = días de calendario de Chile entre hoy y la fecha límite (negativo si venció). La consola no recalcula la regla.
- Datos del estudiante (RNF-09): solo nombre y correo, que hacen falta para identificarlo y atender una rectificación. Nada de perfil, evaluaciones ni suscripción. Se leen con una unión de solo lectura a `app.estudiante`, como ya hacen `suscripciones.trazabilidad.repositorio.ts` y `evaluaciones.repositorio.ts`; ningún repositorio ajeno se importa (decisión D5: ¿basta el correo, como en el boceto?).
- Responder o rechazar, en `unidadDeTrabajo.enTransaccion`:
  1. `SELECT … FOR UPDATE` de la solicitud con su estado (404 si no existe).
  2. Si su estado ya es final: 409 `CONFLICTO` («La solicitud ya está «Respondida».»). Como la fila queda bloqueada, de dos administradores que responden a la vez solo pasa el primero; el segundo ve el estado final y recibe 409 (mismo patrón que C13).
  3. `UPDATE` de `estado_solicitud_id`, `respuesta`, `respondido_en = reloj()` y `atendido_por = <admin de la sesión>`.
  4. `administracion.registrarAuditoria` con `responder_solicitud`, `entidad = 'solicitud_derecho'`, `entidad_id`, `antes = { estado: 'pendiente' }` y `despues = { estado, respondidoEn, atendidoPor }`, con el mismo `tx`. Si la auditoría falla, no se guarda nada.
- `respuesta`: obligatoria, recortada, no vacía (400 `VALIDACION`), máximo propuesto 2.000 caracteres (D2).
- La respuesta (texto libre que puede contener datos personales) se guarda en la solicitud, no en la auditoría (decisión D4).

Archivos: los mismos del módulo (repositorio, servicio, validadores, controlador y `privacidad.rutas.admin.ts`), más `pruebas/inventario-rutas-admin.test.ts` y los inventarios de ids. Actualizar la tabla de endpoints de `docs/arquitectura.md` y escribir `docs/pull-requests/hu-55-solicitudes-datos.md`.

## 4. Qué pasa al responder

El DAS no pide avisar por correo: RF-A21, RF-C10, A40, C14 y HU-09 esc. 2 solo dicen que el estudiante ve el estado y la respuesta en la app. La política de privacidad sí promete «respuestas a tus solicitudes» por correo. **No se agrega el correo en este trabajo**; queda como decisión D1 para el equipo (si se aprueba, se haría con el adaptador de correo existente, fuera de la transacción, y sin enviar nada a una cuenta eliminada).

## 5. Cuenta borrada (HU-08)

- Hoy `cuentas.eliminacion.repositorio.ts` no toca `app.solicitud_derecho`: la fila de `app.estudiante` no se borra, sino que se seudonimiza (`nombre = 'Cuenta eliminada'`, `correo = 'eliminada-<id>@cuentas.invalid'`, `eliminado_en`). Las solicitudes siguen apuntando a ella y la clave foránea `RESTRICT` no se rompe. Esto calza con la política §7: el registro de las solicitudes se conserva.
- En la consola, una cuenta con `eliminado_en` se devuelve con `nombre: null`, `correo: null` y `cuentaEliminada: true` (como hace la trazabilidad de suscripciones); la tabla muestra el texto «Cuenta eliminada». La bandeja no falla.
- Una solicitud **pendiente** de una cuenta eliminada: el DAS no dice nada. Propuesta: sigue en la bandeja, se puede responder o rechazar para dejar constancia, y el panel avisa que el estudiante ya no podrá ver la respuesta. No se cierra sola ni se cambia HU-08 (decisión D7).

## 6. Pantalla C14 · HU-55.2

- Encabezado «Solicitudes de datos» y subtítulo con el plazo vigente («Plazo de respuesta: N días corridos»), tomado de la respuesta de la API; si no se quiere otra llamada, se omite el número.
- Filtro por estado con `Pestanas`: Pendientes (con su conteo), Respondidas, Rechazadas. Por defecto, Pendientes.
- Tabla con `EncabezadoTabla` y `Paginacion`: fecha límite y plazo, tipo, estudiante, recibida. La de fecha límite más cercana arriba.
- Etiqueta de plazo con texto y forma, nunca solo color: «Vencida hace 2 días» (con ícono de alerta), «Vence en 3 días» (vence pronto) y «En 16 días» (a tiempo). El umbral de «vence pronto» no está en el DAS: propuesta 7 días, como constante de presentación de la consola (decisión D8). Sin `--aviso` ni ámbar nuevos: vencida con el token `--error` más texto e ícono; las otras con `--texto` y `--texto-secundario`.
- Singular y plural («1 día», «3 días») y fechas `dd/mm/aaaa` en hora de Chile.
- **Detalle en panel lateral**, como C13 y el boceto. Razones: la bandeja ordenada por plazo sigue a la vista mientras se atiende una, se pasa a la siguiente sin perder el lugar, y es el patrón que ya usa el administrador en Avisos de error. A 390 px el panel se apila bajo la tabla y recibe el foco al elegir una fila.
- El panel muestra tipo, estudiante (o «Cuenta eliminada»), detalle (o «Sin detalle»), recibida, fecha límite y, si está atendida, estado, respuesta, quién y cuándo, **sin formulario**. Si está pendiente: campo «Respuesta al estudiante» con etiqueta, error unido por `aria-describedby` y `aria-invalid`, y botones Responder y Rechazar. Sin texto no se abre la confirmación.
- Confirmación (diálogo) que repite la acción y el texto, se cierra con Escape y devuelve el foco al botón que la abrió. Al guardar: aviso de éxito con `role="status"`, la solicitud sale de Pendientes y baja el conteo. Ante 409: aviso y recarga de la solicitud. Estados de carga, error con reintento y vacío («No hay solicitudes pendientes»).
- Archivos: `servicios/privacidad.ts`, `tipos/solicitudes-datos.ts`, `estado/solicitudes-datos.ts` (hook con la lógica), `paginas/solicitudes-datos/PaginaSolicitudesDatos.tsx` y componentes de tabla, panel y confirmación, `solicitudes-datos.css` solo con tokens existentes. Revisar a 1440 y 390 px.

## 7. Pruebas y estimación

| Tarea | Pruebas (primero) | Horas |
| --- | --- | ---: |
| HU-09.1 servidor app | Sin base: 201 al crear y 200 al listar; sin token 401; token de consola 401; tipo inexistente 400; detalle demasiado largo 400; detalle vacío se guarda como `null` (o 400 si se decide obligatorio, D2); tipos con sus seis códigos. Con PostgreSQL: `vence_en` sale del parámetro (se cambia en la prueba y cambia el plazo); el estudiante solo ve las suyas; inventario de ids. | 6 |
| HU-55.1 servidor consola | Sin base: admin 200; docente 403; token de la app 401; respuesta vacía 400; estado inválido 400; inexistente 404; ya atendida 409 `CONFLICTO`. Con PostgreSQL: orden por fecha límite; vencida marcada y días restantes con reloj fijo; filtro y paginación; responder guarda estado, texto, autor y fecha; auditoría con antes y después; si la auditoría falla no se guarda nada; dos respuestas simultáneas dejan una sola; cuenta seudonimizada se lista sin error y sin correo. | 8 |
| HU-55.2 consola | Carga, error con reintento, vacío; orden por fecha límite; etiqueta vencida y plurales; respuesta sin texto no se envía; confirmación, guardado y salida de Pendientes; 409; solicitud atendida sin formulario; cuenta eliminada; teclado, Escape y foco; 1440 y 390 px. | 10 |
| Cierre | Lint, test, build, Knip, Madge, jscpd y secretlint; diff contra `origin/main`; endpoints en `docs/arquitectura.md`; descripción del PR con capturas; lista de documentación pendiente. | 2 |

**Total preliminar: 26 h.** Cada etapa termina con `npm run lint`, `npm test` y `npm run build` desde `SuperaPAES/` y los controles del CI; las pruebas con PostgreSQL se corren con `DATABASE_URL_PRUEBAS` sobre una base `_test` y, si no se pueden correr, se informa.

## 8. Decisiones que necesitan visto bueno

- **D1** Correo al responder: no se envía (DAS) aunque la política lo prometa. Recomendado: no enviar ahora y que el equipo alinee la política o el DAS.
- **D2** Detalle opcional (modelo y HU-09) y largo máximo de 2.000 caracteres para detalle y respuesta. Recomendado: sí.
- **D3** Sin límite de pendientes por tipo ni de envíos, porque el DAS no lo pide. Recomendado: sí.
- **D4** La auditoría guarda estado, fecha y autor, no el texto de la respuesta. Recomendado: sí (RNF-09).
- **D5** La consola muestra nombre y correo del estudiante (unión de solo lectura a `app.estudiante`, como HU-56). Alternativa: solo el correo, como el boceto.
- **D6** Respondidas y rechazadas ordenadas por fecha de respuesta, la más reciente primero.
- **D7** Pendientes de una cuenta eliminada: siguen en la bandeja y se pueden atender, con aviso.
- **D8** «Vence pronto» con 7 días o menos (solo presentación).
- **D9** Detalle en panel lateral, como C13.

## 9. Documentación pendiente para el equipo

Registrar HU-09 y HU-55 en el 04 y en el Sprint Backlog vigente con HU-09.1, HU-55.1 y HU-55.2, responsables y horas; escribir la ficha CU-33 en el DAS; agregar los casos de prueba al C2; actualizar RNF-09 y la política (§8, cambio menor según RN-30) cuando las solicitudes lleguen por la app; decidir D1; y recordar que la pantalla A40 de la app (Flutter) sigue pendiente.

## 10. Cierre (13/11/2026)

- Diff contra `origin/main`: 38 archivos, todos del plan (módulo `privacidad`, consola C14, pruebas,
  `docs/arquitectura.md`, este plan, la descripción del PR y sus capturas). Sin cambios en el esquema,
  las migraciones ni las semillas. Fuera de lo previsto: `privacidadDe()` en `app.ts` (para no pasar las
  50 líneas de `crearServicios`), dos ignorados de `knip.json` que ya no hacían falta y los ayudantes
  de pruebas jsdom en `consola/src/pruebas/interaccion.ts`, que ahora comparten C12 y C14.
- Las pruebas de navegación no tienen una lista de páginas «En construcción»: no hubo nada que quitar.
- `origin/main` avanzó (imágenes de las preguntas y rediseño F6 y F7 de la app); la rama se une sin
  conflictos (`git merge-tree`).
- Verificación final: lint, build, Knip, Madge y secretlint sin hallazgos; jscpd 14 repeticiones (12 en
  `main`; las 2 nuevas son trozos cortos parecidos a C13). API 1.163 pruebas aprobadas y 852 omitidas sin
  base; consola 423 aprobadas. Con PostgreSQL (`supera_paes_test`): las 9 pruebas nuevas y las de borrado
  y descarga de la cuenta aprobadas.

Documentación pendiente para el equipo (no se editaron los documentos oficiales):

1. 04 Product Backlog: pasar HU-09 y HU-55 de «Pendiente» al sprint en que se registren.
2. Sprint Backlog vigente: HU-09.1 (servidor de la app, 6 h estimadas), HU-55.1 (servidor de la consola,
   8 h) y HU-55.2 (pantalla C14, 10 h), con responsables y horas reales.
3. C2: casos de prueba de HU-09 (enviar con plazo del parámetro, tipo inexistente, ver solo las propias)
   y de HU-55 (orden por fecha límite, vencida, responder con auditoría, respuesta obligatoria, 409 si ya
   se atendió, cuenta eliminada, permisos), con las pruebas automáticas como evidencia.
4. DAS: escribir la ficha CU-33; marcar RF-A21, RF-C10, CU-14 3.b y C14 como implementados; actualizar
   RNF-09, que dice que las solicitudes llegan por correo mientras HU-09 y HU-55 estén pendientes.
5. Política de privacidad (DOC-06): §8 debe mencionar las solicitudes desde la app (cambio menor, RN-30)
   y §3 promete correos con las respuestas, que no se envían (D1). Decidir y alinear el DAS o la política.
6. Registrar en la documentación las decisiones D2 a D9 (detalle opcional y 2.000 caracteres, sin límite
   de envíos, auditoría sin el texto, nombre y correo del estudiante, orden de las atendidas, cuentas
   eliminadas, «vence pronto» con 7 días y panel lateral).
7. La pantalla A40 de la app (Flutter) sigue pendiente: el servidor de HU-09.1 ya está listo para ella.
