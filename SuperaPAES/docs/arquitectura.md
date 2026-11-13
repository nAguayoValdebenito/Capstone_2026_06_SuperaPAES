# Arquitectura de Supera PAES

Fuente: Documento de Arquitectura de Software (C1 DAS, versión 1.1 del 12/10/2026) y modelo de
datos 8.0. Este documento describe cómo lo implementa el código.

## Estilo: monolito modular en capas

Supera PAES es **una sola API REST** (Node 24, Express 5, TypeScript) que se despliega como una
unidad y se divide en **diez módulos** con límites claros. Dentro de cada módulo el código se
organiza en capas. La **app Flutter** (estudiantes, Android e iOS) y la **consola React** (equipo
interno) son interfaces de usuario del monolito: no tienen reglas de negocio y nunca acceden a la
base de datos. Una sola PostgreSQL 18 con dos esquemas: `contenido` (lo que produce el equipo
interno) y `app` (lo que producen los estudiantes); `app` apunta a `contenido`, nunca al revés.

```
   App Flutter (Android, iOS)        Consola React (navegador)
           │ HTTPS /api/v1/app               │ HTTPS /api/v1/admin
           └──────────────┬──────────────────┘
                          ▼
   ┌──────────────────── API (monolito) ────────────────────┐      Google Play / App Store
   │ comun: configuración, middleware, errores, respuesta   │◄──── /api/v1/webhooks/*
   │ modulos: cuentas · temario · preguntas · generador ·   │
   │   revision · practica · cupo-invitaciones ·            │────► adaptadores: IA, correo,
   │   suscripciones · privacidad · administracion          │      pasarelas de pago
   │ trabajos: worker de la cola de generación              │
   │ db: conexión, unidad de trabajo, migraciones           │
   └───────────────────────────┬────────────────────────────┘
                               ▼
                    PostgreSQL 18 (contenido, app)
```

### Por qué un monolito modular

- **Operaciones que cruzan módulos y deben cumplirse completas.** Responder una pregunta descuenta
  cupo, guarda la respuesta y actualiza el progreso; publicar exige la revisión cerrada; confirmar
  un pago cambia el acceso del estudiante. En un solo proceso son una transacción de PostgreSQL.
- **Un modelo de datos muy relacionado**: 40 tablas, 69 claves foráneas y vistas que cruzan
  módulos (por ejemplo, el progreso une respuestas con el temario).
- **Solicitudes de la Ley 21.719** (acceso, supresión, portabilidad) que tocan datos de varios
  módulos y se resuelven en una sola transacción auditable.
- **Un solo punto de aplicación de reglas** para dos interfaces: la app y la consola no pueden
  aplicar reglas distintas porque ninguna las tiene.
- **Crecimiento horizontal**: la API no guarda estado de sesión (JWT), así que se pueden agregar
  instancias detrás del balanceador.
- La **generación con IA** es asíncrona (cola en `contenido.lote_generacion` y worker en
  `trabajos/`) y es el primer candidato a separarse en su propio servicio si algún día hace falta.

## Estructura de la API

```
api/
├── servidor.ts          # lee la configuración, crea dependencias reales y arranca la API y el worker
├── app.ts               # raíz de composición: crearServicios(), crearApp(dependencias), montaje de rutas
├── modulos/<modulo>/    # un paquete por módulo funcional
│   ├── <modulo>.rutas.app.ts       # /api/v1/app/<modulo>   (si atiende a la app)
│   ├── <modulo>.rutas.admin.ts     # /api/v1/admin/<modulo> (si atiende a la consola)
│   ├── <modulo>.controlador.ts
│   ├── <modulo>.servicio.ts        # reglas de negocio; única puerta de entrada para otros módulos
│   ├── <modulo>.repositorio.ts     # único lugar con SQL del módulo
│   ├── <modulo>.validadores.ts     # esquemas zod
│   └── index.ts                    # exporta solo rutas y servicio
├── comun/               # configuracion, errores, respuesta, jwt, roles, salud, middleware/
├── adaptadores/         # ia/, pagos/, correo/ y fabrica.ts (FabricaProveedores)
├── trabajos/            # worker-generacion.ts (productor-consumidor sobre lote_generacion)
├── db/                  # conexion.ts, transaccion.ts, migrador.ts, semillas.ts,
│                        # migraciones/, semillas/, scripts/ (migrar.ts, semillas.ts)
└── pruebas/             # Vitest y Supertest
```

