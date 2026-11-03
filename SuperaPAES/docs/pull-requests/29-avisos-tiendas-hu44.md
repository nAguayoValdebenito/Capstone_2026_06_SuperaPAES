# HU-44 y HU-45.1 · Avisos de las tiendas

Rama `feat/hu-44-avisos-tiendas`. Solo servidor. Sigue el prompt 29 por etapas; plan y decisiones en el contrato local
`docs/contratos/HU-44.md`. Fuente: DAS 1.21 (CU-12, RN-04, RN-17, RN-26, RN-34, 4.3.3 y 4.5.3).

## Qué hace

Las rutas `POST /api/v1/webhooks/google-play` y `POST /api/v1/webhooks/app-store` dejan de responder «no implementado».
La API no confía en el tipo ni en el orden del aviso:

1. **Verifica el origen**, fuera de la transacción.
   - Google: el token OIDC del push de Pub/Sub, con las llaves públicas de Google (`jose`), el emisor, la audiencia
     `GOOGLE_PLAY_PUBSUB_AUDIENCIA` y el correo verificado. Además, el paquete de la notificación.
   - App Store: el `signedPayload` con `SignedDataVerifier`, con la misma cadena de Apple, bundle y entorno que HU-43.1.
2. **Consulta a la tienda el estado de hoy** de la compra, también fuera de la transacción. En Google se usa
   `subscriptionsv2.get` y en la App Store, Get All Subscription Statuses. La consulta se comparte con la validación de
   compras de HU-43.1.
3. **En una transacción:**
   - registra el aviso una sola vez en `app.evento_pasarela` (`ON CONFLICT DO NOTHING` y bloqueo del ya registrado);
   - bloquea la suscripción y la lleva al estado de la tienda si RN-26 lo permite;
   - registra cada paso en `app.suscripcion_evento`, con origen `pasarela` y ligado al aviso;
   - registra el cobro nuevo en `app.pago`, una sola vez;
   - cierra el aviso como `procesado`, o `ignorado` con su motivo.
4. **Después de confirmar la transacción**, si la suscripción entró en mora, programa el correo de mora en segundo plano.

**Tarea horaria (HU-45.1):** `POST /api/v1/tareas/periodicas` también deja cancelada cada activa que canceló la
renovación y terminó su período hace más de un día. Así se cubre el aviso de vencimiento que no llegó. El cierre queda
en el historial con origen `sistema`, y la respuesta suma `suscripcionesCanceladas`.

## Decisiones aprobadas el 03/11/2026 (para revisar)

| Caso | Decisión |
|---|---|
| Reembolso o revocación (RN-26 no tiene «revocada») | **Cancelada**, también desde en mora. El detalle del historial dice «Reembolso o revocación de la tienda» |
| Retención de cuenta de Google (ON_HOLD) | **En mora**: RN-26 no tiene un estado «en mora sin acceso» |
| Activa que vence por cobro sin período de gracia | Dos registros con el mismo aviso: activa → en mora → vencida |
| En mora que termina sin cobrarse, aunque haya cancelado | Vencida |
| Correo de mora (CU-12 4.b) | Sí, en esta rama; nunca a una cuenta borrada (RN-34) |
| Correo de la cuenta de servicio de Pub/Sub | No se exige: sería una variable nueva |
| PAUSED y estado sin especificar de Google | Se ignoran con su motivo; la app no ofrece pausar |
| App Store fuera de sandbox | 503 **sin registrar** el aviso. No se guarda lo que no se pudo verificar y Apple reintenta. El prompt decía registrarlo |
| Una pendiente que la app no alcanzó a validar | Se liga por la cuenta en la tienda (`cuentaEnTienda`) y se aplica como la validación |

## Respuesta a cada tienda

| Caso | Respuesta | ¿Se registra? |
|---|---|---|
| Procesado, ignorado, repetido, compra desconocida, cuenta borrada | 200 `{ recibido: true }` | Sí (el repetido, una vez) |
| Google sin token o con token inválido | 401 | No |
| App Store con firma inválida, cadena ajena u otra app; cuerpo mal formado | 400 | No |
| La tienda no responde | 503: la tienda reintenta | Sí, como `error`; el reintento lo procesa sobre la misma fila |
| App Store fuera de sandbox o revocación de la cadena no comprobable | 503 | No |

La respuesta nunca lleva tokens, firmas, el contenido del aviso ni el mensaje del error. Los registros guardan solo la
tienda, el tipo y el resultado.

## Cambios en archivos del módulo `suscripciones` (de Nicolas)

- `suscripciones.servicio.ts`:
  - `recibirAviso` delega en `suscripciones.avisos.servicio.ts`;
  - se agrega `cerrarCanceladasVencidas`;
  - se agrega la dependencia opcional `correoMora`.
- `suscripciones.compras.repositorio.ts`: `registrarCambio` acepta el origen `pasarela` o `sistema`, con su aviso y un
  detalle. El comentario del código ya lo anticipaba.
- `adaptadores/pagos/pasarela.ts`:
  - `SuscripcionEnTienda` informa el estado en la tienda (`EstadoEnTienda`), por qué terminó (`FinEnTienda`), el
    producto, la cuenta, el período, el cobro y la renovación;
  - `AvisoVerificado` suma `reembolso`.
