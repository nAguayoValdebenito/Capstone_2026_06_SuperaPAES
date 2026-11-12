# Plan HU-64 · Listas de opciones (C09)

Estado: **opción A construida el 12/11/2026 (HU-64.1, solo lectura), por decisión delegada del usuario; falta registrarla en 04 y 05.** Rama: `feat/hu-64-listas-opciones` (desde `origin/main` 2412532, con el rediseño de consola).
Fecha: 12/11/2026.

## 1. Verificación de alcance

| Fuente (versión del cambio de alcance 20/10/2026) | Qué dice de HU-64 |
| --- | --- |
| 04 Product Backlog, fila 71 | «quiero mantener las listas de opciones…» · 3 puntos · **Should** · Sprint: **Pendiente** |
| 05 Sprint Backlog (sprints 4 a 8) | HU-64 no aparece en ninguna tarea. No hay planilla de Sprint 9; el 04 asigna al Sprint 9 solo HU-57, HU-58, HU-59, DOC-14, TEC-05, TEC-06 y TEC-07 |
| DAS: RF-C12 / CU-32 | «Mantener listas de opciones (pendiente)», Should, HU-64 (pendiente) |
| DAS: RN-25 y datos iniciales | Las listas se cargan con los datos iniciales; su edición «corresponde a HU-64 (pendiente)» |
| Auditoría 22/10/2026 | HU-64 «Pendiente (Should, 3)», C09 «Provisional · En construcción» |

**Conclusión: HU-64 no fue incorporada a ningún sprint.** Según CLAUDE.md («todo lo que se programe debe estar planificado antes en la documentación oficial»), no se programa hasta que el equipo la incorpore.

### Diferencia entre la historia y lo que se pidió

La historia y RF-C12 hablan de **mantener** (agregar, editar, desactivar, no borrar lo que está en uso, objetivo que sume 100). Lo pedido es una **consulta de solo lectura**. Además, CLAUDE.md dice que las listas «las carga la migración, ningún módulo las escribe», lo que choca con la edición que pide la historia. Antes de programar, el equipo debe decidir en la documentación:

- **Opción A (recomendada para el cierre):** partir HU-64 en dos tareas. HU-64.1 «Ver las listas de opciones» (solo lectura, ~1 punto, lo que se pidió) en el sprint vigente; los escenarios 1 a 4 de edición siguen pendientes.
- **Opción B:** incorporar HU-64 completa (3 puntos). Exige decidir qué módulo escribe cada lista y actualizar CLAUDE.md y arquitectura.md, porque hoy ningún módulo escribe catálogos.

El resto de este plan desarrolla la opción A.

## 2. Datos disponibles (modelo 11.0, sin cambios)

| Lista | Tabla | Datos propios | Carga inicial |
| --- | --- | --- | --- |
| Dificultades | `contenido.dificultad` | `orden`, `peso`, `mezcla_min`, `mezcla_objetivo`, `mezcla_max`, `acierto_esperado_min/max` | modelo: fácil 25/30/35, media 40/45/50, difícil 20/25/30 (RN-09) |
| Áreas de carrera | `contenido.area_carrera` + `contenido.area_carrera_prueba` | `electivo_area_id` → `contenido.area`, `orden`, `activo`; pruebas sugeridas | modelo (9 áreas) + semilla `002_evaluaciones.sql` (pruebas y electivo: Salud y Agro → Biología, Ingeniería → Física) |
| Otras que nombra la historia | `tipo_evaluacion`, `motivo_reporte`, `tipo_pregunta`, `tipo_texto` | `codigo`, `nombre` y sus columnas propias | modelo |

No hace falta migración ni semilla nueva. Se leen por `codigo`, nunca por `id`.

## 3. Módulo responsable y consultas existentes

Las listas no tienen servicio propio. Se propone que la consulta la dé **`temario`**, porque ya es dueño de `area_carrera_prueba` y ya tiene consultas parecidas en `api/modulos/temario/temario.repositorio.ts`:

- `AREAS_CARRERA` (perfil de la app): solo activas, devuelve ids de pruebas y del electivo. Sirve de base, pero C09 necesita también las inactivas y los nombres (prueba y electivo).
- `DIFICULTADES`: solo `mezcla_objetivo`. C09 necesita además mínimo y máximo.

Alternativa: `administracion` (la acción de auditoría `editar_catalogo` ya existe en el modelo). Conviene decidirlo junto con la opción A/B; para solo lectura, `temario` evita duplicar consultas.

## 4. Archivos (opción A)

### API