## Módulos

Cada tabla pertenece a un solo módulo, que es el único que la escribe. Los demás la leen o la
modifican pidiéndoselo a su servicio.

| Módulo              | Tablas y vistas                                                                                                                                                             | Rutas                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `cuentas`           | `app.estudiante`, `app.token_sesion`, `app.token_correo`, `app.consentimiento`, `app.estudiante_prueba`, `app.puntaje_paes`; ingreso de `contenido.usuario_interno`         | app y admin (ingreso)   |
| `temario`           | `contenido.area`, `contenido.prueba`, `contenido.eje_tematico`, `contenido.contenido_tematico`, `contenido.habilidad`                                                       | app (lectura) y admin   |
| `preguntas`         | `contenido.pregunta`, `contenido.alternativa`, `contenido.pregunta_version`, `contenido.texto_estimulo`, `contenido.importacion`, `app.reporte_pregunta`                    | app (avisos) y admin    |
| `generador`         | `contenido.lote_generacion` (más el worker de `trabajos/`)                                                                                                                  | admin                   |
| `revision`          | `contenido.asignacion_revision`, `contenido.revision`, `contenido.criterio_pauta`, `contenido.revision_criterio`                                                            | admin (admin y docente) |
| `practica`          | `app.sesion_practica`, `app.entrega`, `app.respuesta`, `app.estadistica_pregunta`; vistas `v_preguntas_publicadas`, `v_progreso_eje`, `v_progreso_habilidad`                | app                     |
| `cupo-invitaciones` | `app.cupo_diario`, `app.invitacion`, `app.movimiento_bono`                                                                                                                  | app                     |
| `suscripciones`     | `contenido.plan`, `app.suscripcion`, `app.suscripcion_prueba`, `app.pago`, `app.suscripcion_evento`, `app.evento_pasarela`; vistas `v_resumen_suscripciones`, `v_pagos_mes` | app, admin y webhooks   |
| `privacidad`        | `app.solicitud_derecho`; exportación y borrado de la cuenta con seudonimización                                                                                             | app y admin             |
| `administracion`    | `contenido.usuario_interno` (gestión), `contenido.docente_especialidad`, `contenido.configuracion`, `contenido.auditoria`; vista `v_calidad_criterio`; panel y estudiantes  | admin                   |

Dependencias entre servicios (las crea `crearServicios` en `app.ts`, en este orden):
`administracion` → `cuentas` (correo) → `temario` → `preguntas` → `generador` (IA) → `revision` →
`cupo-invitaciones` → `suscripciones` (pasarelas) → `practica` (cupo-invitaciones, preguntas,
suscripciones) → `privacidad` (cuentas).

## Reglas de dependencia

1. Dentro de un módulo: rutas y middleware → controlador → servicio → repositorio. Cada capa usa
   solo la inmediatamente inferior. Ninguna importa una capa superior.
2. **Un módulo usa a otro solo a través de su servicio** (lo que exporta su `index.ts`), nunca de su
   repositorio. Ejemplo: `practica.servicio` pide a `cupoInvitaciones` descontar el cupo.
3. Los módulos pueden usar `comun/`, `adaptadores/` y `db/`; esas carpetas **nunca** importan
   módulos, `trabajos/` ni la raíz de composición.
4. La consola y la app dependen de la API solo por HTTP.

Las reglas se verifican solas: `api/eslint.reglas-arquitectura.js` las define como
`no-restricted-imports` (`npm run lint` falla si se rompen) y `api/pruebas/arquitectura.test.ts`
comprueba cada regla con importaciones que la violan.

Responsabilidad de cada capa:

- **rutas**: método, ruta, middleware (autenticar → autorizar rol → validar → limitar intentos) y
  controlador. Sin lógica.
- **controlador**: traduce HTTP a llamadas del servicio y responde con `responder()`. Sin SQL ni
  adaptadores.
