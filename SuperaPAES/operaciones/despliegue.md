# Primer despliegue: Neon, Render, Brevo, Vercel y GitHub

Guía para la versión de prueba. Los comandos se ejecutan desde `SuperaPAES/`, salvo donde se indica
otra carpeta. No guardar direcciones de conexión, claves ni contraseñas en el repositorio, los issues
o los registros. Antes de publicar, integrar la conexión IA de `feat/conexion-ia` en la rama que se
desplegará: `origin/main` todavía no reconoce `GEMINI_MODELO` ni usa Gemini como respaldo de DeepSeek.
La integración debe conservar los flujos de respaldo y tareas periódicas de `main`.

## 1. Neon: base de datos y primer administrador

1. Crear un proyecto de Neon con **PostgreSQL 18**. Elegir la rama principal y copiar su conexión
   directa (sin _pooling_) para migraciones, administración y respaldo. La forma de `DATABASE_URL` es
   `postgresql://<usuario>:<contraseña>@<host>/<base>?sslmode=require`; los campos entre `< >` son
   marcadores, no datos para copiar literalmente. Mantener TLS con `DATABASE_SSL=true`. Para el
   respaldo de GitHub usar la misma conexión directa; ver la
   [guía de conexiones de Neon](https://neon.com/docs/connect/connect-from-any-app).
2. Desde una terminal local con Node 24, instalar dependencias y compilar:

   ```powershell
   npm ci
   npm run build -w api
   ```

3. Cargar `DATABASE_URL` y `DATABASE_SSL=true` solo en esa terminal. Ejecutar las migraciones y
   semillas **omitiendo** `003_documentos_legales.sql`, cuyo texto sigue pendiente de revisión:

   ```powershell
   $env:SEMILLAS_OMITIDAS = '003_documentos_legales.sql'
   npm run migrar:produccion -w api
   ```

   Comprobar que el comando termina sin error y nombra la semilla omitida. No publicar el texto legal
   hasta que corresponda su revisión.

4. En la misma terminal interactiva ejecutar `npm run crear-admin:produccion -w api`. Confirmar que
   la base indicada es la correcta. El comando pide nombre, correo y contraseña por teclado; no
   pasar la contraseña como argumento ni variable. Al terminar, quitar las variables de la sesión:

   ```powershell
   Remove-Item Env:DATABASE_URL, Env:DATABASE_SSL, Env:SEMILLAS_OMITIDAS
   ```

   Si el administrador ya existe, el comando no crea otro. Para restablecer su contraseña existe
   `npm run crear-admin:produccion -w api -- --restablecer`.

## 2. Render: API y 27 variables

Crear un **Web Service** Node con raíz `SuperaPAES`, Node 24 (archivo `.nvmrc`) y plan **Free**.
Conectar la rama que ya tenga la integración de IA. Configurar:

| Campo             | Configuración                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| Build Command     | `npm ci && npm run build -w api`                                                                    |
| Start Command     | `SEMILLAS_OMITIDAS=003_documentos_legales.sql npm run migrar:produccion -w api && npm start -w api` |
| Health Check Path | `/api/v1/salud/vivo`                                                                                |

El plan gratuito no ofrece [**Pre-Deploy**](https://render.com/docs/deploys#pre-deploy-command).
Por eso el Start Command aplica migraciones y semillas
antes de iniciar la API en cada arranque, y se detiene si fallan. La exclusión de la semilla legal
está en ese comando para que no se cargue al reiniciar. Render suspende el servicio tras 15 minutos
sin tráfico; la siguiente solicitud lo despierta y puede tardar alrededor de un minuto. El disco
local es efímero y el plan tiene límites mensuales de uso; conservar los datos en Neon. Consultar
los [límites actuales del plan Free](https://render.com/docs/free) antes de una demostración.

En **Environment**, cargar estas **27 variables**. `NODE_ENV=production` y `PORT` los proporciona
[Render al servicio Node](https://render.com/docs/environment-variables) en tiempo de ejecución;
comprobarlo si se cambia de tipo de servicio.
`PORT` no se fija manualmente. `SMTP_TIMEOUT_MS` es opcional y aquí usa el valor predeterminado.

| Grupo                    |                                                                                                                                                                                                            Variables (cantidad) | Qué cargar                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base, consola y secretos |                                                                                             `DATABASE_URL`, `DATABASE_SSL`, `CORS_ORIGENES`, `URL_CONSOLA`, `JWT_SECRETO_CONSOLA`, `JWT_SECRETO_APP`, `CLAVE_CODIGO_CORREO` (7) | Conexión de Neon; `DATABASE_SSL=true`; origen HTTPS de Vercel en las dos variables de consola; tres secretos distintos.                                           |
| IA                       |                                                                                                                                                       `PROVEEDOR_IA`, `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODELO` (4) | `PROVEEDOR_IA=deepseek`; claves emitidas por cada proveedor; modelo de Gemini elegido para el respaldo. `GEMINI_API_KEY` activa el respaldo de la rama integrada. |
| Correo                   |                                                                                                                  `PROVEEDOR_CORREO`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_TLS`, `SMTP_USUARIO`, `SMTP_CLAVE`, `CORREO_REMITENTE` (7) | Configuración de Brevo descrita en la sección 3.                                                                                                                  |
| Tiendas                  | `PROVEEDOR_PAGOS`, `GOOGLE_PLAY_PAQUETE`, `GOOGLE_PLAY_CUENTA_SERVICIO`, `GOOGLE_PLAY_PUBSUB_AUDIENCIA`, `APP_STORE_BUNDLE_ID`, `APP_STORE_ID_EMISOR`, `APP_STORE_ID_CLAVE`, `APP_STORE_CLAVE_PRIVADA`, `APP_STORE_ENTORNO` (9) | `PROVEEDOR_PAGOS=tiendas`; texto de relleno claramente marcado en las siete variables de texto; `APP_STORE_ENTORNO=sandbox`.                                      |

Para cada uno de `JWT_SECRETO_CONSOLA`, `JWT_SECRETO_APP` y `CLAVE_CODIGO_CORREO`, ejecutar **por
separado** este comando en una terminal privada y guardar cada resultado directamente en Render:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Cada resultado supera 32 caracteres. Generar los tres de manera independiente y comprobar que
sean distintos entre sí. `CLAVE_RESPALDO` se genera igual, por separado, para GitHub y el gestor de
contraseñas del equipo; también debe ser distinta de las otras tres. Las claves de DeepSeek, Gemini
y Brevo las entrega cada proveedor: no sustituirlas por cadenas generadas localmente.

**Tiendas en este primer despliegue:** poner un marcador inequívoco, por ejemplo
`PENDIENTE_COMPRA_NO_IMPLEMENTADA`, en cada una de las siete variables de texto. El lector de
configuración solo exige texto no vacío para ellas; no comprueba el formato ni contacta a Google o
Apple al arrancar. `APP_STORE_ENTORNO` sí debe ser `sandbox` o `produccion`; usar `sandbox`.
Los adaptadores de pago aún no verifican compras. No presentar este arranque exitoso como una
prueba de compras ni habilitar un flujo de compra para usuarios.

## 3. Brevo: correo SMTP

En Brevo, habilitar el envío transaccional, verificar la dirección remitente y obtener el **login
SMTP** y una **clave SMTP**. En Render, usar `PROVEEDOR_CORREO=smtp`, el host SMTP indicado por Brevo
en `SMTP_HOST`, `SMTP_PORT=2525`, `SMTP_TLS=starttls`, el login en `SMTP_USUARIO` y la clave SMTP en
`SMTP_CLAVE`. La clave SMTP no es la contraseña de la cuenta ni una clave de API. En
`CORREO_REMITENTE` escribir **solo la dirección de correo verificada**, sin nombre visible ni
corchetes; la API agrega el nombre. El puerto 2525 evita los puertos SMTP bloqueados en Render Free;
[Brevo lo admite](https://help.brevo.com/hc/en-us/articles/115000188150-Troubleshooting-Issues-with-Brevo-SMTP).

## 4. Vercel: consola y CORS

Crear el proyecto de la consola con raíz `SuperaPAES/consola`, framework Vite, build
`npm run build` y salida `dist`. Configurar `VITE_API_URL` con la **URL pública HTTPS de la API** de
Render, sin `/api/v1` al final. Esa dirección queda dentro del código que recibe el navegador; no
poner secretos en variables `VITE_`.

Cuando Vercel asigne la dirección pública de la consola, usar su **origen** (esquema y host, sin
ruta ni barra final) como `URL_CONSOLA` en Render e incluir exactamente ese origen en
`CORS_ORIGENES`. Si hay varios orígenes, separarlos por comas. Guardar las variables en Render y
volver a desplegar la API; la consola necesita CORS para llamar a la API desde el navegador.

## 5. GitHub: respaldo y bitácora

En **Settings → Secrets and variables → Actions → Secrets**, crear `DATABASE_URL` con la conexión
**directa, sin pooling**, de Neon y `CLAVE_RESPALDO` con una cuarta clave aleatoria generada como en
la sección 2. Guardar esa clave también fuera de GitHub: sin ella no se pueden abrir los respaldos.
En **Variables**, crear `RESPALDO_ACTIVO=true` solo después de que un respaldo manual termine bien.
La ejecución programada consulta esta variable; la manual se puede ejecutar sin ella.

Comprobar que exista la etiqueta `incidente` (la plantilla `.github/ISSUE_TEMPLATE/incidente.yml`
la usa). Registrar cada falla en un issue con esa etiqueta, sin claves ni datos personales. Para
probar el respaldo: **Actions → Respaldo diario → Run workflow → Run workflow**. Confirmar que el
flujo terminó bien y publicó el artefacto cifrado; después activar `RESPALDO_ACTIVO`. El flujo
debe seguir presente tras integrar la rama IA. El procedimiento de recuperación está en
[`operaciones/contingencia.md`](contingencia.md).

## 6. Verificación posterior al despliegue

| Paso                              | Resultado esperado                                                                                                       | Si falla, revisar                                                                                                                                                                                                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Salud                             | `GET https://<api>/api/v1/salud/vivo` responde 200. Consultar también `/api/v1/salud` para comprobar Neon.               | Estado y logs de Render; posible despertar del plan Free; `DATABASE_URL`, TLS y migraciones si falla la ruta que consulta la base.                                                                                                                                                                                         |
| Ingreso del administrador         | Entrar desde la consola publicada con la cuenta creada en Neon.                                                          | `VITE_API_URL`, `URL_CONSOLA`, `CORS_ORIGENES`, logs de Render, cuenta activa y secretos JWT.                                                                                                                                                                                                                              |
| Registro con correo real          | Registrar una cuenta de prueba con una dirección real y recibir el correo de verificación.                               | Logs y estado del envío en Brevo; remitente verificado; `SMTP_HOST`, puerto, STARTTLS, login y clave; enlace construido con `URL_CONSOLA`.                                                                                                                                                                                 |
| Generación de una pregunta con IA | Cuando el módulo Generador exponga la acción, pedir un lote pequeño y comprobar que aparece una propuesta para revisión. | Estado del lote, logs de Render, saldo y respuesta de DeepSeek; si DeepSeek responde sin saldo, comprobar clave y modelo de Gemini. **Hoy este paso no puede aprobarse:** la pantalla Generador IA y su ruta API siguen sin implementar incluso en `feat/conexion-ia`; la integración actual solo conecta los adaptadores. |

Si una comprobación revela una falla de la versión publicada, abrir un incidente y seguir
[`operaciones/contingencia.md`](contingencia.md). No marcar como verificado un paso que el código
todavía no permite ejecutar.
