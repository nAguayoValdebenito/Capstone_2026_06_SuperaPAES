# Configuración de la consola (C12, HU-51)

Construye la consulta y el cambio de los parámetros del sistema (RF-C04, CU-24 alternativa 1.a) y la
pantalla C12. HU-51 sigue «Pendiente» en el 04: el equipo debe registrarla en el 04 y en el Sprint
Backlog vigente, con los casos CP en el C2. Plan: `docs/planes/hu-51-configuracion.md`.

## Alcance

El módulo `administracion` consulta los 23 parámetros de `contenido.configuracion` y permite cambiar únicamente las 15 claves de negocio definidas en el plan de HU-51. Cada cambio conserva el autor y fecha y registra `cambiar_configuracion` en la misma transacción. No hay cambio de esquema ni de semillas.

## Contrato

- `GET /api/v1/admin/administracion/configuracion`, rol `admin`: devuelve `{ data: { parametros }, error: null, meta: null }`. Cada parámetro contiene `clave`, `nombre`, `descripcion`, `valor`, `unidad`, `editable`, `regla`, `actualizadoEn` y `actualizadoPor`. El nombre del autor es `null` para los valores iniciales.
- `PATCH /api/v1/admin/administracion/configuracion/:clave`, rol `admin`: recibe `{ "valor": 12, "actualizadoEn": "2026-11-12T12:00:00.000Z" }`. La fecha es la de la última lectura de esa fila. Responde con el parámetro actualizado en `data`.

Ejemplo abreviado de respuesta GET (la lista real incluye todas las filas):

```json
{
  "data": {
    "parametros": [
      {
        "clave": "cupo_inicial",
        "nombre": "Cupo diario sin correo verificado",
        "descripcion": "Preguntas diarias de un estudiante sin correo verificado.",
        "valor": 10,
        "unidad": "preguntas",
        "editable": true,
        "regla": "RN-01",
        "actualizadoEn": "2026-11-12T12:00:00.000Z",
        "actualizadoPor": null
      }
    ]
  },
  "error": null,
  "meta": null
}
```

La API responde `VALIDACION` (400) ante cuerpo incorrecto o clave de solo lectura, `NO_ENCONTRADO` (404) ante clave inexistente, `CONFLICTO` (409) si la fecha ya cambió, `SIN_PERMISO` (403) para docente y `NO_AUTENTICADO` (401) para token de estudiante.

## Consola (C12)

`/configuracion`, solo administrador. Reemplaza «En construcción» por cinco grupos (cupos e
invitaciones, revisión docente, práctica y progreso, generación con IA y solicitudes de datos). Cada
fila muestra nombre, descripción, regla, último cambio (fecha y autor si existe) y el valor con su
unidad. Los 15 editables tienen campo con etiqueta, `inputmode` numérico o decimal, unidad y error
unidos por `aria-describedby`, y `aria-invalid` si el valor no cumple la regla. Los 8 de solo lectura
muestran el valor y la etiqueta «Solo lectura», sin campo.

La edición es por fila: «Revisar cambio» valida en la consola (la API sigue mandando) y abre una
confirmación con el valor anterior y el nuevo; Escape o Cancelar la cierran y devuelven el foco al
botón. Al guardar aparece «Parámetro guardado y cambio registrado.»; ante `CONFLICTO`, «Otro
administrador cambió este parámetro» y se recarga el valor vigente. Carga, error con Reintentar y
vacío cubiertos.

Capturas (API local con una base temporal migrada y con semillas, sesión de un administrador de
prueba; la base se borró al terminar):

- `capturas/hu-51-c12-configuracion-1440.jpg`: grupos y filas a 1440 px.
- `capturas/hu-51-c12-confirmar-1440.jpg`: confirmación con el valor anterior y el nuevo.
- `capturas/hu-51-c12-configuracion-390.jpg`, `capturas/hu-51-c12-error-campo-390.jpg` y
  `capturas/hu-51-c12-solo-lectura-390.jpg`: 390 px en una columna, error junto al campo y parámetro
  de solo lectura.

Revisión en el navegador (1440 y 390 px): sin desplazamiento horizontal; campos y botones de 44 px;
contraste medido en tema claro de 7,5:1 (textos secundarios) a 16:1; foco visible con el anillo global
de la consola; guardado real con una fila `cambiar_configuracion` en `contenido.auditoria` con antes y
después; conflicto real (otro cambio en la fila) sin fila de auditoría. La consola no tiene tema
oscuro, así que solo se revisó el claro.

## Verificación

- Lint, Prettier, pruebas de la API (1.118 aprobadas, 841 omitidas que necesitan PostgreSQL) y de la
  consola (400 aprobadas, con `--maxWorkers=2`), build, Knip, Madge, jscpd y secretlint aprobados en
  la rama.
- Pruebas de interacción real de C12 (`PaginaConfiguracion.interaccion.test.tsx`): montan la página
  con el hook `useConfiguracion`, los componentes y el cliente HTTP reales en jsdom; solo `fetch`
  responde como la API. Cubren: valor inválido con error junto al campo y sin PATCH; confirmación con
  el valor anterior y el nuevo, PATCH de una sola clave con `actualizadoEn` y recarga; `CONFLICTO` que
  avisa y muestra el valor vigente; orden de Tab por campos y botones (el de solo lectura sin
  control); Tab atrapado en la confirmación y Escape que la cierra y devuelve el foco. Se comprobó que
  fallan si se quita la validación de rango o el retorno del foco. Agregan `jsdom` como dependencia
  de desarrollo de la consola, activada solo en ese archivo con `@vitest-environment jsdom`.
- API con PostgreSQL (`DATABASE_URL_PRUEBAS` sobre una base temporal `_test`, borrada al terminar): las
  2 pruebas de HU-51 aprobadas (23 filas, guardado con autor, fecha y auditoría, consumidor que lee el
  nuevo cupo, y reversión si falla la auditoría).
- Sin cambios en el esquema, las migraciones ni las semillas.

## Pendiente para el equipo

- Registrar HU-51 en el 04 y en el Sprint Backlog vigente, y agregar sus casos CP al C2.
- C12 en la sección 7.4 del DAS dice «16 parámetros»; la tabla de la sección 2.4 y la base tienen 23.
- Decisiones abiertas del plan: si `max_preguntas_lote` es editable, reglas entre parámetros
  (`cupo_verificado >= cupo_inicial`, `revisores_requeridos >= 2`), mínimo de `plazo_derechos_dias` y
  su efecto en solicitudes abiertas, y el valor inicial de `modelo_ia`.
- El anillo de foco global de la consola (`--foco` en `estilos/global.css`) es ámbar; el bloque común
  pide evitar el ámbar. Cambiarlo afecta a toda la consola y queda fuera de HU-51.
