# HU-45.3 · Correo real por SMTP

## Qué se implementa

- El proveedor `smtp` envía los correos existentes de verificación y recuperación sin cambiar sus
  plantillas ni los servicios de cuentas.
- Brevo se configura en Render por el puerto 2525 con STARTTLS obligatorio. Si el servidor no ofrece
  cifrado, el envío falla antes de transmitir credenciales o contenido.
- Mailpit sigue disponible en localhost:1025 sin TLS ni autenticación.
- El registro responde apenas la cuenta y su sesión quedan creadas; el correo de verificación se
  envía en segundo plano sin cambiar el contrato de la respuesta. La recuperación mantiene el mismo
  comportamiento asíncrono y responde 202.

## Variables

Con `PROVEEDOR_CORREO=smtp`, Render requiere estas seis variables:

- `SMTP_HOST`: servidor SMTP indicado por el proveedor.
- `SMTP_PORT`: 2525 para Brevo en Render; también se admite 465 o 587 según el modo TLS.
- `SMTP_TLS`: `implicit` para 465 o `starttls` para 587 y 2525.
- `SMTP_USUARIO`: login SMTP, que puede ser distinto del remitente.
- `SMTP_CLAVE`: clave SMTP; no sirve una clave de API ni la contraseña de la cuenta.
- `CORREO_REMITENTE`: dirección verificada. La API agrega el nombre visible «Supera PAES».

`SMTP_TIMEOUT_MS` es opcional y vale 10000 ms por defecto. La selección
`PROVEEDOR_CORREO=smtp` también es obligatoria en producción. Sumando base, consola, IA, correo y
pagos, una configuración válida de producción exige 25 variables; tres más son opcionales:
`PORT`, `DATABASE_SSL` y `SMTP_TIMEOUT_MS`.

## Seguridad

- Sin TLS solo se permite `localhost`, `127.0.0.1` o `::1`.
- TLS implícito exige 465; STARTTLS obligatorio admite 587 y 2525.
- Los errores y registros no incluyen claves, destinatarios, cuerpos, enlaces ni códigos.
- Una falla de correo tampoco registra el identificador del estudiante; la cuenta queda creada y el
  reenvío de verificación continúa disponible.
- Las pruebas usan un servidor SMTP falso local y credenciales ficticias. No se contacta Gmail ni
  Brevo durante la suite.
- `PROVEEDOR_CORREO=consola` sigue rechazado en producción y continúa como valor local de Docker.

## Render antes de desplegar

Crear y verificar el remitente en Brevo, generar una clave SMTP y cargar las seis variables anteriores
solo en Render. La documentación oficial confirma que Brevo admite 2525 como alternativa cuando 587
está bloqueado; la integración fuerza STARTTLS para fallar cerrado. La prueba real en Brevo queda como
compuerta manual antes del despliegue, incluida la recepción en Gmail y Outlook.

## Verificación

Prueba real con Brevo por el puerto 2525 con STARTTLS: verificación y recuperación entregadas en la bandeja

Documentado en el DAS 1.16, secciones 4.3.3 y 4.5.3

## Fuera de alcance

El aviso siete días antes de renovar una suscripción anual queda para el bloque de suscripciones,
cuando existan HU-40.2, HU-43 y HU-44. No se modifican C2, migraciones, colas, reintentos programados,
DKIM ni SPF.