- **servicio**: reglas de negocio y transacciones. No conoce `req` ni `res`.
- **repositorio**: único lugar con SQL de su módulo, siempre parametrizado (`$1`). Cada método
  acepta un `Ejecutor` opcional para sumarse a la transacción en curso.
- **validadores**: esquemas zod que usa `validar()` en las rutas.

## Patrones

- **Unidad de trabajo** (`db/transaccion.ts`): `unidadDeTrabajo.enTransaccion(async (tx) => …)`
  abre una transacción; el servicio pasa `tx` a sus repositorios y a los servicios de otros módulos.
  Si algo falla a mitad de camino, se revierte todo (`pruebas/transaccion.test.ts`, también contra
  PostgreSQL real).
- **Adaptador y estrategia** (`adaptadores/`): IA (`simulado` | `deepseek` | `gemini`), correo
  (`consola` | `smtp`) y pasarelas de pago (`simulado` | `tiendas`: Google Play y App Store)
  comparten una interfaz por tipo.
- **Fábrica** (`adaptadores/fabrica.ts`, `FabricaProveedores`): elige cada implementación según
  `PROVEEDOR_IA`, `PROVEEDOR_CORREO` y `PROVEEDOR_PAGOS`. Los módulos reciben los proveedores ya
  creados.
- **Inyección de dependencias**: `crearApp(dependencias)` recibe base, unidad de trabajo,
  proveedores y secretos; las pruebas entregan dependencias falsas y no usan base real. El reloj
  (`comun/reloj.ts`) se inyecta donde hoy importa la hora: la `FabricaProveedores` se lo entrega a
  la pasarela simulada. Cuando un servicio necesite la hora (cupo, planes, vencimientos, plazos),
  recibirá `reloj` en sus dependencias en vez de llamar a `new Date()`.
- **Repositorio**: el SQL de cada módulo vive en su repositorio.
- **Productor-consumidor**: la consola crea lotes pendientes en `contenido.lote_generacion` y el
  worker de `trabajos/` los consume a través de `generador.servicio`.

## Flujo de una petición

```
POST /api/v1/app/cupo-invitaciones/invitaciones
  helmet → CORS → express.json (guarda el cuerpo crudo)
  → autenticarApp (JWT de la app)                      401 si falta o no sirve
  → validar({ cuerpo: esquemaCodigoInvitacion })       400 VALIDACION
  → límite de intentos                                 429 DEMASIADOS_INTENTOS
  → controlador.registrarCodigo → servicio → repositorio (SQL) → responder()
  → manejo de errores: cualquier error → { data: null, error, meta: null }
```

## Formato de respuesta

- Éxito: `{ "data": <resultado>, "error": null, "meta": <paginación u otros datos, o null> }`.
- Error: `{ "data": null, "error": { "codigo": "MAYUSCULAS", "mensaje": "en español", "detalles": opcional }, "meta": null }`.
- Paginación en `meta`: `{ "pagina", "porPagina", "total" }`.

Detalle de códigos en [convenciones.md](convenciones.md).

## Rutas y seguridad

HU-51.1 agrega `GET /api/v1/admin/administracion/configuracion` para consultar los parámetros
de `contenido.configuracion` y `PATCH /api/v1/admin/administracion/configuracion/:clave` para
cambiar un valor editable. Ambas rutas exigen el rol `admin`. El cambio usa la fecha
`actualizadoEn` recibida para detectar modificaciones simultáneas (`CONFLICTO`), guarda el autor
y registra `cambiar_configuracion` con los valores anterior y nuevo en la misma transacción.
Las claves técnicas de solo lectura se muestran, pero no se cambian desde la consola.

HU-13.3 agrega `GET /api/v1/admin/preguntas/importaciones/plantillas`, con rol `admin`,
para descargar las plantillas vacías de preguntas y textos de lectura desde C04. El servicio
usa las mismas columnas que valida el importador y devuelve los archivos CSV UTF-8 dentro
de `{ data, error, meta }`. Descargar no crea preguntas ni importaciones; al cargarlas se
mantienen la revisión por fila y la declaración del origen (RN-29).