| Archivo | Cambio |
| --- | --- |
| `api/modulos/temario/temario.listas.repositorio.ts` (nuevo, o dentro de `temario.repositorio.ts` si no supera los límites de calidad) | `listarDificultadesConsola()`: `codigo, nombre, orden, mezcla_min, mezcla_objetivo, mezcla_max ORDER BY orden`. `listarAreasCarreraConsola()`: `codigo, nombre, activo`, pruebas sugeridas (`codigo`, `nombre`, orden de la prueba) y electivo (`nombre` de `contenido.area` o `null`), incluidas las inactivas. SQL parametrizado, acepta `tx` |
| `api/modulos/temario/temario.servicio.ts` | `consultarListasOpciones()` que junta ambas listas (sin reglas nuevas) |
| `api/modulos/temario/temario.controlador.ts` | acción `listasOpciones` con `responder()` |
| `api/modulos/temario/temario.rutas.admin.ts` | `router.get('/listas-opciones', exigirRol('admin'), controlador.listasOpciones)` → `GET /api/v1/admin/temario/listas-opciones` |
| `api/modulos/temario/temario.tipos.ts` | tipos `ListasOpciones`, `DificultadLista`, `AreaCarreraLista` |
| `docs/arquitectura.md` | fila del endpoint nuevo |

Respuesta propuesta:

```json
{ "data": {
    "dificultades": [{ "codigo": "facil", "nombre": "Fácil", "minimo": 25, "objetivo": 30, "maximo": 35 }],
    "areasCarrera": [{ "codigo": "salud", "nombre": "Salud", "activa": true,
                       "pruebas": [{ "codigo": "CL", "nombre": "Competencia Lectora" }],
                       "electivo": "Biología" }] },
  "error": null, "meta": null }
```

### Consola

| Archivo | Cambio |
| --- | --- |
| `consola/src/servicios/temario.ts` | `obtenerListasOpciones()` con `solicitarAdmin()` |
| `consola/src/tipos/` | tipos de la respuesta |
| `consola/src/paginas/listas-opciones/PaginaListasOpciones.tsx` | reemplaza `EnConstruccion`: `useCarga(obtenerListasOpciones)` + `SegunCarga` (carga y error), `Pestanas` «Dificultades» / «Áreas de carrera» (flechas, Inicio y Fin ya resueltos en el componente), tabla por lista con `EncabezadoTabla` |
| `consola/src/paginas/listas-opciones/TablaDificultades.tsx`, `TablaAreasCarrera.tsx` (nuevos) | columnas: código, nombre, mínimo, objetivo, máximo (con `%`) / código, nombre, pruebas sugeridas, electivo sugerido («Sin electivo» si es `null`), estado (Activa/Inactiva) |
| `consola/src/paginas/listas-opciones/listas-opciones.css` | solo tokens de `estilos/global.css` (nada de colores fijos), mismo patrón que `evaluaciones.css` |

Estados: carga («Cargando las listas…», `role="status"`), error (`MensajeError` con reintento, como en las demás páginas), vacío por lista («No hay dificultades cargadas», «No hay áreas de carrera cargadas»). Sin botones de agregar, editar ni borrar.

Accesibilidad: `<caption>` o `aria-label` en cada tabla, `scope="col"`, orden de tabulación natural, foco visible del rediseño y contraste revisado en tema claro y oscuro.

## 5. Dependencias

- Rediseño de consola: ya está en `origin/main` (PR #129); el `main` local estaba atrasado, por eso la rama sale de `origin/main`.
- Semilla `002_evaluaciones.sql` aplicada: sin ella las áreas salen sin pruebas ni electivo (la vista debe mostrarlo sin fallar).
- Decisión del equipo (opción A o B y módulo responsable) registrada en 02, 03, 04 y en el sprint backlog.

## 6. Pruebas

API (`api/pruebas/`, con dependencias falsas, sin base):

- `GET /api/v1/admin/temario/listas-opciones` con rol admin → 200 y el formato `{ data, error, meta }`.
- Rol docente → 403; token de la app → 401.
- Servicio: junta dificultades y áreas tal como las devuelve el repositorio; área sin electivo → `electivo: null`.
- Con `DATABASE_URL`: la consulta devuelve 25/30/35, 40/45/50, 20/25/30, 9 áreas, Salud con CL, M1 y CIE y Biología, Ciencias naturales sin electivo.

Consola (`PaginaListasOpciones.test.tsx`, Vitest + Testing Library):

- Muestra «Cargando…» mientras espera.
- Dificultades: código, nombre, mínimo, objetivo y máximo de cada fila.
- Áreas: pruebas relacionadas y electivo; «Sin electivo» cuando corresponde; área inactiva marcada.
- Lista vacía → mensaje de vacío; error de la API → mensaje de error y reintento.
- Pestañas con teclado (flecha derecha cambia de lista).
- No hay controles de edición.
- Quitar `/listas-opciones` de la lista de páginas «En construcción» en las pruebas de navegación, si aparece allí.

Chequeos: `npm run lint && npm run test && npm run build` desde `SuperaPAES/` (las pruebas con PostgreSQL se omiten sin `DATABASE_URL`), y revisión visual en claro y oscuro.

## 7. Estimación

~6 h: API 2 h, consola 2,5 h, pruebas y revisión visual 1,5 h.
