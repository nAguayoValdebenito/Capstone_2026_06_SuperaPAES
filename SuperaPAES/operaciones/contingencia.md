# Contingencia: respaldo, restauración y reintegración

Guía operativa del plan de contingencia del DAS 4.5.5 (versión 1.18), RNF-07 y TEC-08. La usa el
responsable del despliegue, con el administrador del sistema. Los casos que la comprueban son CP-39
(recuperación de Neon), CP-53 (restauración del respaldo diario) y CP-59 (reintegración de datos).

Reglas para todo lo que sigue:

- Las direcciones de las bases y las claves se escriben **solo en la terminal** (variables de
  PowerShell) o en los secretos de GitHub y de Render. Nunca en `api/.env`, en el chat, en un issue ni
  en un commit. Al terminar se borran de la terminal con `Remove-Item Env:...`.
- Los comandos se ejecutan desde la carpeta `SuperaPAES/`.
- Todo incidente se registra en la bitácora: un issue con la plantilla **Incidente** y la etiqueta
  `incidente`. El repositorio es público: en la bitácora van solo ids internos y cantidades, nunca
  datos personales.

## 1. Lo que hay que configurar una vez

Lo hace el responsable del despliegue desde su cuenta. Ninguna herramienta de este repositorio se
conecta a GitHub, Neon ni Render.

