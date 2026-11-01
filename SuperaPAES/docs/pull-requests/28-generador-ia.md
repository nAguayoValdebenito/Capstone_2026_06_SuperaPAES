# Generador de preguntas con IA (HU-16.2, 16.3, 16.5, 17.1, 17.2, 18.1, 18.2)

## Qué hace

- `POST /api/v1/admin/generador/lotes` (202; 200 si ya había un pedido igual pendiente), `GET /lotes` y `GET /lotes/:id`. Solo administrador.
- Valida el pedido contra el temario (RN-08), el tope diario y el tope mensual, y exige el precio de cada proveedor que se pueda usar.
- Un worker (dentro de la API) toma cada lote con un candado de sesión de PostgreSQL, pide **una pregunta por ficha** (subtema, habilidad, dificultad por cuotas RN-09, contexto), la revisa y guarda las válidas como **borrador** de origen IA, con las alternativas barajadas en el servidor.
- Revisión automática: formato, alternativas, habilidad, repetidas, enunciado duplicado (también rechazadas y retiradas), explicaciones, clave coherente con la resolución (solo M1 y M2, solo números), letras en explicaciones, tildes y signos con criterio conservador. Cuenta cuántas preguntas descarta cada regla (`motivos_descarte`).
- Competencia Lectora: pide primero el texto (hasta 3 intentos revisados) y luego las preguntas apoyadas en él (Localizar, Interpretar, Evaluar); texto y preguntas se guardan juntos al final.
- Migración 005: solo `INSERT ... ON CONFLICT DO NOTHING` de parámetros (temperatura y precios por proveedor, `concurrencia_ia`).

## Decisiones y desvíos que hay que conocer

1. **Desvío del DAS 4.a y 4.b** (a documentar por Nicolas): el DAS describe una llamada por lote y lote fallido si falla. Aquí hay una llamada por pregunta; el lote queda `fallido` solo si ninguna pregunta fue válida, y `completado` si hubo alguna, con la falla anotada en `motivos_descarte`. El DAS no se tocó.
2. **Tope mensual** sigue en US$ 10 (RNF-03). Se vuelve a comprobar entre llamadas.
3. **Falla segura de precios**: si falta el precio de un proveedor (o es ≤ 0), no se crea el lote (503 `PRECIO_IA_NO_CONFIGURADO`) y, en el worker, el lote se cierra sin llamar a la IA. Si respondió un proveedor sin precio, se guardan los tokens sin costo y el tope mensual pasa a fallar de forma segura. Nunca se calcula como gratis. Valores iniciales: DeepSeek 0,30 / 1,20; Gemini 0,54 / 4,50 por millón (**Gemini a confirmar**).
4. **Reanudación**: si el proceso muere, el siguiente turno calcula `cantidad − válidas − descartadas` y continúa sin duplicar. Plazo máximo de 20 min por turno (constante en el código); al vencer, el lote se cierra con lo que tenga. Tras 3 fallas seguidas de la IA se corta; sin saldo se detiene.
5. **Riesgo (no resuelto): Render gratis duerme el servicio** y el worker corre dentro de la API. Un lote pendiente se retoma solo al despertar (hay prueba), pero no avanza mientras duerme.
6. Alternativas por prueba, leídas de las semillas (RN-08): CL 4, M1 4, M2 5, HCS 4, CIE 5 (máximo si la prueba admite 4 o 5).
7. Texto de lectura: mínimo 3 preguntas por texto (400 `VALIDACION` con mensaje claro).
8. Las reglas de las instrucciones dejan de ser solo numéricas: en pruebas conceptuales la «resolución» es un razonamiento. `VERSION_INSTRUCCIONES = '1.0'`.
9. Verificación cruzada con una segunda IA: **no implementada**, queda para después de medir.
10. Cambio mínimo en `ia-http.test.ts` por el nuevo límite de 256 KB de cuerpo (límites fijos y cuerpo detenido).
11. Observación: la prueba de concurrencia del candado de *creación* de lotes detecta su ausencia en ~2 de 3 corridas, no siempre; la del candado del worker y la de reanudación fallan siempre sin su mecanismo (verificado con mutaciones).

## Probado con proveedor falso (automático, sin llamar a ningún proveedor real)

Todo lo anterior con PostgreSQL real: creación, topes, precios, deduplicación concurrente, worker, costo por proveedor, descarte por regla, caídas y reanudación, dos workers sobre el mismo lote, plazo, concurrencia, retome por el worker, lote con texto, respuestas sin texto del modelo ni instrucción. Adaptadores (DeepSeek y Gemini) con `fetch` falso.

## Pendiente con clave real

- Medición de calidad: 20 preguntas en M1 y 20 en M2, 10 en CL, HCS y CIE. Criterio: 18 de 20 con clave correcta (90 %), al menos 5 subtemas distintos, descarte automático ≤ 30 %. Script local `docs/medir-generador.ts` (no versionado; usa una base temporal), con y sin resultado objetivo en M1 y M2.
- Confirmar los precios de Gemini y ajustar los límites de las reglas de tildes/largo con ejemplos reales.

## Verificación

lint, pruebas (1409 en la API, 63 omitidas sin base), build, `npm audit` (0), Knip, Madge, jscpd, secretlint y `probar:bd` (249 de 249) en verde.
