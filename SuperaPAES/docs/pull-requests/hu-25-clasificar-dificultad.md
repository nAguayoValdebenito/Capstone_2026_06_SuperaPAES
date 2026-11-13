# Clasificar dificultad del banco semilla (D03, HU-25)

Construye la clasificación rápida de la dificultad de las preguntas importadas (RF-G12, CU-19a, que
extiende CU-19). Opción a del plan, aprobada por Nicolas: la clasificación rápida es la revisión del
docente asignado como revisor (CU-18 7.a); un clic entrega su revisión de la ronda con esa dificultad,
la decisión «aprobar» y la pauta cumplida, cuenta como uno de los dos revisores (RN-10) y la ronda
sigue RN-11 y RN-12. HU-25 sigue «Pendiente» en el 04: el equipo debe registrarla en el 04 y en el
Sprint Backlog vigente, con HU-25.1 y HU-25.2. Plan y decisiones en
`docs/planes/hu-25-clasificar-dificultad.md`.

Estado: HU-25.1 (servidor) y HU-25.2 (pantalla D03) terminadas.

## Contrato (HU-25.1)

Respuesta `{ data, error, meta }`. Ambas rutas usan el JWT de la consola con el rol `docente`: el
administrador recibe 403 y el token de la app, 401.

| Método y ruta | Entrada | data de éxito | Errores |
| --- | --- | --- | --- |
| GET /api/v1/admin/revision/clasificar/siguiente | Consulta opcional `despuesDe` (id de una asignación del docente) | `{ pregunta, quedan }`; `pregunta` es null si no queda ninguna | 400 VALIDACION (`despuesDe` no es un id), 401, 403 |
| POST /api/v1/admin/revision/clasificar/:id | `{ dificultad: "facil" \| "media" \| "dificil" }` (sin otros campos) | `{ guardada: { asignacionId, preguntaId, dificultad }, siguiente: { pregunta, quedan } }` (200) | 400 VALIDACION (dificultad inexistente, falta o campo de más), 401, 403, 404 NO_ENCONTRADO (asignación ajena o de una pregunta no importada), 409 CONFLICTO (ya entregada) |

Ejemplo de `GET /api/v1/admin/revision/clasificar/siguiente` (datos ficticios):

```json
{
  "data": {
    "pregunta": {
      "id": 900,
      "preguntaId": 118,
      "ronda": 1,
      "prueba": { "codigo": "M1", "nombre": "Competencia Matemática 1" },
      "eje": "Probabilidad y estadística",
      "contenido": "Medidas de posición",
      "habilidad": "Resolver problemas",
      "venceEn": "2026-11-16T12:00:00.000Z",
      "enunciado": "¿Cuál es la mediana de 1, 3 y 8?",
      "explicacion": "El valor central es 3.",
      "alternativas": [
        { "id": 101, "letra": "A", "texto": "1", "explicacion": null, "esCorrecta": false },
        { "id": 102, "letra": "B", "texto": "3", "explicacion": null, "esCorrecta": true }
      ],
      "texto": null,
      "dificultades": [
        { "codigo": "facil", "nombre": "Fácil" },
        { "codigo": "media", "nombre": "Media" },
        { "codigo": "dificil", "nombre": "Difícil" }
      ]
    },
    "quedan": 12
  },
  "error": null,
  "meta": null
}
```

## Reglas

- Bandeja: asignaciones pendientes del docente con rol `revisor` cuya pregunta tiene `importacion_id`,
  ordenadas por `vence_en` y `id`. Las demás preguntas se revisan solo en D01.
- Saltar: `despuesDe` deja al final las asignaciones que están antes de esa o son ella; al llegar al
  final vuelve a la primera.
- A ciegas (RN-12, CU-19 paso 2): sin la dificultad sugerida ni la revisión del otro docente.
- Clic: la revisión se guarda con la decisión `aprobar`, sin comentario, y los puntos activos de la
  pauta con `cumple = true`. Reserva la asignación con `FOR UPDATE`: dos clics a la vez sobre la misma
  asignación dan uno 200 y otro 409. Si es la última de la ronda, combina las revisiones en la misma
  transacción, igual que D01 (aprobada, desempate, posiblemente confusa).
