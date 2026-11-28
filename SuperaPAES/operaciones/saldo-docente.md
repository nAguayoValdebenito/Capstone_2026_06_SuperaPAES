# Saldo y remuneración docente

La funcionalidad está preparada en la rama `feat/saldo-docente`. La tarifa inicial es de $500 CLP por revisión válida. Se incluyen las revisiones normales, los desempates y la clasificación de dificultad. Aprobar, observar y rechazar generan el mismo abono. La calibración y los formularios sin entregar no generan abonos.

Cada docente puede tener hasta 20 asignaciones pendientes y completar hasta 50 revisiones por día de Santiago. Las pendientes de días anteriores también reservan espacio dentro del cupo diario. El administrador puede enviar más preguntas al liberarse espacio, respetando ambos límites. Los límites se pueden configurar hasta esos máximos.

El administrador registra nuevas tarifas, entre $1 y $700, con vigencia actual o futura. Cada entrega conserva el monto que le correspondía al completarse. El saldo se obtiene de los registros históricos; no representa transferencias realizadas. Las revisiones anteriores a la activación no reciben abonos retroactivos. Retirar o anular una pregunta no elimina lo ya ganado. Una nueva ronda de una pregunta corregida genera una nueva revisión pagable.

## Migración para Neon

Aplicar `api/db/migraciones/016_saldo_docente.sql` con el migrador del proyecto. No se modificaron las migraciones anteriores y no se aplicó esta migración en Neon durante el desarrollo.

La migración incorpora `contenido.tarifa_revision`, `contenido.remuneracion_revision`, los parámetros de capacidad y las restricciones de integridad. El registro de la entrega y su remuneración ocurre en la misma transacción. Los envíos y las entregas toman un bloqueo transaccional común antes de reservar filas, para evitar exceder límites y evitar inversiones en el orden de los bloqueos. Los importes, las revisiones entregadas y los datos que identifican su asignación quedan protegidos contra cambios.

Desde `SuperaPAES/`, con `DATABASE_URL` configurada para la base de Neon correspondiente:

```powershell
npm run migrar -w api
```

El migrador registra la migración y su suma de verificación. Usar este mecanismo evita ejecutar el SQL por separado sin registrar su aplicación. Las comprobaciones se realizaron con PostgreSQL 18 en bases locales temporales.

En el repositorio se encontró el SQL fuente v11 y las migraciones hasta la 015. El DAS menciona el modelo 12.0, pero no se encontró un archivo SQL v12. La ampliación usa el esquema real resultante de las migraciones vigentes.

## Prueba local

Configurar `api/.env` para la base de desarrollo que se quiera usar. Desde `SuperaPAES/`:

```powershell
npm run migrar -w api
npm run dev -w api
```

En otra terminal, también desde `SuperaPAES/`:

```powershell
npm run dev -w consola
```

1. Ingresar como administrador con una cuenta real. La sesión provisional de desarrollo no autentica consultas a la API.
2. Abrir **Remuneración docente** y comprobar la tarifa inicial de $500 y su vigencia. Los límites están en **Configuración**, dentro de **Revisión docente**.
3. Enviar una pregunta a revisión. Ingresar como uno de sus docentes asignados y completar la revisión.
4. Abrir **Mi saldo**. Comprobar el abono de $500, los acumulados y el detalle. Probar el rango de fechas y la paginación cuando haya suficientes registros. El filtro afecta al detalle; los acumulados conservan su significado total y mensual.
5. Cambiar la tarifa, por ejemplo a $600 con aplicación desde ahora, y completar otra revisión. La entrega anterior debe conservar $500 y la nueva debe registrar $600.
6. Completar un desempate o una clasificación de dificultad y comprobar el abono. Desde administración, seleccionar ese docente y comprobar el mismo historial.
7. Comprobar que no se asigna la pregunta pendiente número 21. Completar revisiones y enviar nuevas preguntas dentro del cupo diario. Si un desempate quedó esperando por falta de docentes con capacidad, usar **Reintentar desempates sin asignar** en **Revisiones** y actualizar la lista.