1. **Clave del respaldo.** Generar una clave de **al menos 32 caracteres aleatorios** (el comando de
   respaldo rechaza una más corta):

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(36).toString('base64url'))"
   ```

   Guardarla **también fuera de GitHub**, en el gestor de contraseñas del equipo: GitHub no deja leer
   un secreto después de guardarlo y, sin la clave, ninguna copia se puede abrir.

2. **Secretos de GitHub Actions** (Settings → Secrets and variables → Actions → New repository secret):
   - `DATABASE_URL`: la cadena de conexión de la rama principal de Neon, **sin pooling** (en el panel
     de Neon, Connect con «Connection pooling» desactivado). pg_dump necesita la conexión directa.
   - `CLAVE_RESPALDO`: la clave del paso 1.

3. **Etiqueta de la bitácora:**

   ```powershell
   gh label create incidente --repo nAguayoValdebenito/Capstone_2026_06_SuperaPAES --color B60205 --description "Bitácora de incidentes de la versión publicada (DAS 4.5.5)"
   ```

   Comprobar con `gh label list --repo nAguayoValdebenito/Capstone_2026_06_SuperaPAES`.

4. **Permisos de Actions** (Settings → Actions → General):
   - «Actions permissions» debe permitir las acciones de GitHub (`actions/checkout`,
     `actions/setup-node` y `actions/upload-artifact`).
   - «Workflow permissions» puede quedar en solo lectura: el flujo declara `contents: read`.
   - «Artifact and log retention» debe ser de 30 días o más (el flujo pide 30).

5. **Avisos de falla.** Cuando una ejecución programada falla, GitHub avisa por correo a la última
   persona que modificó el horario (`cron`) del flujo; conviene que sea el responsable del despliegue. En un repositorio público, GitHub **desactiva los flujos programados después de
   60 días sin actividad** en el repositorio: si eso pasa, volver a activarlo en Actions → Respaldo
   diario → Enable workflow.

6. **Herramientas en el computador** (para restaurar y reintegrar):
   - PostgreSQL 18 (pg_dump y pg_restore en `C:\Program Files\PostgreSQL\18\bin`).
   - GnuPG: Git for Windows ya lo trae en `C:\Program Files\Git\usr\bin\gpg.exe`.
   - Si alguno está en otra ruta, se indica con `$env:PG_DUMP`, `$env:PG_RESTORE` o `$env:GPG`.

## 2. El respaldo diario

El flujo `.github/workflows/respaldo.yml` (Actions → **Respaldo diario**) corre cada día a las 07:30
UTC (03:30 o 04:30 en Chile) y hace lo siguiente:

1. Instala el cliente de PostgreSQL 18, la misma versión mayor que Neon.
2. Ejecuta `pg_dump` en formato personalizado sobre `DATABASE_URL` y revisa que el volcado no esté
   vacío y traiga los esquemas `app` y `contenido`.
3. Guarda las cantidades de la base en el momento del respaldo, para compararlas al restaurar.
4. Cifra el volcado y las cantidades con GnuPG simétrico: AES-256, clave derivada con S2K salado e
   iterado (SHA-512) y verificación de integridad. La clave entra por la entrada estándar
   (`--passphrase-fd 0`), nunca como argumento.
5. Descifra la copia y la compara con el volcado; si no coinciden, falla.
6. Sube dos archivos como artefacto por **30 días**: `supera-paes-AAAA-MM-DD.dump.gpg` y
   `supera-paes-AAAA-MM-DD.cantidades.json.gpg`.

El flujo falla de forma visible si falta un secreto, si el volcado queda vacío o si el cifrado falla.
Sus registros nunca muestran la dirección de la base, la clave ni datos de la base.

> **La copia cifrada es descargable por cualquier usuario con sesión en GitHub**, porque el
> repositorio es público. La única protección es el cifrado con `CLAVE_RESPALDO`. Hoy la base tiene
> datos de prueba; a mediano plazo conviene guardar las copias en un almacenamiento privado (ver la
> descripción del PR de TEC-08).

**Ejecutarlo a mano** (por ejemplo, si GitHub Actions no ejecutó el del día):

- En GitHub: Actions → Respaldo diario → Run workflow → Run workflow.
- O en la terminal:

  ```powershell
  gh workflow run respaldo.yml --repo nAguayoValdebenito/Capstone_2026_06_SuperaPAES
  ```

**Descargar una copia:**

```powershell
gh run list --workflow respaldo.yml --repo nAguayoValdebenito/Capstone_2026_06_SuperaPAES --limit 5
gh run download <id de la ejecución> --repo nAguayoValdebenito/Capstone_2026_06_SuperaPAES --dir C:\respaldos-supera
```

La carpeta de descarga queda fuera del repositorio. Se borra al terminar la prueba.

## 3. Restaurar el respaldo en una base aparte (CP-53)

`npm run restaurar-respaldo -w api` descifra la copia, la restaura con `pg_restore` en una sola
transacción y muestra las cantidades restauradas junto a las del respaldo. **Se niega**:

- si el destino es la base de `URL_PRODUCCION` o la de `DATABASE_URL` (mismo servidor, puerto y nombre);
- si no hay ninguna de las dos para comparar;
- si el destino no está vacío.

El destino debe ser una base PostgreSQL 18 nueva y vacía: una base local
(`CREATE DATABASE supera_paes_restaurada;`) o un proyecto o rama nuevos de Neon.

```powershell
cd SuperaPAES
$env:ARCHIVO_RESPALDO = "C:\respaldos-supera\supera-paes-2026-11-02.dump.gpg"
$env:CLAVE_RESPALDO = "<la clave, copiada del gestor de contraseñas>"
$env:URL_DESTINO = "<cadena de la base vacía>"
$env:URL_PRODUCCION = "<cadena de la base publicada, solo para compararla; no se conecta a ella>"
$env:DATABASE_SSL = "false"   # "true" si el destino es de Neon
npm run restaurar-respaldo -w api
Remove-Item Env:ARCHIVO_RESPALDO, Env:CLAVE_RESPALDO, Env:URL_DESTINO, Env:URL_PRODUCCION, Env:DATABASE_SSL
```

El archivo de cantidades del mismo día se toma solo si está junto a la copia (también se puede
indicar con `$env:ARCHIVO_CANTIDADES`). Si `pg_restore` contra Neon falla en Windows con un error del
certificado raíz, indicar los certificados de Git for Windows y repetir:
`$env:PGSSLROOTCERT = "C:\Program Files\Git\mingw64\etc\ssl\certs\ca-bundle.crt"`.

**CP-53 paso a paso:**

1. En Actions → Respaldo diario, abrir la última ejecución y anotar su hora y su artefacto. Descargar
   la copia con `gh run download`.
2. Intentar abrirla sin la clave: `gpg --decrypt C:\respaldos-supera\supera-paes-AAAA-MM-DD.dump.gpg`
   pide una clave; con una clave cualquiera responde `decryption failed: Bad session key`.
3. Restaurarla con el comando de arriba en una base aparte y vacía.
4. El comando muestra, para cuentas, preguntas publicadas, evaluaciones, respuestas y suscripciones,
   la cantidad restaurada junto a la de la base publicada al momento del respaldo, con `coincide` o
   `DISTINTA`. Copiar esa salida como evidencia del caso.
5. Borrar la base restaurada y la carpeta de descarga.

## 4. Escenarios de falla (DAS 4.5.5)

Al detectar cualquier falla: abrir el incidente en la bitácora con la hora de detección. La meta es
volver a tener la ruta de salud en 200 **antes de 4 horas** en las fallas que el equipo puede resolver.

Cómo se detecta una falla:

- La ruta `/api/v1/salud/vivo`, que se consulta antes de cada demostración y cuando alguien informa
  un problema.
- El correo de GitHub cuando falla un flujo programado.
- Los registros de Render, la consola de Neon, el registro de envíos de Brevo y las consolas de
  Google Play y App Store Connect.
- Los avisos de los usuarios al correo de contacto, superapaes@gmail.com.

### 4.1 La API no responde (Render caído, suspendido o con error)

1. Consultar la salud: `curl.exe -i https://<dirección de la API>/api/v1/salud/vivo` (200 esperado).
   Si el servicio gratuito estaba suspendido por inactividad, la primera petición lo despierta en
   cerca de un minuto.
