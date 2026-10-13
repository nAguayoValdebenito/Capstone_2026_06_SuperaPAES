## Qué cambia

<!-- Una o dos frases. Enlaza la historia de usuario si existe. -->

## Cómo se probó

<!-- Comandos ejecutados y resultado. -->

## Revisión

- [ ] El código nuevo vive en su módulo (`api/modulos/<modulo>/`) y respeta las capas: rutas → controlador → servicio → repositorio (SQL solo en el repositorio).
- [ ] Otro módulo se usa solo a través de su servicio (`index.ts`), nunca de su repositorio.
- [ ] Las respuestas usan `{ data, error, meta }` (`responder()` y los errores de `comun/errores.ts`).
- [ ] Las operaciones que cambian varias tablas usan `unidadDeTrabajo.enTransaccion`.
- [ ] Si cambia el esquema, hay una migración nueva numerada (no se editó una aplicada).
- [ ] IA, correo y pagos se usan a través de la `FabricaProveedores`; los parámetros de negocio salen de `contenido.configuracion`.
- [ ] No hay secretos ni datos personales reales en el código, los registros ni las pruebas.
- [ ] Pasan `npm run lint`, `npm run test` y `npm run build`, y `flutter analyze` y `flutter test` si se tocó la app.