- Archivos nuevos:
  - `suscripciones.transiciones.ts` (tabla de RN-26);
  - `suscripciones.avisos.repositorio.ts`, `.servicio.ts` y `.correo.ts`;
  - `suscripciones.cierre.repositorio.ts`;
  - `adaptadores/pagos/google-play-avisos.ts` y `app-store-avisos.ts`.
- `app.ts` conecta el correo de mora (con cuentas, el proveedor de correo y el segundo plano) y la tarea horaria. El
  módulo `cuentas` no cambia: se usa `exportarCuenta`, que da 404 para una cuenta borrada.
- Sin cambios de esquema, migraciones, semillas ni variables de entorno. `operaciones/despliegue.md` explica a dónde
  configurar los avisos en cada tienda.

## Texto nuevo para aprobar (correo de mora)

> **Asunto:** No se pudo cobrar la renovación de tu plan
>
> Hola, {nombre}:
>
> {Google Play | La App Store} no pudo cobrar la renovación de tu plan de Supera PAES. Mientras la tienda vuelve a
> intentarlo, sigues con todos los beneficios de tu plan.
>
> Para no perderlos, revisa tu medio de pago en {la tienda}. Si la tienda no logra cobrar, el plan termina y vuelves al
> plan Gratis. También lo puedes ver en la app, en Perfil > Mi suscripción.
>
> Equipo Supera PAES

## Probado con respuestas simuladas

Ninguna prueba llama a Google ni a Apple:
- las llaves de Pub/Sub y la cadena de certificados de Apple se generan en memoria;
- las respuestas de las API de las tiendas son fixtures construidos según la documentación oficial.

| Archivo | Qué cubre |
|---|---|
| `suscripciones-transiciones.test.ts` | Tabla de RN-26 y las decisiones |
| `suscripciones-avisos-bd.test.ts` | Renovación, mora, recuperación, vencida, cancelación, reembolso, cambio de plan, cambio no permitido, sin cambios |
| `suscripciones-avisos-una-vez-bd.test.ts` | Repetido, dos iguales a la vez, tienda caída y reintento, compra desconocida, aviso sin compra, pendiente ligada por la cuenta, producto de otro plan |
| `google-play-avisos.test.ts` y `google-play-avisos-bd.test.ts` | Token (válido, otra llave, audiencia, emisor, sin correo verificado, vencido), paquete, tipos de RTDN, cada estado de `subscriptionsv2`, la pasarela real con el núcleo |
| `app-store-avisos.test.ts` y `app-store-avisos-bd.test.ts` | Firma (válida, cadena ajena, otra app), tipos y subtipos, producción, cada estado, renovación apagada, subida y bajada de plan, la pasarela real con el núcleo |
| `suscripciones-avisos-recorrido-bd.test.ts` | Recorrido por tienda: compra, renovación, mora, recuperación, cambio de plan, cancelación y vencimiento, con `cubrePrueba` (RN-04) e historial sin saltos; correo de mora y cuenta borrada; cierre de respaldo de la tarea horaria |

## Pendiente de probar con una compra de prueba real

No se hará en esta versión, porque el equipo no paga Google Play Console ni Apple Developer. Queda pendiente:
- un aviso real de Pub/Sub con la cuenta de servicio del proyecto;
- una notificación real de sandbox de App Store Connect;
- el comportamiento de cada tienda ante un reembolso o una pausa reales.

## Revisión de seguridad

Revisión manual de la rama, con el foco del prompt:
- **Autenticación:** cada aviso se verifica antes de tocar la base, con token RS256 de Google con emisor, audiencia,
  vencimiento y correo verificado, o con firma de Apple con cadena, bundle, entorno y OCSP en producción.
- **Avisos sin firma:** la pasarela simulada, que los acepta, está prohibida en producción (`configuracion.ts`).
- **Idempotencia:** índice único en `id_evento_pasarela` y bloqueo de la fila.
- **Orden de bloqueos:** aviso → suscripción. La validación de compras solo bloquea la suscripción, y la tarea horaria
  usa `SKIP LOCKED`.
- **Compra de otra cuenta:** solo se liga por la cuenta lo que la tienda informó en una compra verificada.
- **Datos sensibles:** ni tokens, firmas ni datos de la compra en registros, respuestas, errores o correos. Cuerpo
  limitado a 1 MB.

No se encontraron fallas.

**Observación menor:** la búsqueda por cuenta recorre las pendientes y fallidas sin compra de la tienda. Con el volumen
del proyecto no pesa; si creciera, convendría guardar la cuenta en la tienda.

## Verificación

- `npm run lint`, `npm run codigo-muerto`, `npm run circulares` y `npm run revisar-secretos`: sin observaciones.
- `npm run duplicacion`: los 5 clones que ya estaban en `main`.
- `npx vitest run` (API): 1.639 aprobadas y 74 omitidas (solo de la CI).
- Las pruebas de suscripciones con PostgreSQL, tres veces seguidas: 64 de 64 cada vez.
- `npm run probar:bd`: 249 de 249.