2. Revisar el estado y los registros del servicio en Render (Logs y Events).
3. Si la falla empezó con una publicación nueva, volver en Render a la publicación anterior:
   servicio → **Deploys** → la última publicación exitosa → **Rollback** → «Rollback to this deploy».
   - En el plan gratuito solo se puede volver a las **dos publicaciones previas más recientes**.
   - Volver atrás desde el panel **desactiva el despliegue automático**: reactivarlo en Settings →
     Build & Deploy → Auto-Deploy después de corregir.
   - Después, revertir el cambio en `main` con una rama y su pull request (`git revert <commit>`), con
     la revisión y la integración continua de siempre.

Mientras la API no responde, la app y la consola muestran un error de conexión y no se pierde lo ya
guardado. Las evaluaciones con el tiempo cumplido se cierran al consultarlas (RN-21) y las tiendas
reintentan sus avisos.

### 4.2 Una publicación nueva falla

**Comando de inicio en Render.** El plan gratuito de Render **no tiene Pre-Deploy Command** (la
documentación de Render lo ofrece solo para servicios pagados). Por eso el comando de inicio es:

```
npm run migrar:produccion -w api && npm start -w api
```

Cada migración corre en su propia transacción: si una falla, se deshace, el proceso termina con error
y el servicio nuevo no arranca. Mientras la versión anterior esté funcionando, Render la mantiene
atendiendo. **Si el servicio estaba dormido, no hay versión anterior atendiendo**: la app muestra un
error de conexión hasta corregir o volver atrás (4.1).

- Corregir en una rama, con su revisión y la integración continua. Una migración ya aplicada **no se
  edita**: se corrige con una migración nueva.
- **Volver atrás no sirve si la publicación fallida ya aplicó una migración nueva**: al arrancar, la
  versión anterior ejecuta `migrar:produccion`, encuentra en la base una migración que no tiene en
  disco y se niega a seguir («La migración aplicada … ya no existe en disco»). En ese caso se corrige
  hacia adelante con una publicación nueva.
- Si el error está en la consola, volver en Vercel a la publicación anterior: proyecto → tarjeta
  Production Deployment → **Instant Rollback** → Continue → Confirm Rollback. En el plan Hobby solo se
  puede volver a la publicación inmediatamente anterior. Después de la vuelta atrás, Vercel deja de
  publicar automáticamente lo que llega a `main`: al corregir, usar **Undo Rollback** en la misma
  tarjeta (o `vercel promote <publicación>`).