## API y permisos

| Método y ruta bajo `/api/v1/admin/revision` | Rol           | Resultado                                                          |
| ------------------------------------------- | ------------- | ------------------------------------------------------------------ |
| `GET /mi-saldo`                             | Docente       | Su propio resumen, capacidad y detalle paginado.                   |
| `GET /saldos/:docenteId`                    | Administrador | Resumen y detalle del docente indicado.                            |
| `GET /tarifas`                              | Administrador | Historial de tarifas y docentes disponibles para consulta.         |
| `POST /tarifas`                             | Administrador | Registra una tarifa con vigencia y auditoría.                      |
| `POST /desempates/reintentar`               | Administrador | Reintenta resolver hasta 100 rondas listas que esperan asignación. |

Las consultas de saldo aceptan `desde` y `hasta` como fechas inclusivas de Santiago, `pagina` desde 1 y `porPagina` entre 1 y 50. La paginación se devuelve en `meta`. El docente se obtiene de la sesión y no acepta un identificador ajeno en su consulta.

Para registrar una tarifa, enviar `montoClp` y `ultimaTarifaId` como números. `vigenteDesde` es opcional y usa ISO 8601 con zona horaria; al omitirlo se aplica desde el momento de guardar. El formulario convierte la fecha local del equipo y el historial muestra la hora de Santiago. Una modificación concurrente del historial exige recargarlo antes de volver a guardar.

## Verificación realizada

- API: 128 pruebas aprobadas en las suites de saldo, configuración, esquema e identificadores; tres comprobaciones de integración continua omitidas fuera de ese entorno. Las suites nuevas contienen 14 pruebas de permisos y tarifas y 10 con PostgreSQL para remuneración y capacidad.
- Consola: las 80 suites completaron 551 pruebas aprobadas, incluidas siete pruebas nuevas de interacción.
- Respaldo y restauración: 13 pruebas aprobadas y dos comprobaciones de integración continua omitidas. Contingencia, reintegración e inventario de rutas: 23 aprobadas y dos omitidas.
- Tras integrar las rutas en el router existente se repitieron sus suites de permisos e identificadores: 114 pruebas aprobadas.
- Revisión estática y compilación de API y consola aprobadas. Inspección visual de las pantallas de escritorio y móvil realizada con respuestas de prueba.
- La ejecución completa inicial detectó expectativas de inventario desactualizadas y restricciones del entorno de GPG y de procesos de prueba. Se actualizaron las expectativas afectadas y se repitieron esas suites con herramientas y directorios temporales de prueba.

Para reproducir las pruebas de saldo:

```powershell
npm run test -w api -- pruebas/revision-saldo.test.ts pruebas/revision-saldo-bd.test.ts
npm run test -w consola -- src/paginas/saldo/Saldo.interaccion.test.tsx
```

Las pruebas de base de datos necesitan `DATABASE_URL_PRUEBAS` con una base separada cuyo nombre termine en `_test` y un usuario que pueda crear bases temporales. La base de producción no se usa para pruebas.

## Comandos de Git

Desde la carpeta principal del repositorio, revisar y preparar los cambios:

```powershell
git status --short
git add -- "Fase 2/Evidencias Proyecto" SuperaPAES/api SuperaPAES/consola SuperaPAES/operaciones/saldo-docente.md
git diff --cached --stat
git commit -m "Agrega saldo docente y tarifas por revision"
```

No se ejecutaron `git add`, `git commit` ni `git push` durante el desarrollo.

## Archivos modificados o agregados

La lista siguiente incluye la documentación oficial, la migración, el código y las pruebas de esta ampliación.

