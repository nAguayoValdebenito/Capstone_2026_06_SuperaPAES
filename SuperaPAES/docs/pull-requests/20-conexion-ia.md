# HU-16.1 · Conexión real con DeepSeek y Gemini

Los adaptadores de IA dejan de devolver `NO_IMPLEMENTADO`: reciben una instrucción preparada,
consultan el proveedor por HTTPS y entregan propuestas con forma JSON validada. La fábrica conserva
la estrategia común; con DeepSeek, un HTTP 402 activa Gemini únicamente si se configuró su clave.
Los demás errores conservan el proveedor elegido. El simulado sigue disponible en desarrollo.

## Contrato para HU-16.2 y HU-16.3

`generarPreguntas({ instruccion: string }): Promise<ResultadoGeneracion>` recibe una instrucción
ya armada y sin datos personales. El adaptador solo agrega el formato técnico JSON. No consulta
cuentas ni construye el temario, ejemplos aprobados o mezcla de dificultad.

El resultado contiene `proveedor`, `modelo` y `preguntas`. Cada propuesta tiene `enunciado`,
`alternativas` con `letra`, `texto`, `esCorrecta` y `explicacion`, además de `explicacion` y
`dificultadSugerida`. `tokensUsados` y `usoTokens` (`entrada`, `salida`, `total`) se incluyen solo
cuando el proveedor informa esos datos; no se inventan ceros ni se calculan costos. El respaldo
devuelve proveedor, modelo y uso de Gemini. El uso informado corresponde a la respuesta entregada;
no representa una estimación de consumo de intentos fallidos que no reportaron uso.

La validación con Zod es estructural: tipos, campos y enums. No comprueba contenido pedagógico,
cantidad de alternativas, cantidad solicitada ni corrección de las preguntas. Eso queda para HU-17.1.

## Límites de transporte y errores

- Constantes en `api/adaptadores/ia/http.ts`: 120 s hasta cabeceras, 30 s adicionales para cuerpo,
  un reintento global y espera de 1500 ms. El cuerpo se lee bajo la señal de aborto.
- Se reintenta exclusivamente red, 5xx o contenido vacío. Un segundo vacío devuelve
  `IA_RESPUESTA_INVALIDA`; JSON ilegible, truncamiento y timeout no se reintentan.
- Ambos proveedores reciben un tope explícito de 8192 tokens de salida. DeepSeek usa
  `response_format: json_object`; Gemini, `responseMimeType: application/json`.
- Una llamada puede tardar hasta unos 5 minutos en el peor caso (301500 ms de plazo compartido,
  incluido el respaldo). Por eso HU-16.2 debe invocar al proveedor desde un proceso de lote en
  segundo plano y nunca dentro de una petición HTTP que el usuario espera.
- Errores del catálogo: `IA_NO_DISPONIBLE` (503), `IA_RESPUESTA_INVALIDA` (502) e
  `IA_SALDO_AGOTADO` (503 sin respaldo). No llevan cuerpos externos ni causas originales.
- Cada respuesta HTTP registra proveedor y estado; el respaldo registra origen, destino y causa
  fija `saldo_agotado`. No se registran instrucciones, respuestas, claves ni datos personales.
- Claves en encabezados, nunca en URL; redirecciones rechazadas y sin destinos configurables en
  variables de entorno de producción.

## Fuentes oficiales, comprobadas el 29/10/2026

