# Supera PAES

Plataforma de práctica para la PAES (Chile), pensada para estudiantes con menos recursos. Cubre
Competencia Lectora, Matemática M1 y M2, Historia y Ciencias.

Es un **monolito modular en capas**: una sola API REST con diez módulos, y dos interfaces de
usuario que solo hablan con ella por HTTP.

| Pieza                      | Tecnología                                    | Carpeta    |
| -------------------------- | --------------------------------------------- | ---------- |
| API                        | Node 24, Express 5, TypeScript, PostgreSQL 18 | `api/`     |
| Consola del equipo interno | React 19, React Router, Vite                  | `consola/` |
| App de estudiantes         | Flutter: Android 8 o superior e iOS           | `app/`     |

Este proyecto vive en la carpeta `SuperaPAES/` del repositorio `Capstone_2026_06_SuperaPAES`, junto a
`Fase 1` y `Fase 2`. Todos los comandos se ejecutan desde `SuperaPAES/`; la integración continua está
en `.github/` de la raíz del repositorio.

La documentación interna del proyecto (arquitectura, modelo de datos y reglas de negocio) y el SQL de
la base de datos no se publican: el equipo los recibe por un canal privado.

## Requisitos

- Node 24 (ver `.nvmrc`) y npm 11.
- PostgreSQL 18 instalado en el equipo (puerto 5432).
- Para la app: Flutter estable 3.44 o superior; Android Studio con el SDK para Android; Xcode en
  macOS para iOS.

## Puesta en marcha

```bash
git clone https://github.com/nAguayoValdebenito/Capstone_2026_06_SuperaPAES.git
cd Capstone_2026_06_SuperaPAES/SuperaPAES
npm install
createdb -U postgres supera_paes             # en Windows: "C:\Program Files\PostgreSQL\18\bin\createdb.exe"
cp api/.env.example api/.env                 # completa DATABASE_URL y los dos JWT_SECRETO_*
npm run migrar -w api                        # modelo 12.0: 85 tablas, 156 claves foráneas, 12 vistas y datos iniciales
npm run semillas -w api                      # temario, evaluaciones y documentos legales (idempotente)
npm run probar:bd -w api                     # 249 casos del modelo en una base temporal (necesita psql 18)
npm run crear-admin -w api                   # una sola vez: tu administrador para entrar a la consola
npm run dev -w api                           # http://localhost:3000/api/v1/salud
npm run dev -w consola                       # http://localhost:5173
```

El SQL vive en `api/db`: migraciones `001` a `003` (modelo de datos 12.0), semillas `001` a `004`
(temario PAES 2027, evaluaciones, documentos legales 1.0 y acciones de auditoría de usuarios internos,
en ese orden) y las pruebas del modelo. La migración `003` y la semilla `003` comparten el número,
pero están en carpetas distintas y no chocan.

**Primer administrador.** La consola no permite registrarse: en tu base local creas tu propia cuenta
de administrador con `npm run crear-admin -w api`, en una terminal interactiva (PowerShell o la de VS
Code). Muestra el servidor y la base a los que se conecta y pide confirmar con `s`; después pide
nombre, correo y contraseña, que se escribe dos veces sin que se vea y cumple RN-31. Si ya hay un
administrador activo, no crea nada: las demás cuentas se crean desde Usuarios internos (C10). Si
olvidaste la contraseña, `npm run crear-admin -w api -- --restablecer` asigna una nueva y activa la
cuenta. Las dos acciones quedan en la auditoría; la contraseña nunca se pasa como argumento ni en
`.env`.

> **Poner al día una base local.** Si tu base tiene el modelo 11.0 o los textos legales anteriores
> (la semilla no reemplaza una versión ya cargada), lo más simple es recrearla:
>
> ```bash
> dropdb -U postgres supera_paes
> createdb -U postgres supera_paes
> npm run migrar -w api
> npm run semillas -w api
> ```
>
> Si solo te falta el modelo 12.0 y no te importa el texto legal, basta con `npm run migrar -w api`,
> que aplica la 002 y la 003.

Contacto del proyecto: superapaes@gmail.com. Los documentos legales 1.0 rigen desde el 19/10/2026;
falta completar «dirección de la consola» y la revisión de un docente o del cliente (RN-30), así que
en producción se omiten con `SEMILLAS_OMITIDAS=003_documentos_legales.sql`.

Con todos los proveedores en `simulado`/`consola`, la API solo necesita `DATABASE_URL`, los dos
secretos JWT y `PORT`.

