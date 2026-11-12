# HU-51.1 · API de configuración de la consola

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

## Verificación pendiente antes de integrar

Ejecutar `npm run lint`, `npm test` y `npm run build` en la raíz de `SuperaPAES`. Repetir las pruebas con `DATABASE_URL_PRUEBAS` apuntando a una base que termine en `_test`, para verificar persistencia, lectura inmediata del cupo y reversión al fallar la auditoría. Registrar HU-51 en el Sprint Backlog vigente y agregar sus casos CP al C2. No crear el PR hasta que la usuaria lo indique.
