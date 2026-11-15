# Seguridad de la consola y la API: encabezados, fuentes locales y dependencias

Endurece la consola publicada en Vercel y la API en Render sin cambiar el esquema ni las reglas de
negocio. Los encabezados, Dependabot y el job de auditoría siguen sin estar en el DAS: el equipo debe
planificarlos y registrarlos antes de integrar (ver «Pendiente de documentar»).

## Consola (`consola/vercel.json`)

| Encabezado | Valor |
| --- | --- |
| Content-Security-Policy | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: https:; connect-src 'self' https://supera-paes-api.onrender.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'` |
| Permissions-Policy | Cámara, micrófono, geolocalización, pagos, USB, serial, Bluetooth, HID, MIDI, sensores y captura de pantalla, todos vacíos |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains` |
| Ya existentes | X-Content-Type-Options, X-Frame-Options, Referrer-Policy, X-Robots-Tag |

Las fuentes se instalan con `@fontsource/figtree`, `@fontsource/jetbrains-mono` y
`@fontsource/stix-two-text` (los mismos pesos de antes) y se importan en `src/main.tsx`. `index.html` ya
no carga nada de Google.

## API

- `encabezadosSeguridad`: el mismo `helmet()` de antes, ahora en `api/comun/middleware/encabezados.ts`
  (`app.ts` estaba en el límite de 300 líneas de ESLint).
- `sinAlmacenar`: `Cache-Control: no-store` en todo `/api/v1/admin`, también en errores. Una ruta puede
  poner su propio Cache-Control.
- Sin `X-Powered-By` (helmet ya lo quita; una prueba avisa si cambia). Los errores 5xx responden con un
  mensaje genérico y el detalle queda solo en el registro del servidor.

## CI

- `.github/dependabot.yml`: npm en `/SuperaPAES` y github-actions en `/`, cada lunes (hora de Chile).
  Agrupa en una solicitud las menores y parches de producción, en otra las de desarrollo y en otra las
  acciones.
- `.github/workflows/ci.yml`: job «Auditoría de dependencias», `npm audit --omit=dev --audit-level=high`.
  Solo lee `package-lock.json`; si falla, marca el PR sin detener los demás jobs.

## Decisiones

- `style-src 'unsafe-inline'` por los atributos `style` de KaTeX (44 en solo dos fórmulas de la vista
  previa). Los `style={{}}` de React no lo necesitan. Scripts e iframes siguen bloqueados.
- `img-src` con `https:`: el validador de textos de lectura (`DIRECCION_IMAGEN`) acepta imágenes https
  externas. Cuando todas vengan de `/api/v1/recursos`, se puede cerrar a
  `'self' data: https://supera-paes-api.onrender.com`.
- La CSP de `vercel.json` rige solo en producción; por eso `localhost:3000` no está en `connect-src`.
  La consola de `docker-compose` (`nginx.conf`) queda sin CSP.
- Sin límite general de peticiones en rutas sin sesión: los webhooks de Google y Apple podrían perder
  avisos, las imágenes de `/recursos` se piden muchas veces desde laboratorios con IP compartida, y
  Render consulta `/salud`. El ingreso, el registro, la recuperación y las invitaciones ya tienen el suyo.
- Los tokens de sesión siguen en `sessionStorage`; la CSP reduce el daño de un XSS. Pasarlos a cookie
  httpOnly exigiría rehacer el ingreso y no se hace ahora.

## Pendiente de documentar

1. DAS (despliegue en Vercel y RNF de seguridad): la CSP completa con la justificación de
   `'unsafe-inline'` y de `https:` en imágenes, Permissions-Policy, HSTS y fuentes alojadas con la consola.
2. DAS 4.3.3: helmet, `no-store` en `/api/v1/admin` y errores 5xx genéricos.
3. Dependabot semanal y agrupado, y el job de auditoría con su criterio (altas y críticas, solo
   producción). Decidir si se agrega pub para la app Flutter: hoy Dependabot no la cubre.
4. Registrar la decisión de no poner un límite general de peticiones.
5. Opcional: CSP para la consola de `docker-compose`.