## Levantar con Docker

Docker es otra forma de ejecutar la base, la API y la consola en el computador. Se necesita Docker
Desktop abierto (en Windows, con WSL 2). Ejecuta estos comandos desde `SuperaPAES/`, la carpeta que
contiene `docker-compose.yml`:

```powershell
Copy-Item .env.docker.example .env.docker
```

En macOS o Linux, usa `cp .env.docker.example .env.docker`. Abre `.env.docker` y completa
`POSTGRES_PASSWORD`, `JWT_SECRETO_CONSOLA`, `JWT_SECRETO_APP` y `CLAVE_CODIGO_CORREO` con cuatro valores
aleatorios distintos. Los tres últimos deben tener al menos 32 caracteres. Para generar cada valor
con Docker, puedes ejecutar este comando cuatro veces:

```bash
docker run --rm node:24-alpine node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

El formato `base64url` también sirve para `POSTGRES_PASSWORD`: `.env.docker` construye `DATABASE_URL`
con esa contraseña y el nombre `db` de la red de Compose. No pongas valores reales en el archivo de
ejemplo ni subas `.env.docker` a Git. La consola se compila con `VITE_API_URL=http://localhost:3000`,
una dirección pública; nunca pongas claves en variables `VITE_`.

```bash
docker compose --env-file .env.docker up --build
```

La primera ejecución crea la base `supera_paes`, aplica las migraciones `001` a `003` y carga las
cuatro semillas, incluidos los textos legales locales. En cada arranque, `migraciones` termina antes
de iniciar la API. La API usa IA y pagos simulados y escribe el correo en los registros. Abre
http://localhost:3000/api/v1/salud/vivo para comprobar la API y http://localhost:8080 para la consola.
La base queda disponible solo desde este computador en el puerto 5433.

Para crear el primer administrador, abre otra terminal mientras los servicios están activos y ejecuta:

```bash
docker compose --env-file .env.docker exec api npm run crear-admin:produccion -w api
```

El comando usa una terminal interactiva: confirma la base con `s` y escribe la contraseña cuando la
pida, sin ponerla en argumentos ni archivos. Si ya existe un administrador activo, no crea otro. Para
ver los registros y apagar los servicios:

```bash
docker compose --env-file .env.docker logs -f api
docker compose --env-file .env.docker logs migraciones
docker compose --env-file .env.docker down
```

`down` conserva el volumen y sus datos. **`docker compose --env-file .env.docker down -v` borra la
base local del volumen**; úsalo solo si quieres empezar desde cero. Si 5433 está ocupado, cambia
`PUERTO_POSTGRES_LOCAL` en `.env.docker`. Si están ocupados 3000 u 8080, libera esos puertos antes de
levantar los servicios: son las direcciones configuradas para la API, el navegador y los enlaces del
correo.

La app Flutter se ejecuta fuera de Docker. Desde el emulador de Android, conéctala a
`http://10.0.2.2:3000`. La instalación sin Docker de la sección «Puesta en marcha» sigue disponible
con Node 24 y PostgreSQL 18.

## API

| Ruta                                | Para                                                          |
| ----------------------------------- | ------------------------------------------------------------- |
| `GET /api/v1/salud`                 | Estado de la API y de la base (200, o 503 en menos de 4 s)    |
| `GET /api/v1/salud/vivo`            | Solo el proceso, sin tocar la base (chequeo de Render)        |
| `/api/v1/app/<modulo>`              | App del estudiante, con el JWT de la app                      |
| `/api/v1/admin/<modulo>`            | Consola, con el JWT de la consola y rol `admin` o `docente`   |
| `POST /api/v1/webhooks/google-play` | Avisos de Google Play (501 hasta el sprint de suscripciones)  |
| `POST /api/v1/webhooks/app-store`   | Avisos de la App Store (501 hasta el sprint de suscripciones) |

Toda respuesta tiene la forma `{ "data": …, "error": …, "meta": … }`.

Proveedores (se eligen con variables de entorno, ver `api/.env.example`):

| Variable           | Valores                                         | Por defecto |
| ------------------ | ----------------------------------------------- | ----------- |
| `PROVEEDOR_IA`     | `simulado`, `deepseek`, `gemini`                | `simulado`  |
| `PROVEEDOR_CORREO` | `consola`, `smtp`                               | `consola`   |
| `PROVEEDOR_PAGOS`  | `simulado`, `tiendas` (Google Play y App Store) | `simulado`  |