### 4.3 La base de datos no está disponible (Neon)

La API responde con error y no acepta respuestas; nada queda a medias porque cada operación que cambia
varias tablas es una transacción.

1. Seguir el estado de Neon (su página de estado y la consola del proyecto).
2. Si se supera el tiempo máximo sin servicio (4 horas):
   1. Suspender el servicio en Render (servicio → Settings → **Suspend Web Service**) y anotar la hora.
   2. Crear una base PostgreSQL 18 nueva (otro proyecto de Neon) y restaurar en ella el último
      respaldo diario (sección 3).
   3. Cambiar `DATABASE_URL` en Render (servicio → Environment) por la de la base nueva y reactivar
      el servicio (**Resume Web Service**). Comprobar `/api/v1/salud/vivo`.
   4. Cuando Neon vuelva, reintegrar lo que se recupere de la base original (sección 5), con la base
      original como `URL_ORIGEN`, la nueva como `URL_DESTINO` y como `DESDE` la hora del respaldo
      restaurado. Antes de reintegrar, suspender de nuevo el servicio en Render.

Con el respaldo diario se pueden perder hasta 24 horas de datos; con la recuperación de Neon, nada
anterior al incidente.

### 4.4 Datos borrados o dañados (error del código, de una migración o de una acción en la consola)

Seguir el procedimiento de reintegración de la sección 5. La auditoría de la consola dice quién hizo
cada cambio y cuándo.

### 4.5 El correo no se envía (Brevo caído o con el límite de 300 diarios alcanzado)

- El registro y la recuperación de la contraseña no esperan al correo: la cuenta queda creada y el
  estudiante puede pedir el reenvío.
- Revisar el registro de envíos de Brevo.
- Si un estudiante no puede verificar su cuenta, el administrador la confirma desde la consola
  (Estudiantes, CU-02b).
- **El aviso de renovación anual todavía no existe**: lo enviará la tarea horaria, que aún no está
  construida (sección 7).

### 4.6 La IA no responde o no tiene saldo

El lote queda fallido (CU-17, 4.a) y, ante saldo agotado de DeepSeek, se usa Gemini (4.b). Los
estudiantes no se ven afectados. Revisar la clave o cargar saldo y pedir el lote de nuevo.

### 4.7 La consola no está disponible (Vercel)

La app sigue funcionando y el estudiante puede verificar su correo con el código de 6 dígitos. Revisar
el estado de Vercel o volver a la publicación anterior (4.2).

### 4.8 GitHub Actions no ejecuta un flujo programado

Las evaluaciones vencidas igual se cierran al consultarlas (RN-21). Cuando GitHub vuelva, ejecutar a
mano el **Respaldo diario** (sección 2) para no perder la copia del día.

**El flujo horario de tareas periódicas todavía no existe** (sección 7): hoy no hay nada que ejecutar
a mano en su lugar.

### 4.9 Se expone una clave o un secreto

No hay una acción automática. Cambiar la clave en su proveedor y en Render, y registrar el incidente.