- [Errores de DeepSeek](https://api-docs.deepseek.com/quick_start/error_codes/): HTTP
  `402 — Insufficient Balance` es saldo agotado; 401 y 429 son autenticación y límites de uso.
- [Thinking de DeepSeek](https://api-docs.deepseek.com/guides/thinking_mode/) y
  [referencia Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/):
  `deepseek-flash` razona por defecto; se envía `thinking: { type: "disabled" }`, que desactiva
  ese modo mediante el parámetro documentado. No se usa la combinación de thinking habilitado y
  JSON mode ni se presupone una compatibilidad no garantizada.
- [Salida JSON de DeepSeek](https://api-docs.deepseek.com/guides/json_mode/): exige mencionar
  JSON en la instrucción y advierte que el contenido puede llegar vacío ocasionalmente.
- [Modelo Gemini](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite): estable,
  salida estructurada; [API REST generateContent](https://ai.google.dev/api/generate-content).
- [Retiro de modelos DeepSeek](https://api-docs.deepseek.com/news/news260424/):
  `deepseek-chat` y `deepseek-reasoner` dejaron de funcionar el 24/07/2026. La corrección del
  parámetro queda para la migración 004 en `fix/modelo-ia-vigente`, independiente de esta rama.

## Variables de producción

La validación sigue rechazando los proveedores simulados. Se cuentan variables de despliegue
efectivo, incluido `NODE_ENV=production`:

| Modo de IA            | Obligatorias | Opcionales generales | Requisitos de IA                                         |
| --------------------- | -----------: | -------------------: | -------------------------------------------------------- |
| DeepSeek sin respaldo |           25 |                    3 | `PROVEEDOR_IA=deepseek`, `DEEPSEEK_API_KEY`              |
| DeepSeek con respaldo |           27 |                    3 | Las anteriores más `GEMINI_API_KEY` y `GEMINI_MODELO`    |
| Gemini directo        |           26 |                    3 | `PROVEEDOR_IA=gemini`, `GEMINI_API_KEY`, `GEMINI_MODELO` |

Las 24 comunes, incluido el selector de IA, son:

1. `NODE_ENV`
2. `DATABASE_URL`
3. `CORS_ORIGENES`
4. `JWT_SECRETO_CONSOLA`
5. `JWT_SECRETO_APP`
6. `URL_CONSOLA`
7. `CLAVE_CODIGO_CORREO`
8. `PROVEEDOR_IA`
9. `PROVEEDOR_CORREO`
10. `SMTP_HOST`
11. `SMTP_PORT`
12. `SMTP_TLS`
13. `SMTP_USUARIO`
14. `SMTP_CLAVE`
15. `CORREO_REMITENTE`
16. `PROVEEDOR_PAGOS`
17. `GOOGLE_PLAY_PAQUETE`
18. `GOOGLE_PLAY_CUENTA_SERVICIO`
19. `GOOGLE_PLAY_PUBSUB_AUDIENCIA`
20. `APP_STORE_BUNDLE_ID`
21. `APP_STORE_ID_EMISOR`
22. `APP_STORE_ID_CLAVE`
23. `APP_STORE_CLAVE_PRIVADA`
24. `APP_STORE_ENTORNO`

A ellas se suman las claves y el modelo de IA de la tabla. Las tres opcionales generales son
`PORT`, `DATABASE_SSL` y `SMTP_TIMEOUT_MS`. Con DeepSeek sin respaldo, las dos variables de Gemini
son una habilitación opcional conjunta: al informar `GEMINI_API_KEY`, se exige `GEMINI_MODELO`.
Con Gemini directo, `DEEPSEEK_API_KEY` no se usa ni se exige. `GEMINI_MODELO` no tiene valor por
defecto en el código; los ejemplos proponen `gemini-3.5-flash-lite`.

Docker mantiene `PROVEEDOR_IA=simulado`, claves vacías y pasa las tres variables de IA a la API.
No se agregan dependencias: fetch y AbortController pertenecen a Node 24 (MIT); Zod ya existía.

## Comprobación manual pendiente

La guía y el script de `docs/` permanecen ignorados por Git. Primero se aplica y verifica la 004
en la base local, después se ejecuta la prueba con la clave propia. El script anuncia proveedor
y modelo antes del pedido; imprime solo cantidad, uso y resultado de la validación, sin respuestas
ni claves. No habilita respaldo para la prueba individual. No se ejecutaron llamadas reales ni
se marcaron casos del C2. Esta rama no se despliega a Neon ni a Render.

## Propuesta para el DAS

El adaptador de IA recibe instrucciones sin datos personales y usa HTTPS con claves solo en el
servidor; ante saldo agotado de DeepSeek (HTTP 402), usa Gemini si está configurado, con tiempos
de espera y un único reintento acotados, y entrega modelo, proveedor y uso de tokens informado.

El cambio de la tabla de parámetros a `modelo_ia = deepseek-flash` pertenece al PR independiente
de la migración 004 y a la versión siguiente del DAS del equipo de documentación.

## Verificación

- `npm run lint`: aprobado (TypeScript, ESLint y formato, API y consola).
- `npm test` con PostgreSQL: API 781 aprobadas y 38 omitidas; consola 109 aprobadas.
- `npm run build`: aprobado en API y consola.
- `npm audit`: 0 vulnerabilidades; sin dependencias nuevas ni cambios en el lockfile.
- `npm run codigo-muerto` (Knip): aprobado.
- `npm run circulares` (Madge): sin ciclos. En consola conserva el aviso de resolución de
  `react-router` (un archivo omitido por la herramienta).
- `npm run duplicacion` (jscpd): aprobado; 0,10 % de líneas duplicadas.
- `npm run revisar-secretos` (secretlint): aprobado.
- `npm run probar:bd -w api`: 249/249 casos correctos en base temporal.
- Compose válido; imágenes compiladas y stack aislado iniciado con IA simulada; API y consola
  HTTP 200. Se retiraron los contenedores y el volumen ficticio del smoke al terminar.
- Script manual: comprobación TypeScript aprobada; ejecución sin elegir proveedor rechazada
  con el resumen seguro, sin leer claves ni llamar a la red.
- Pruebas dirigidas: vacío y éxito, vacío persistente, truncamiento, timeout de cabeceras/cuerpo,
  red y 5xx, 4xx sin reintento, selección y errores del respaldo, no filtración de claves/cuerpos,
  conservación del presupuesto global y lectura dinámica del modelo.
- No se tocaron migraciones, semillas ni el DAS; revisión de alcance y `git diff --check` aprobadas.