- Fase 2/Evidencias Proyecto/02 Documento de epicas e Historias de Usuario.docx
- Fase 2/Evidencias Proyecto/03 Plantilla Historias de Usuario.xlsx
- Fase 2/Evidencias Proyecto/04 Product Backlog con Puntos de Historia.xlsx
- Fase 2/Evidencias Proyecto/05 Sprint 10 Backlog con Actividades y Horas.xlsx
- Fase 2/Evidencias Proyecto/C1 Documento de Arquitectura de Software (DAS).docx
- Fase 2/Evidencias Proyecto/C2 Plan de Pruebas y Evidencias.docx
- Fase 2/Evidencias Proyecto/C3 Manual Tecnico y de Despliegue.docx
- SuperaPAES/api/comun/ids-respuesta.ts
- SuperaPAES/api/db/migraciones/016_saldo_docente.sql
- SuperaPAES/api/modulos/administracion/administracion.configuracion.reglas.ts
- SuperaPAES/api/modulos/revision/revision.bandeja.repositorio.ts
- SuperaPAES/api/modulos/revision/revision.clasificacion.repositorio.ts
- SuperaPAES/api/modulos/revision/revision.controlador.ts
- SuperaPAES/api/modulos/revision/revision.reintento.repositorio.ts
- SuperaPAES/api/modulos/revision/revision.repositorio.ts
- SuperaPAES/api/modulos/revision/revision.rutas.admin.ts
- SuperaPAES/api/modulos/revision/revision.saldo.controlador.ts
- SuperaPAES/api/modulos/revision/revision.saldo.repositorio.ts
- SuperaPAES/api/modulos/revision/revision.saldo.rutas.admin.ts
- SuperaPAES/api/modulos/revision/revision.saldo.servicio.ts
- SuperaPAES/api/modulos/revision/revision.saldo.validadores.ts
- SuperaPAES/api/modulos/revision/revision.servicio.ts
- SuperaPAES/api/pruebas/configuracion-admin-bd.test.ts
- SuperaPAES/api/pruebas/escenario-ids-revision.ts
- SuperaPAES/api/pruebas/escenario-ids.ts
- SuperaPAES/api/pruebas/imagenes-migracion-bd.test.ts
- SuperaPAES/api/pruebas/inventario-ids.ts
- SuperaPAES/api/pruebas/inventario-rutas-admin.test.ts
- SuperaPAES/api/pruebas/revision-envio-bd.test.ts
- SuperaPAES/api/pruebas/revision-envio.test.ts
- SuperaPAES/api/pruebas/revision-saldo-bd.test.ts
- SuperaPAES/api/pruebas/revision-saldo.test.ts
- SuperaPAES/consola/src/App.test.tsx
- SuperaPAES/consola/src/estado/busqueda-global.test.ts
- SuperaPAES/consola/src/estado/formulario-tarifa.ts
- SuperaPAES/consola/src/estado/reintento-desempates.ts
- SuperaPAES/consola/src/estado/saldo.ts
- SuperaPAES/consola/src/paginas/configuracion/grupos.ts
- SuperaPAES/consola/src/paginas/revisiones/PaginaRevisiones.tsx
- SuperaPAES/consola/src/paginas/revisiones/ReintentarDesempates.tsx
- SuperaPAES/consola/src/paginas/saldo/ConsultaSaldo.tsx
- SuperaPAES/consola/src/paginas/saldo/FormularioTarifa.tsx
- SuperaPAES/consola/src/paginas/saldo/PaginaMiSaldo.tsx
- SuperaPAES/consola/src/paginas/saldo/PaginaRemuneracion.tsx
- SuperaPAES/consola/src/paginas/saldo/Saldo.interaccion.test.tsx
- SuperaPAES/consola/src/paginas/saldo/saldo.css
- SuperaPAES/consola/src/rutas/secciones.ts
- SuperaPAES/consola/src/servicios/revision.ts
- SuperaPAES/consola/src/servicios/saldo.ts
- SuperaPAES/consola/src/tipos/saldo.ts
- SuperaPAES/operaciones/saldo-docente.md
