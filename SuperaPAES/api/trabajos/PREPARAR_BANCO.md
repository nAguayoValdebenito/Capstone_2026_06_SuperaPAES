# Preparar un banco original (TEC-04)

La herramienta lee carpetas de JSON descomprimidos. No importa preguntas, publica contenido ni
modifica la base. Los originales y resultados deben conservarse en una carpeta privada ignorada
por Git, por ejemplo `docs/banco/tec-04/`.

Desde `SuperaPAES/`:

```powershell
npm.cmd run preparar:banco -w api -- --entrada ../docs/banco/tec-04/originales --salida ../docs/banco/tec-04/ejecucion-nueva --reparaciones ../docs/banco/tec-04/reparaciones.json --decisiones ../docs/banco/tec-04/decisiones.json
```

Los argumentos se resuelven desde `api/`. `salida` debe ser una carpeta nueva y estar fuera del
directorio de originales. Cada ejecución conserva los JSON reparados y un inventario con SHA-256,
cantidad de registros y reparaciones. Una salida existente se rechaza para conservar la evidencia.
Un JSON inválido o con una estructura distinta detiene la ejecución; no se omite silenciosamente.

El temario se consulta mediante el servicio de `temario`, con la configuración local de la API.
Para reproducir el trabajo sin conectarse a la base, agregar `--temario` con el `temario.json`
generado en una ejecución anterior. Los candidatos usan nombres y descriptores de contenidos
activos; sus puntajes y coincidencias son propuestas, nunca aprobaciones.

## Reparaciones

`reparaciones.json` es una lista de objetos con `archivo` (ruta relativa con `/`), `sha256` del
original, `antes`, `despues` y `motivo`. El fragmento debe coincidir exactamente una vez. Se utiliza
para reparar sintaxis revisada, por ejemplo comillas sin escapar. No debe utilizarse para decidir
una respuesta contradictoria. Las claves JSON duplicadas permanecen señaladas y bloquean la
exportación de esa pregunta, aunque `JSON.parse` conserve el último valor.

## Revisión y alternativas

`revision.json` conserva cada registro con su fuente, número, identificador, contenido original,
incidencias, candidatos y decisión. `revision.csv` sirve para inspeccionar la lista en una planilla.
`decisiones.json` es una lista con estos campos:

| Campo                 | Uso                                                          |
| --------------------- | ------------------------------------------------------------ |
| `id`                  | Identificador exacto de `revision.json`.                     |
| `estado`              | `pendiente`, `excluir` o `preparar`.                         |
| `motivo`              | Justificación de la revisión, obligatoria.                   |
| `contenidoId`         | Contenido activo del temario, para preparar la pregunta.     |
| `habilidad`           | Código de una habilidad oficial de esa prueba.               |
| `eliminarAlternativa` | Letra del distractor que se decidió retirar, si corresponde. |

La preparación exige una clasificación y habilidad válidas, alternativas distintas y una correcta
existente. Los enunciados repetidos quedan apartados para revisión. En M1 se exige ajustar de cinco
a cuatro alternativas; solo se retira el distractor elegido y se conserva la respuesta correcta,
actualizando su letra. Si la explicación menciona letras, el ajuste requiere revisión del texto.
Las equivalencias numéricas simples también se detectan como duplicados; las equivalencias
algebraicas y la corrección disciplinar requieren revisar el contenido.

Las preguntas de CL que aún no tienen texto de lectura separado permanecen pendientes. La
herramienta no inventa textos, habilidades, permisos de uso ni correspondencias fuera del temario.

`preguntas.csv` incluye únicamente decisiones `preparar` sin incidencias, con las columnas de la
plantilla existente, BOM UTF-8, punto y coma y CRLF. Una decisión inválida permanece pendiente con
el motivo. Un archivo que solo contiene la cabecera significa que ninguna pregunta quedó preparada.
`evidencia.json` conserva inventario, reparaciones, decisiones y totales, que deben cuadrar con los
registros originales. Las decisiones desconocidas o duplicadas se rechazan.

El CSV sigue pasando por la revisión e importación habitual (CU-16, CP-10). Allí se declara el origen
y permiso de uso (RN-29). Las preguntas importadas quedan como borradores y siguen las revisiones
docentes de RN-10 a RN-13; preparar un registro no lo aprueba para publicación.