| Secreto expuesto                         | Qué hacer                                                                                                                                                                                                                           |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL` (contraseña de Neon)      | En Neon, Roles → restablecer la contraseña del rol. Actualizar `DATABASE_URL` en Render y en los secretos de GitHub.                                                                                                                |
| `JWT_SECRETO_APP`, `JWT_SECRETO_CONSOLA` | Generar uno nuevo y cambiarlo en Render: las sesiones abiertas dejan de servir y hay que volver a iniciar sesión.                                                                                                                   |
| `CLAVE_CODIGO_CORREO`                    | Generar una nueva y cambiarla en Render: los códigos de verificación pendientes quedan inválidos (4.5.3) y el estudiante pide otro.                                                                                                 |
| `CLAVE_RESPALDO`                         | Las copias existentes son públicas y quedan legibles: borrarlas (Actions → cada ejecución de Respaldo diario → Artifacts → borrar). Guardar una clave nueva en GitHub y en el gestor de contraseñas, y ejecutar el respaldo a mano. |
| Claves de IA, de Brevo o de las tiendas  | Revocarlas en su proveedor, crear otras y cambiarlas en Render.                                                                                                                                                                     |

Si hubo acceso a datos personales, informar a la Agencia de Protección de Datos Personales y a los
estudiantes afectados, según la Ley 21.719.

## 5. Procedimiento de reintegración de datos después de una caída

Sigue los pasos del DAS 4.5.5. Anotar en la bitácora la hora de cada paso.

### Paso 1. Detener las escrituras

En Render: servicio → Settings → **Suspend Web Service**. Anotar la hora de suspensión. Mientras el
servicio está suspendido nada escribe en la base. El comando de reintegración se niega si la base
recuperada recibió escrituras después del momento de recuperación.

### Paso 2. Elegir el momento de recuperación (`DESDE`)

El instante previo al error, según la auditoría de la consola (tabla `contenido.auditoria`), los
registros de Render y la bitácora. Se escribe en ISO 8601 **con la zona horaria**, por ejemplo
`2026-11-02T14:30:00-03:00`.

### Paso 3. Recuperar la base

**Dentro de la ventana de Neon** (hasta 6 horas en el plan gratuito; menos si los cambios superan 1 GB
en ese tiempo): recuperación instantánea de la rama principal.

1. En la consola de Neon, abrir el proyecto → **Backup & Restore** (o Branches → la rama principal →
   Restore).
2. Elegir la rama principal, la opción de recuperar a una fecha y hora, y escribir el momento `DESDE`.
   Confirmar.
3. Neon deja la rama principal como estaba en ese momento y guarda el estado previo en una **rama de
   respaldo** llamada `{rama}_old_{hora}` (el nombre de la rama principal, `_old_` y la hora). La dirección
   de conexión de la rama principal no cambia; las conexiones abiertas se cortan durante la
   recuperación.
4. Si la rama `_old` no tiene un cómputo, agregarlo (Branches → la rama `_old` → Add compute).
5. Copiar la cadena de conexión de la rama `_old` **sin pooling** (Connect → elegir la rama → desactivar
   «Connection pooling»). Esa es `URL_ORIGEN`. La de la rama principal, también sin pooling, es
   `URL_DESTINO`.

**Fuera de la ventana de Neon:** restaurar el respaldo diario en una base aparte (sección 3) y copiar
desde ella, con cuidado y a mano, solo las tablas o filas dañadas. El comando de reintegración no sirve
para eso: copia filas creadas después de un momento, no repara filas dañadas.

### Paso 4. Reintegrar lo ocurrido después del momento de recuperación

`npm run reintegrar -w api` copia desde la rama `_old` a la rama principal, en **una sola
transacción**, las filas creadas después de `DESDE`, en el orden de sus claves foráneas:

1. cuentas nuevas (`estudiante`) y su consentimiento (`consentimiento`);
2. invitaciones (`invitacion`);
3. evaluaciones sin tiempo (práctica y repaso) con sus preguntas y respuestas (`evaluacion` y
   `evaluacion_item`), y sus resultados;
4. movimientos de bono (`movimiento_bono`);
5. avisos de las tiendas (`evento_pasarela`).

No copia suscripciones ni pagos (se revisan con las tiendas en el paso 5) ni sesiones (los estudiantes
vuelven a iniciar sesión).

Las reglas de la base siguen activas: ningún trigger se desactiva y cualquier fila inconsistente hace
fallar toda la transacción. Cada evaluación se vuelve a armar como lo hace la API (en curso, con sus
respuestas) y, si estaba cerrada, la cierra `app.cerrar_evaluacion` con el mismo estado. Al final, en
la misma transacción, el comando compara el resultado de cada evaluación cerrada con el del origen y
vuelve a simular. Si queda alguna diferencia o alguna fila pendiente, no copia nada.

**Primero simular** (no escribe nada):

```powershell
cd SuperaPAES
$env:URL_ORIGEN = "<cadena de la rama _old, sin pooling>"
$env:URL_DESTINO = "<cadena de la rama principal, sin pooling>"
$env:DATABASE_SSL = "true"
$env:DESDE = "2026-11-02T14:30:00-03:00"
npm run reintegrar -w api
```

El informe muestra, por tabla, las filas candidatas, las que ya están en el destino y las pendientes.
También lista dos grupos, solo con ids:

**Quedan fuera.** Hay que copiarlos a la bitácora:

| Motivo                                | Qué significa y qué hacer                                                                                                                                               |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `evaluacion_con_tiempo`               | Diagnóstico, mini-ensayo o ensayo creado después de `DESDE`. Sus respuestas no se pueden volver a registrar con la hora de término ya cumplida. Informar al estudiante. |
| `respuestas_de_evaluacion_anterior`   | Respuestas dadas después de `DESDE` en una evaluación que empezó antes. No se reintegran. Informar al estudiante.                                                       |
| `consumo_de_respuesta_no_reintegrada` | Pregunta extra del bono descontada por una respuesta que no se reintegra. El saldo del estudiante queda como antes de esa respuesta.                                    |
| `aviso_sin_suscripcion_o_pago`        | Aviso de una tienda cuya suscripción o pago se creó después de `DESDE`. Se revisa con la tienda en el paso 5.                                                           |

**Impiden reintegrar.** Con cualquiera de estos, `--aplicar` no copia nada:

| Motivo                                | Qué hacer                                                                                                                                                                                                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `escritura_posterior_en_destino`      | La base recuperada recibió escrituras después de `DESDE`: el servicio no estaba suspendido. Suspenderlo, registrar en la bitácora qué se escribió y decidir con el equipo antes de seguir.                                                            |
| `fila_distinta_en_destino`            | El destino ya tiene esa fila con otro contenido (normalmente por lo mismo de arriba, o un `DESDE` equivocado). Revisar la bitácora y el momento de recuperación.                                                                                      |
| `evaluacion_abierta_en_destino`       | El estudiante tiene abierta en el destino una evaluación que en el origen se cerró después de `DESDE`. Ejecutar en el destino la consulta que muestra el informe, por ejemplo `SELECT app.cerrar_evaluacion(123, 'abandonada');`, y volver a simular. |
| `invitacion_sin_verificar_en_destino` | En el origen la invitación se verificó después de `DESDE`, pero en el destino no. Copiar la verificación con las consultas de abajo y volver a simular.                                                                                               |

Consultas para `invitacion_sin_verificar_en_destino` (en el SQL Editor de Neon). Primero leer en la
rama `_old` los valores (cambiar `<invitacion>` por el id del informe):

```sql
SELECT i.id, i.invitado_id, i.verificado_en, i.bono_entregado,
       e.correo_verificado, e.verificado_en AS correo_verificado_en
  FROM app.invitacion i JOIN app.estudiante e ON e.id = i.invitado_id
 WHERE i.id = <invitacion>;