HU-64.1 agrega `GET /api/v1/admin/temario/listas-opciones`, con rol `admin`, para la pantalla C09.
Las listas de opciones no tienen servicio propio: las lee `temario`, que es dueño de
`area_carrera_prueba`. Devuelve las dificultades con su mezcla global (`minimo`, `objetivo`, `maximo`
de `contenido.dificultad`) y las áreas de carrera, activas o no, con sus pruebas sugeridas y su
electivo (o `null`), los tipos de evaluación con su modo de armado y su comportamiento, y los motivos
de aviso, tipos de pregunta y tipos de texto con su estado (`activa`). Es de solo lectura: la edición de los escenarios 1 a 4 de HU-64 sigue pendiente.

HU-50.1 y HU-50.2 agregan los avisos de error de los estudiantes para la pantalla C13 (RF-C08,
CU-26, CU-26a, RN-22). `preguntas` es dueño de `app.reporte_pregunta` y de `app.anular_pregunta`;
`evaluaciones` solo cuenta, con sus propias tablas, en cuántas evaluaciones aparece la pregunta. La
consola pide el conteo a `evaluaciones` y la anulación a `preguntas`, porque `evaluaciones` ya depende de
`preguntas` y lo contrario sería un ciclo.

| Método y ruta                                          | Rol   | Operación                                                                 |
| ------------------------------------------------------ | ----- | ------------------------------------------------------------------------- |
| `GET /api/v1/admin/preguntas/avisos`                   | admin | Bandeja agrupada por pregunta; por defecto los pendientes; filtro por estado y motivo; paginada por pregunta |
| `PATCH /api/v1/admin/preguntas/avisos/:id`             | admin | Cierra un aviso como resuelto o descartado; auditoría `atender_reporte`   |
| `POST /api/v1/admin/preguntas/:id/anulacion`           | admin | Anula una pregunta publicada; resuelve sus avisos pendientes; auditoría `anular_pregunta` |
| `GET /api/v1/admin/evaluaciones/preguntas/:id/impacto` | admin | Evaluaciones cerradas y abiertas donde aparece la pregunta                |

Imágenes de las preguntas (migración 007, HU-12.6): `preguntas` es dueño de
`contenido.imagen`. El administrador sube un archivo con `POST /api/v1/admin/preguntas/imagenes` (rol
admin, cuerpo `image/png`, `image/jpeg` o `image/webp`, hasta 2 MB; el límite es solo de esa ruta). El
servidor comprueba el contenido (no la extensión; SVG no se acepta), endereza, reduce a 1.600 px de lado
mayor, convierte a WebP sin metadatos (`sharp`, en `comun/imagenes.ts`) y guarda la imagen una sola vez por
su huella SHA-256; devuelve `direccion` para escribir `![texto alternativo](direccion)` en el Markdown de la
pregunta o del texto de lectura. Subir otra vez la misma imagen no guarda otra copia ni repite la
auditoría `subir_imagen`. La entrega es pública (`GET /api/v1/recursos/imagenes/<huella>.webp`) porque
`<img>` e `Image.network` no envían el token; la huella no se puede adivinar ni listar, y la imagen no
tiene datos de ningún estudiante. RN-06 se cumple porque la dirección viaja dentro del texto de la
pregunta, que la app recibe solo cuando corresponde. Una imagen no se modifica ni se borra (disparador
`imagen_fija`).

La bandeja no entrega datos del estudiante. Cerrar un aviso cierra solo ese aviso. La anulación es
irreversible y va en una sola transacción: `app.anular_pregunta` retira la pregunta, marca sus ítems
como anulados y recalcula las evaluaciones cerradas (`recalculado_en`), los avisos pendientes quedan
resueltos y la auditoría guarda cuántas se recalcularon y qué avisos se cerraron. Solo se anula una
pregunta publicada: anular otra vez responde 409 y no vuelve a recalcular. Los ítems de una evaluación
abierta quedan anulados pero se siguen mostrando hasta cerrarla; al cerrarla no cuentan.

HU-52.1 y HU-52.2 agregan estas rutas del módulo `suscripciones` para la pantalla C11:

| Método y ruta                                 | Rol   | Operación                                       |
| --------------------------------------------- | ----- | ----------------------------------------------- |
| `GET /api/v1/admin/suscripciones/planes`        | admin | Lista planes activos e inactivos y sus opciones |
| `PUT /api/v1/admin/suscripciones/planes/:id`    | admin | Edita un plan existente y registra la auditoría |

La edición del plan, sus productos y la auditoría se realiza en una sola transacción. No se
agregan rutas de creación ni borrado. HU-52.3 exige que el identificador del producto sea igual
en Google Play y en la App Store para cada plan y periodicidad; C11 permite escribirlo una sola
vez y lo envía a ambas tiendas. La restricción existente `UNIQUE (canal_venta_id, id_producto)`
evita duplicarlo en otra oferta de la misma tienda, incluso ante escrituras concurrentes. Si se
rechaza, se revierte también el plan y no se registra una auditoría de edición exitosa.

| Prefijo                                      | Quién              | Autenticación                                                  |
| -------------------------------------------- | ------------------ | -------------------------------------------------------------- |
| `/api/v1/app/*`                              | App del estudiante | JWT firmado con `JWT_SECRETO_APP`, audiencia `app`             |
| `/api/v1/admin/*`                            | Consola            | JWT firmado con `JWT_SECRETO_CONSOLA`, audiencia `admin`, rol  |
| `/api/v1/webhooks/google-play`, `/app-store` | Tiendas            | Sin JWT: cada pasarela verifica el envío (Pub/Sub o firma JWS) |
| `/api/v1/recursos/imagenes/<huella>.webp`    | App y consola      | Pública, solo `GET`: imagen de una pregunta por su huella SHA-256; caché de un año (`immutable`), `ETag` y `Cross-Origin-Resource-Policy: cross-origin` |
| `/api/v1/salud`                              | Consola, monitoreo | Pública; consulta la base con límite de 3 s (200 o 503)        |
| `/api/v1/salud/vivo`                         | Render             | Pública; no toca la base                                       |

- Un token de la app nunca sirve en la consola ni al revés (secretos y audiencias distintos).
- Separación de roles de la consola (HU-03 esc. 3, CU-23 3.b): el administrador no entra a las
  secciones ni a las rutas del docente, ni el docente a las del administrador. La API no confía solo
  en el rol del token: en cada petición a `/api/v1/admin/*`, después de verificar el JWT, comprueba en
  `contenido.usuario_interno` que la cuenta exista, esté activa y tenga el mismo rol que el token. Si
  no, responde 401 `NO_AUTENTICADO` y la consola vuelve al ingreso; al entrar de nuevo recibe un
  token con el rol actual. Así un cambio de rol o una desactivación rige en la siguiente petición y
  no cuando vence el token. Después, `exigirRol` de cada router decide el 403.
- Sesión de la consola (CU-03, HU-03, RNF-01), en `/api/v1/admin/cuentas` (públicas, con límite de
  intentos): `POST /ingreso` compara la contraseña con bcrypt y entrega `{ tokenAcceso, tokenRenovacion }`.
  Un correo sin cuenta interna (como el de un estudiante) y una contraseña incorrecta reciben el mismo
  401 «Correo o contraseña incorrectos.», y el correo sin cuenta tarda lo mismo. Solo con la
  contraseña correcta, una cuenta desactivada recibe 403 `CUENTA_DESACTIVADA` («Tu cuenta está
  desactivada. Contacta a un administrador…»): así no se revela a un extraño qué correos existen. El token de acceso es un JWT de 15 minutos; la credencial de renovación son 32 bytes al azar
  que se guardan solo cifrados (SHA-256) en `app.token_sesion` con `usuario_interno_id`, el navegador
  y un vencimiento de 8 horas (`HORAS_SESION_CONSOLA`, constante de seguridad, no parámetro de
  negocio). `POST /renovar` la cambia por una nueva (la usada queda con `revocado_en`) y emite el
  token con el rol que la cuenta tiene hoy; una cuenta desactivada no renueva. `POST /cierre` la
  revoca. El ingreso registra `ultimo_acceso`. La consola guarda la sesión en `sessionStorage`, ante un
  401 renueva una vez y repite la petición, y si no puede, vuelve al ingreso.
