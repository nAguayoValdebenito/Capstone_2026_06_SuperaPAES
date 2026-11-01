# HU-16.1 · Actualizar el modelo inicial de IA mediante la migración 004

La migración inicial deja `modelo_ia` con el nombre retirado `deepseek-chat`. La nueva
`004_modelo_ia_vigente.sql` lo cambia a `deepseek-flash` únicamente cuando la clave es
`modelo_ia` y su valor JSONB es exactamente esa cadena anterior. Un modelo alternativo elegido
por un administrador, el valor ya vigente y las demás claves permanecen intactos.

## Decisiones

- `valor` es JSONB; la comparación conserva la distinción entre una cadena, un arreglo, un objeto
  o un valor JSON nulo. Si falta el parámetro, no se crea.
- La descripción reemplaza el nombre anterior únicamente en la misma fila y bajo la misma
  condición. La descripción genérica actual no cambia. `actualizado_por` se conserva y la fecha
  cambia solo cuando se actualiza el modelo; repetir el SQL no altera ninguna fila ni metadato.
- El migrador aplica cada SQL junto con su registro en una transacción y valida el SHA-256.
  Una vez aplicada la 004 en cualquier base, su archivo no se puede editar: cualquier corrección
  posterior requiere una migración nueva. También rechaza una migración registrada cuyo archivo
  falte en la rama actual; no se modifica ese comportamiento.
- La 001 incluye los parámetros iniciales. La 004 corre después y las semillas se ejecutan al
  terminar las migraciones; ninguna de las semillas actuales vuelve a escribir `modelo_ia`.
  No se modifican las migraciones 001–003, los archivos de modelo SQL, las semillas ni el DAS.
- No hay una expectativa existente que compruebe `deepseek-chat` como valor inicial del parámetro.
  La referencia de `api/db/pruebas/modelo_bd.sql:102` es un dato de lote histórico y se conserva.
- Rama independiente de `feat/conexion-ia`, creada desde `origin/main` en `33c00c4`.
  No cambia adaptadores, dependencias ni tiempos de espera de las pruebas.

## Aplicación en producción y verificación posterior

`npm run migrar:produccion -w api` ejecuta el migrador compilado y después las semillas. Descubre
la 004 automáticamente y la aplica en Neon, sin UPDATE manual, **cuando esta rama esté integrada
en `main` y se despliegue**. El Dockerfile incluye la carpeta completa de migraciones. Esta tarea
no ejecuta ese despliegue ni aplica la 004 a la base local de desarrollo o a una base remota.

Consulta de verificación, para ejecutar después de la aplicación autorizada:

```sql
SELECT clave, valor FROM contenido.configuracion WHERE clave = 'modelo_ia';
```

Resultado esperado en una base nueva o que todavía tenía el valor inicial:

```text
modelo_ia | "deepseek-flash"
```

Si un administrador eligió otro valor, ese valor se conserva.

## Orden para la futura prueba manual con IA

No preparar la base de desarrollo desde `fix/modelo-ia-vigente` y luego ejecutar el migrador desde
`feat/conexion-ia`: esta última no tiene el archivo 004 y rechazaría su registro en la base.
La propuesta es crear una rama local desechable `prueba/ia-real` que una ambas ramas, sin modificar
`main` ni subirla nunca, y preparar y verificar la base de desarrollo exclusivamente desde ella
cuando el usuario lo indique. La rama de prueba, la aplicación local y las llamadas con claves
reales siguen pendientes; no forman parte de esta ejecución.

## Propuesta para el DAS

Modelo de IA para generar preguntas (modelo_ia) = deepseek-flash

La actualización del DAS corresponde al equipo de documentación en su versión siguiente.

## Archivos

- `api/db/migraciones/004_modelo_ia_vigente.sql` (HU-16.1).
- `api/pruebas/modelo-ia-migracion-bd.test.ts` (HU-16.1).
- `docs/pull-requests/20-modelo-ia-vigente.md`.

## Verificación

- RED observado antes de crear la 004: instalación nueva devuelve `deepseek-chat` en lugar de
  `deepseek-flash`, conservando la descripción genérica y el usuario nulo esperados.
- Pruebas dirigidas con PostgreSQL: 14 casos nuevos aprobados, más las 15 pruebas existentes del
  migrador; un control exclusivo de CI omitido localmente. Incluyen instalación nueva seguida de
  semillas, conservación de descripción/usuario, modelo alternativo y vigente, igualdad JSONB
  exacta, clave ausente, descripción condicional, doble ejecución y demás claves idénticas.
- `npm test` con PostgreSQL: API 732 aprobadas y 39 omitidas; consola 109 aprobadas. La rama parte
  de la línea base de `main` con API 718 aprobadas y 38 omitidas; no incluye las pruebas de la rama
  independiente de adaptadores.
- `npm run lint`: aprobado, incluidos TypeScript, ESLint y formato.
- `npm run build`: aprobado en API y consola.
- `npm audit`: cero vulnerabilidades; sin cambios de dependencias ni lockfile.
- `npm run codigo-muerto` (Knip): aprobado.
- `npm run circulares` (Madge): sin ciclos; conserva un aviso de resolución de `react-router`
  en consola, comprobado con `--warning`.
- `npm run duplicacion` (jscpd): aprobado; 0,07 % de líneas duplicadas y dos clones existentes.
- `npm run revisar-secretos` (secretlint): aprobado.
- `npm run probar:bd -w api`: 249/249; crea una base temporal, aplica 001–004 y después las semillas.
  Se usó la conexión local de pruebas como conexión administrativa, sin conectar a desarrollo.
- Limpieza verificada: cero bases temporales restantes de la nueva suite y de `probar:bd`.
- No se ajustó ninguna afirmación existente del modelo, no se aumentaron tiempos de espera y no
  se desactivaron pruebas. La 004 solo se ejecutó en bases temporales de pruebas que se eliminaron.
  No se aplicó a la base local de desarrollo ni a ninguna base remota, incluida Neon.
- Revisión propia del diff, sin subagentes; sin cambios a `main` ni a `feat/conexion-ia`, sin llamadas
  reales a proveedores, sin push, PR ni despliegues.