## Proveedores de IA

En desarrollo y Docker, `PROVEEDOR_IA=simulado` funciona sin claves ni llamadas externas.
Con `deepseek`, completa `DEEPSEEK_API_KEY`; el modelo se lee de `modelo_ia` en
`contenido.configuracion`. El nombre antiguo `deepseek-chat` está retirado: antes de probar la
conexión real debe estar aplicada la migración 004 de la tarea independiente del modelo vigente.
Esta conexión no cambia ese dato ni incluye esa migración.

Para habilitar respaldo, completa además `GEMINI_API_KEY` y `GEMINI_MODELO` (por ejemplo,
`gemini-3.5-flash-lite`). Solo el HTTP 402 de DeepSeek activa Gemini. Con `PROVEEDOR_IA=gemini`,
esas dos variables de Gemini son obligatorias y DeepSeek no se utiliza. Nunca pongas claves en
variables `VITE_` ni en archivos versionados; en Render se cargan en el entorno del servidor.

Los adaptadores reciben la instrucción ya armada y validan únicamente su salida JSON; todavía no
hay una ruta para generar lotes. El pedido puede tardar unos cinco minutos: HU-16.2 debe invocarlo
desde un lote en segundo plano, sin hacer esperar una petición HTTP del usuario. Cada intento tiene
120 s hasta cabeceras y 30 s para el cuerpo; hay un solo reintento por red, 5xx o contenido vacío,
con espera de 1500 ms, compartido con el respaldo. Timeout, 4xx, JSON inválido y truncamiento no
se reintentan. El límite de salida es 8192 tokens. Los adaptadores no calculan costos.

## Correo en desarrollo

Por defecto `PROVEEDOR_CORREO=consola`: no envía nada. Para ver los correos como los recibiría una
persona, instala **Mailpit** (opcional, https://mailpit.axllent.org), ejecútalo y usa en `api/.env`
`PROVEEDOR_CORREO=smtp`, `SMTP_HOST=localhost`, `SMTP_PORT=1025`, `SMTP_TLS=none` y una dirección
ficticia en `CORREO_REMITENTE`. No necesita usuario ni clave. Los correos se ven en
http://localhost:8025. El arranque normal con `npm run dev` y `PROVEEDOR_CORREO=consola` no cambia.

Para usar un servidor SMTP real, completa también `SMTP_USUARIO`, `SMTP_CLAVE` y una dirección
verificada en `CORREO_REMITENTE`. Usa `SMTP_TLS=implicit` con el puerto 465 o
`SMTP_TLS=starttls` con 587 o 2525. La API obliga a cifrar toda conexión remota. En Render se usa
2525 con STARTTLS porque los puertos SMTP habituales están bloqueados; la contraseña debe ser una
clave SMTP del proveedor, no la contraseña de la cuenta ni una clave de API. Nunca guardes esos
valores en el repositorio.

## App de estudiantes

Ver [app/README.md](app/README.md). En el emulador de Android la API local es `http://10.0.2.2:3000`;
en el simulador de iOS, `http://localhost:3000`.

## Chequeos

Las pruebas con PostgreSQL usan una base aparte cuyo nombre termina en `_test` (se niegan a vaciar o
borrar cualquier otra). Se prepara una vez, con el mismo procedimiento de la CI:

1. Crear la base: `psql -U postgres -c "CREATE DATABASE supera_paes_test"`.
2. En `api/.env`, agregar `DATABASE_URL_PRUEBAS` con la misma dirección de `DATABASE_URL`, pero con
   `supera_paes_test` como nombre de la base.
3. Migrarla: ejecutar `npm run migrar -w api` con `DATABASE_URL` igual a esa dirección (en la CI, el
   paso «Migrar la base de pruebas»).

```bash
npm run lint      # tipos, ESLint (incluye las reglas de dependencia entre módulos) y Prettier
npm run test      # Vitest; con DATABASE_URL_PRUEBAS en api/.env también corre las pruebas con PostgreSQL
npm run build
npm run codigo-muerto && npm run circulares && npm run duplicacion
npm run revisar-secretos   # ningún secreto puede llegar a GitHub
npm run probar:bd -w api   # 249 casos del modelo de datos (también en la CI); usa DATABASE_URL, crea y borra su propia base, sin la protección de _test
cd app && dart format --output=none --set-exit-if-changed . && flutter analyze && flutter test
```