- Rutas públicas: registro, ingreso y recuperación de contraseña (`/app/cuentas/*`) e ingreso de la
  consola (`/admin/cuentas/ingreso`). Tienen límite de intentos, igual que las invitaciones.
- `trust proxy = 1` para que el límite use la IP real detrás del proxy de Render.
- `helmet` en todas las respuestas; CORS solo para la consola (`CORS_ORIGENES`). La app móvil no
  necesita CORS.

## Configuración

Variables de entorno validadas con zod al iniciar (`comun/configuracion.ts`). Siempre obligatorias:
`DATABASE_URL`, `JWT_SECRETO_APP` y `JWT_SECRETO_CONSOLA` (distintos, ≥ 32 caracteres). Las de cada
proveedor solo si ese proveedor está elegido. Ver `api/.env.example`.

Los **parámetros de negocio** (cupos, bono, tope de invitaciones, mezcla de dificultad, plazos,
topes de la IA, versión de los términos) no van en variables de entorno ni en el código: viven en
`contenido.configuracion` (16 filas de la migración inicial) y el servicio de `administracion` los
entrega a los demás módulos.

## Base de datos

- Modelo 8.0: `docs/base-de-datos/Supera_PAES_Modelo_BD.sql` (fuente; no se edita). Copia exacta
  en `api/db/migraciones/001_esquema_inicial.sql`, con 16 parámetros, 4 planes y 8 criterios.
- Cada cambio de esquema es una migración nueva numerada. El migrador registra la suma SHA-256 de
  cada archivo en `public.migracion_aplicada` y se detiene si una migración aplicada cambió.
- Semillas idempotentes en `api/db/semillas/` (temario PAES 2027), con `npm run semillas -w api`.

## Interfaces de usuario

HU-18.3 completa C05 con el texto de lectura y sus preguntas del lote elegido,
ordenadas por su posición en el texto y con la habilidad, alternativas y explicación.
El banco admite el filtro opcional `lote` en `GET /api/v1/admin/preguntas`, sobre
`contenido.pregunta.lote_id`, sin modificar el esquema. La consola recorre sus páginas
y consulta los detalles existentes de preguntas y textos; mantiene las preguntas
que ya cambiaron de estado. Solo consulta lecturas de lotes terminados con texto y
preguntas válidas. Al cambiar de lote cancela la carga anterior y permite reintentar
una consulta fallida. La generación y la revisión docente conservan sus servicios.

- **Consola** (`consola/`, React + Vite): presentación (`paginas/`, `componentes/`) → estado y
  hooks (`estado/`, por ejemplo `useSaludSistema`) → `servicios/` (uno por módulo de la API) → cliente HTTP (`api/cliente.ts`, lee
  `{ data, error, meta }`). Menú por rol: administrador (13 secciones) y docente (Revisión,
  Desempates, Clasificar dificultad). La protección de rutas solo ordena la navegación: la API
  vuelve a verificar el rol en cada petición.
- **App** (`app/`, Flutter): `presentacion` → `dominio` ← `datos` → `nucleo` (cliente dio hacia
  `/api/v1/app`). 16 pantallas y barra inferior (Inicio, Practicar, Progreso y Planes).

## Calidad automática

Las reglas de [buenas-practicas.md](buenas-practicas.md) se verifican solas: umbrales de
complejidad y tamaño en `eslint.reglas-calidad.js` (API y consola), reglas de dependencia en
`api/eslint.reglas-arquitectura.js`, código muerto con knip (`knip.json`, esqueletos marcados con
`@esqueleto`), imports circulares con madge y duplicación con jscpd (`.jscpd.json`). La app usa
`very_good_analysis`. Todo corre en la CI (`.github/workflows/ci.yml`).

## Decisiones