- Para observar o rechazar, el docente abre la misma asignación en D01.
- Sin auditoría propia, como la entrega de D01: queda en `contenido.revision` y en
  `contenido.historial_estado_pregunta`.
- Sin cambios en el esquema, las migraciones ni las semillas.

## Archivos (HU-25.1)

- Nuevos: `revision.clasificacion.repositorio.ts`, `revision.clasificacion.servicio.ts`, pruebas
  `revision-clasificacion.test.ts` y `revision-clasificacion-bd.test.ts`.
- Cambiados: `revision.bandeja.repositorio.ts` (comparte la consulta de la pregunta abierta),
  `revision.servicio.ts`, `revision.validadores.ts`, `revision.controlador.ts`,
  `revision.rutas.admin.ts`, `comun/ids-respuesta.ts`, `pruebas/inventario-ids.ts`,
  `pruebas/escenario-ids-revision.ts` y `pruebas/revision-bd.ts` (servicios sobre otra conexión).

## Pruebas

- HTTP sin base: 11 (docente 200, administrador 403, token de la app 401, `despuesDe` inválido 400,
  dificultad inexistente o cuerpo con campos de más 400, 404, 409, bandeja vacía, saltar y el cuerpo
  exacto que se guarda).
- Con PostgreSQL: 7 (solo importadas y a ciegas, docente de otra área sin preguntas, saltar con vuelta,
  dos docentes a la vez reciben cada uno su asignación, no importada 404, dos clics a la vez 200 y
  409 con la pauta guardada, aprobada con la misma dificultad, fácil en D03 contra difícil en D01 va a
  desempate y queda posiblemente confusa).

## Pantalla D03 (HU-25.2)

- `PaginaClasificarDificultad.tsx` reemplaza `EnConstruccion`. Carga `ClasificacionDocente.tsx` al
  abrir la sección (trae KaTeX, como D01). La lógica está en `estado/clasificar-dificultad.ts`
  (`useClasificacionDocente`) y las llamadas en `servicios/revision.ts` (`siguienteAClasificar` y
  `clasificarDificultad`).
- Una pregunta por vista con `PreguntaRevisada` de D01 (ubicación, texto de lectura, alternativas con
  la correcta y explicación), la etiqueta «Importada» y el contador «Quedan N por clasificar».
- Tres botones grandes Fácil, Media y Difícil con los atajos 1, 2 y 3 (`aria-keyshortcuts`). La consola
  no tenía atajos globales; se ignoran con Ctrl, Alt o Meta y mientras se escribe en un campo. Mientras
  guarda, los botones se deshabilitan y un clic más una tecla cuentan una sola vez.
- Al guardar: aviso con `role="status"` («Pregunta 118 guardada como Media.»), avance a la siguiente
  que devuelve la API y foco en el primer botón. Si falla, el error con `role="alert"` y no avanza.
- «Saltar» pide la siguiente después de la abierta. «Revisar con la pauta» abre la misma asignación en
  Mis revisiones (`/revision?asignacion=<id>`): D01 ahora abre la asignación de la consulta si es un id
  válido.
- Estados: carga, error con «Reintentar» y vacío final «No quedan preguntas por clasificar.».
- Estilos en `paginas/clasificar-dificultad/clasificar-dificultad.css`, solo con tokens; la dificultad
  se dice con texto; 44 px en pantallas táctiles; a 390 px los botones van en una columna sin
  desplazamiento horizontal. La consola aún no tiene tema oscuro, así que se revisó solo el claro.

Capturas (datos ficticios, API simulada): `capturas/hu-25-d03-1440.png`,
`capturas/hu-25-d03-guardada-1440.png` y `capturas/hu-25-d03-390.png`.

Pruebas de la consola: 10 de interacción real en `ClasificacionDocente.test.tsx` (carga, singular,
vacío, error con reintento, enlace a D01, clic que guarda y avanza con el foco, atajos con y sin Ctrl,
clic y tecla a la vez, saltar y error al guardar) y 8 de reglas en `clasificar-dificultad.test.ts`
(atajos, campos, contador y la asignación de la consulta de D01).