```

Después copiarlos en la rama principal:

```sql
BEGIN;
UPDATE app.invitacion SET verificado_en = '<verificado_en>', bono_entregado = <bono_entregado>
 WHERE id = <invitacion>;
UPDATE app.estudiante SET correo_verificado = true, verificado_en = '<correo_verificado_en>'
 WHERE id = <invitado_id>;
COMMIT;
```

**Después aplicar**, cuando la simulación no muestre nada que impida reintegrar:

```powershell
npm run reintegrar -w api -- --aplicar
npm run reintegrar -w api       # debe informar 0 filas pendientes
Remove-Item Env:URL_ORIGEN, Env:URL_DESTINO, Env:DATABASE_SSL, Env:DESDE
```

Al aplicar, el comando informa cuántas evaluaciones verificó y cuáles quedaron cerradas a la hora de la
reintegración.

**Límites de la reintegración:**

- Solo se copian filas **creadas** después de `DESDE`.
- Los cambios hechos después de `DESDE` en filas anteriores **no se recuperan**. Por ejemplo, una
  evaluación que empezó antes y se cerró después, o un correo verificado después.
- Las evaluaciones con tiempo creadas después de `DESDE` no se reintegran.
- Una evaluación cerrada que se reintegra queda con `cerrada_en` y tiempo usado de la hora de la
  reintegración, porque la cierra `app.cerrar_evaluacion`. Sus respuestas, su corrección y su resultado
  son los del origen.

### Paso 5. Revisar las suscripciones

Consultar el estado de cada suscripción con movimientos en el período, incluidas las de los avisos
`aviso_sin_suscripcion_o_pago`, en la Google Play Developer API y en la App Store Server API, y
corregir las que no coinciden. El registro de avisos (`evento_pasarela`) evita procesar dos veces el
mismo aviso. Mientras las compras son de prueba, no hay cobros reales en riesgo.

### Paso 6. Verificar y reabrir

1. Contar en la rama principal (SQL Editor de Neon) y comparar con las cantidades de antes del
   incidente, más lo reintegrado:

   ```sql
   SELECT (SELECT count(*) FROM app.estudiante) AS estudiantes,
          (SELECT count(*) FROM contenido.usuario_interno) AS usuarios_internos,
          (SELECT count(*) FROM contenido.v_preguntas_publicadas) AS preguntas_publicadas,
          (SELECT count(*) FROM app.evaluacion) AS evaluaciones,
          (SELECT count(*) FROM app.evaluacion_item WHERE respondida_en IS NOT NULL) AS respuestas,
          (SELECT count(*) FROM app.suscripcion) AS suscripciones;
   ```

2. Reactivar el servicio en Render (**Resume Web Service**) y consultar `/api/v1/salud/vivo` (200).
3. Informar a los estudiantes afectados si alguna respuesta no se pudo reintegrar (los ids de «quedan
   fuera»).
4. Cuando todo esté bien, borrar en Neon el cómputo de la rama `_old`, y la rama cuando ya no haga falta.

### Paso 7. Cerrar el incidente

En la bitácora: la causa, los datos afectados, la hora de reapertura y la acción que evita que se
repita.

## 6. Pruebas del plan

### CP-39: recuperación de Neon

1. Registrar las cantidades con la consulta del paso 6.
2. Recuperar la rama principal a un momento de las últimas 6 horas (paso 3).
3. Comparar las cantidades y consultar `/api/v1/salud/vivo`.

### CP-53: restauración del respaldo diario

Ver la sección 3.

### CP-59: reintegración después de una recuperación

1. Anotar la hora (será `DESDE`) y las cantidades del paso 6.
2. Después de esa hora, registrar una cuenta de prueba nueva en la app y responder preguntas en una
   práctica.
3. Simular un error: retirar desde la consola una pregunta publicada.
4. Suspender el servicio en Render (anotar la hora) y recuperar la rama principal al momento del
   paso 1 (paso 3 de la sección 5).
5. Reintegrar desde la rama `_old` con `npm run reintegrar -w api` y luego con `-- --aplicar`.
6. Reactivar el servicio, consultar `/api/v1/salud/vivo` y comparar las cantidades: deben ser las del
   paso 1 más lo reintegrado, y la pregunta retirada debe volver a estar publicada.
7. Registrar el incidente simulado en la bitácora, con la hora de suspensión y la de reapertura
   (menos de 4 horas).

## 7. Lo que todavía no existe

- **Flujo horario de tareas periódicas.** El DAS lo describe: un flujo programado de GitHub Actions
  llama cada hora a una ruta protegida de la API con una clave compartida, que ejecuta
  `app.cerrar_vencidas` y envía el aviso de las renovaciones anuales. **Hoy no existen ni el flujo, ni
  la ruta, ni su clave, ni el aviso de renovación**: nadie llama a `cerrar_vencidas`. Las evaluaciones
  con tiempo se cierran igual al consultarlas (RN-21). Hace falta construirlo antes de publicar.
- **Almacenamiento privado de las copias.** Hoy son artefactos de un repositorio público, protegidos
  solo por el cifrado.