| Decisión                                        | Motivo                                                                                          |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Monolito modular en capas                       | Ver "Por qué un monolito modular"                                                               |
| `pg` con SQL escrito a mano, sin ORM            | El modelo usa vistas, restricciones e índices parciales; el SQL queda explícito y revisable     |
| Migraciones `.sql` con un ejecutor propio       | Un archivo por cambio, con suma de verificación y bloqueo para no correr dos veces a la vez     |
| Pagos por las tiendas (Google Play y App Store) | Las suscripciones digitales dentro de una app móvil se cobran con la facturación de cada tienda |
| JWT con `jose`, secretos por interfaz           | Sin estado en el servidor; separación estricta entre app y consola                              |
| Sin contenedores                                | Render ejecuta Node directamente; en local basta PostgreSQL 18 instalado                        |
| Fuentes de la app empaquetadas                  | Sin descargas en tiempo de ejecución ni dependencias nuevas                                     |

## Reglas de negocio (anexo de la documentación oficial)

Se implementan en los servicios en las historias de usuario; aquí quedan como referencia.

- **RN-01.** Cupo diario de 10 preguntas sin verificar el correo y 20 con el correo verificado,
  común a todas las pruebas y modos. Se descuenta primero el cupo del día y después el saldo de bonos.
- **RN-02.** El cupo se reinicia a las 00:00 hora de Chile.
- **RN-03.** El invitante recibe 5 preguntas de bono cuando el invitado verifica su correo; una vez
  por invitado, acumulable y sin vencimiento. Un correo o dispositivo cuenta una sola vez y hay un
  tope mensual de invitaciones premiadas (10, configurable).
- **RN-04.** Las preguntas de pruebas cubiertas por una suscripción vigente no descuentan cupo.
  Ensayos, mini-ensayos, diagnóstico y repaso tampoco; el repaso sin el plan Todas las pruebas se
  limita al número configurado.
- **RN-05.** Planes mensuales o anuales en pesos chilenos, mismo precio en Google Play y App Store:
  Una prueba $1.990 al mes o $15.990 al año; Todas las pruebas $2.990 al mes o $23.990 al año
  (anual = 12 meses al precio de 8). Aviso por correo 7 días antes de renovar un plan anual. El
  cambio de mensual a anual empieza al terminar el período pagado. Cancelar es no renovar, se hace
  en la gestión de suscripciones de la tienda y el plan sigue activo hasta el fin del período pagado.
- **RN-06.** El servidor corrige. La app nunca recibe la alternativa correcta antes de responder.
- **RN-07.** Solo se responde una pregunta entregada a ese estudiante y aún no respondida.
- **RN-08.** Competencia Lectora, M1 e Historia usan 4 alternativas; M2 y Ciencias 4 o 5; siempre
  una sola correcta. Toda pregunta de Competencia Lectora está ligada a un texto de lectura.
- **RN-09.** Mezcla de dificultad: 20 a 30 % fácil, 50 a 60 % media, 15 a 20 % difícil (objetivo
  25, 55 y 20).
- **RN-10.** Cada pregunta la revisan dos docentes especialistas del área, que no sean su autor ni
  quien solicitó el lote, de forma independiente.
- **RN-11.** Dos aprueban: aprobada. Dos rechazan: rechazada. Alguno observa: observada. Uno
  aprueba y otro rechaza: decide un tercer docente.
- **RN-12.** La IA o el autor solo sugieren la dificultad; cada revisor asigna la suya sin ver la
  sugerencia; si no coinciden, decide el desempate. Fácil contra difícil marca la pregunta como
  posiblemente confusa.
- **RN-13.** Solo se publica una pregunta aprobada y con dificultad asignada por un docente.
- **RN-14.** Un eje (en Competencia Lectora, una habilidad) se marca para reforzar con acierto
  menor a 60 % y al menos 5 respuestas.
- **RN-15.** Con 30 o más intentos, una pregunta cuyo acierto no coincide con su dificultad pasa a
  revisión docente.
- **RN-16.** Los puntajes PAES son declarados, de 100 a 1.000, y solo se usan en métricas
  agregadas, con permiso específico.
- **RN-17.** Todo cambio de estado de una suscripción queda registrado con fecha y origen
  (estudiante, pasarela o sistema); cada aviso de las tiendas se registra una sola vez con su
  resultado. No se modifica ni se borra; si el estudiante elimina su cuenta, se conserva
  seudonimizado.
- **RN-18.** La app es para personas de 14 años o más; la declaración queda registrada con la
  aceptación de los términos.
