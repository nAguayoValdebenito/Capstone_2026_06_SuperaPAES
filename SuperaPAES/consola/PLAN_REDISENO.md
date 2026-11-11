# Plan de integración del rediseño de la consola

Base de código: `origin/main` en `c61f43f` (11 de noviembre de 2026). Este plan cubre solo la presentación de `consola/` y conserva las rutas, roles, contratos HTTP y reglas de negocio.

## Inventario de la consola actual

- `src/estilos/global.css`: 144 clases distintas. Define tokens, marco, menú, ingreso, tablas, botones, formularios, pestañas, paginación y estados. El ámbar aparece en `--aviso` y `--foco`.
- Diez hojas propias de páginas: estudiantes, evaluaciones, generador, invitar, legales, panel, planes, restablecer contraseña, revisiones y temario. Sus selectores pueden depender de los tokens globales.
- Componentes compartidos: `Alerta`, `DisenoGeneral`, `EncabezadoTabla`, `EnConstruccion`, `MensajeError`, `MenuLateral`, `Paginacion`, `Pestanas`, `SegunCarga` y `Selector`.
- `src/rutas/secciones.ts` define en un solo lugar las 14 secciones de administrador y 4 de docente, su orden y sus nombres. `src/App.test.tsx` comprueba las 18 rutas, roles, orden y textos del menú.
- Hay 24 archivos de pruebas TSX y 23 TS. Al menos 392 aserciones TSX buscan texto o marcado; los cambios de estructura deben conservar los textos de producto.

## Correspondencia entre maqueta y código real

| Elemento visual                            | Integración prevista                                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Paleta, tipografía, foco y movimiento      | `src/estilos/global.css`; hojas por página solo cuando el estilo sea específico.                            |
| Menú, cabecera, migas y diseño móvil       | `src/componentes/DisenoGeneral.tsx`, `MenuLateral.tsx`, `src/rutas/secciones.ts`.                           |
| Botones, campos, marcas de estado y tablas | Clases globales, `EncabezadoTabla.tsx`, `Selector.tsx`, `Paginacion.tsx`.                                   |
| Pestañas y estados de carga                | `Pestanas.tsx`, `SegunCarga.tsx`, `Alerta.tsx`, `MensajeError.tsx`.                                         |
| Ingreso y páginas públicas                 | `src/paginas/ingreso`, `restablecer-contrasena`, `verificar-correo`, `invitar`, `legales`, `no-encontrada`. |
| Panel, banco, editor e importación         | `src/paginas/panel`, `banco`, `pregunta`, `importar`.                                                       |
| Generador y revisiones                     | `src/paginas/generador`, `revisiones`.                                                                      |
| Evaluaciones, planes y administración      | `src/paginas/evaluaciones`, `planes`, `usuarios-internos`, `estudiantes`, `suscripciones`.                  |
| Trabajo docente                            | `src/paginas/revision`, `desempates`.                                                                       |
| Secciones aún no construidas               | `EnConstruccion.tsx` y las seis páginas que lo usan.                                                        |

Se revisaron `maquetas_consola_2026-11-10.zip` (`README.md`, `estilos.css`, `index.html` y `app.js`) y `BOCETOS COMPLETOS-20261111T145412Z-1-001.zip`. Los 80 bocetos muestran el diseño previo. La maqueta nueva propone un «libro de actas»: lateral claro, trazos finos, marcas de estado por forma y color, y una línea de margen en vistas de decisión. Su código de ejemplo no se incorpora al producto.

## Ajustes a los pasos 2 a 12

1. **Tokens**: sustituir el ámbar y medir contraste de claro y oscuro. Conservar los nombres de variables ya usados.
2. **Marco**: agregar grupos y migas a partir de las secciones existentes. Mantener orden y roles. Verificar el cajón móvil y la gestión del foco.
3. **Compartidos**: rediseñar botones, campos, tablas, pestañas, paginación y estados. Cada cambio se revisa en todas sus páginas usuarias.
4. **Públicas**: aplicar la composición visual sin alterar textos ni flujos de sesión.
5. **Panel**: usar solo cifras que entrega la API; comprobar vista tabular del gráfico.
6. **Banco/editor/importación**: no agregar búsqueda, orden ni selección masiva si los contratos vigentes no los soportan.
7. **Generador/revisiones**: preservar las validaciones y los estados existentes.
8. **Evaluaciones/planes/usuarios/estudiantes/suscripciones**: mostrar solo datos existentes; no introducir mezcla de dificultad por tipo de evaluación.
9. **Docente**: preservar la pauta y su validación; los atajos se incorporan solo si no interfieren con escritura.
10. **Funciones nuevas**: quedan fuera hasta aprobación expresa de D5 y revisión de sus contratos.
11. **Cierre**: actualizar la presentación de `EnConstruccion`, auditar accesibilidad y documentar las decisiones en `consola/DISENO.md`. C07 Temario ya está construida en esta base: se rediseña como página real. Permanecen pendientes C09, C12, C13, C14, D03 y D04; solo se cambia su presentación.

## Decisiones de trabajo

| Decisión                 | Criterio para avanzar                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| D1, mezcla de dificultad | Mantener el modelo global del DAS. No cambiar esquema ni API.                                    |
| D2, fuente de datos      | Usar JetBrains Mono solo para folios, códigos y cifras de datos, con `ui-monospace` de respaldo. |
| D3, contadores del menú  | Mostrar únicamente cifras que ya entrega la API.                                                 |
| D4, tema oscuro          | Respetar la preferencia del sistema; no agregar un control nuevo.                                |
| D5, funciones nuevas     | No construir búsqueda Ctrl K, campana, ayuda de atajos ni deshacer sin autorización expresa.     |

## Riesgos y verificaciones

- El cambio de tokens afecta simultáneamente a las 18 secciones. Se medirán contraste, foco y estados en claro y oscuro.
- Los tests de representación buscan textos y clases. Los textos de negocio se conservan; cualquier ajuste de marcado debe tener una prueba de comportamiento equivalente.
- El patrón de pestañas afecta Evaluaciones y otras páginas. Su navegación por teclado se probará antes de cambiar el componente compartido.
- La maqueta descrita fue hecha sobre `main` `125ceeb`; esta base ya incluye Temario. Sus siete páginas provisionales son ahora seis.
- La revisión visual a 1440 y 390 px, las capturas y la comparación exacta con la maqueta se realizarán al aplicar cada paso. La maqueta usa datos simulados: no se trasladarán cifras ni funciones sin respaldo de la API.
