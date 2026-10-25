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

El SQL vive en `api/db`: migraciones `001` a `003` (modelo de datos 12.0), semillas `001` a `003`
(temario PAES 2027, evaluaciones y documentos legales 1.0, en ese orden) y las pruebas del modelo. La
migración `003` y la semilla `003` comparten el número, pero están en carpetas distintas y no chocan.

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

## Correo en desarrollo

Por defecto `PROVEEDOR_CORREO=consola`: no envía nada. Para ver los correos como los recibiría una
persona, instala **Mailpit** (opcional, https://mailpit.axllent.org), ejecútalo y usa en `api/.env`
`PROVEEDOR_CORREO=smtp`, `SMTP_HOST=localhost` y `SMTP_PORT=1025`. Los correos se ven en
http://localhost:8025.

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
