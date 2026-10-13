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
# Copia el SQL recibido por el canal privado: 001_esquema_inicial.sql en api/db/migraciones/
# y las semillas (por ejemplo 001_temario_paes_2027.sql) en api/db/semillas/.
npm run migrar -w api                        # 40 tablas, 69 claves foráneas, 6 vistas y datos iniciales
npm run semillas -w api                      # temario PAES 2027 (idempotente)
npm run dev -w api                           # http://localhost:3000/api/v1/salud
npm run dev -w consola                       # http://localhost:5173
```

> **Si ya tenías la base de una versión anterior del modelo**, recréala una vez: la migración
> `001` ahora es el modelo 8.0 y su suma de verificación cambió (`dropdb` y `createdb`, luego
> `npm run migrar` y `npm run semillas`).

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

```bash
npm run lint      # tipos, ESLint (incluye las reglas de dependencia entre módulos) y Prettier
npm run test      # Vitest (no necesita base de datos)
npm run build
npm run codigo-muerto && npm run circulares && npm run duplicacion
npm run revisar-secretos   # ningún secreto puede llegar a GitHub
cd app && dart format --output=none --set-exit-if-changed . && flutter analyze && flutter test
```
