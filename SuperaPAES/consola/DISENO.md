# Diseño de la consola

Sistema visual de la consola del equipo interno: un «libro de actas». Papel claro, líneas finas que ordenan la información y marcas de corrección (visto, círculo, cruz) que dicen el estado con una forma además del color. Parte de la maqueta aprobada el 10/11/2026 y se adapta a lo que la consola hace: el diseño cambia la apariencia, no el funcionamiento.

Fuente única de los valores: `src/estilos/global.css`. Las hojas de cada página (`src/paginas/*/*.css`) solo agregan lo propio de esa página y usan los tokens, nunca colores fijos.

## Principios

- **Primero el trabajo.** La información que se decide va en actas (folio, línea de margen celeste, firma); lo demás, en líneas finas y no en tarjetas sueltas.
- **El estado no es solo color.** Cada estado tiene color y marca por forma.
- **Sin ámbar, naranja ni morado.** La atención es el mismo granate del error, en contorno y con círculo abierto.
- **Movimiento corto y con sentido.** 150, 200 y 400 ms; sin animaciones infinitas ni transiciones de ancho; `prefers-reduced-motion` lo apaga todo.
- **Lo que se ve, se puede usar con teclado.** Foco de 2 px, 44 px en pantallas táctiles, pestañas WAI-ARIA, diálogos nativos.

## Tokens

### Tema claro

| Token                                           | Valor                             | Uso                                          |
| ----------------------------------------------- | --------------------------------- | -------------------------------------------- |
| `--tinta` / `--texto`                           | `#14213D`                         | texto principal                              |
| `--tinta-2` / `--texto-secundario`              | `#3F4B63`                         | texto secundario                             |
| `--tinta-3`                                     | `#5E6880`                         | notas, folios, migas                         |
| `--fondo`                                       | `#F4F5F7`                         | área de trabajo                              |
| `--superficie` / `--superficie-2`               | `#FFFFFF` / `#F8F9FB`             | tarjetas y tablas / cabeceras                |
| `--lateral`                                     | `#ECEFF4`                         | menú lateral                                 |
| `--borde` / `--borde-fuerte`                    | `#DFE3EA` / `#C5CCD8`             | líneas finas / controles                     |
| `--primario`                                    | `#1D4ED8`                         | acción principal                             |
| `--exito`                                       | `#17694A` sobre `#E2F0E8`         | visto                                        |
| `--error`                                       | `#A3253A` sobre `#F8E6E9`         | cruz                                         |
| `--aviso`                                       | `#A3253A` sobre `#FDF6F7`         | atención (contorno y círculo abierto)        |
| `--pendiente`                                   | `#3E4C6B` sobre `#E7EBF3`         | pendiente, modo de prueba                    |
| `--desempate`                                   | `#00708A` sobre `#DDF0F5`         | medio círculo                                |
| `--foco`                                        | `#0089BA`                         | anillo de foco, 2 px                         |
| `--dif-facil` / `--dif-media` / `--dif-dificil` | `#009CD2` / `#1D4ED8` / `#0B2653` | escala de dificultad: más tinta, más difícil |

Se conservan los nombres que usaban las páginas (`--texto`, `--texto-secundario`, `--primario-oscuro`, `--menu-*`, `--texto-sm`…) como alias de los tokens nuevos.

### Tema oscuro (D4)

Sigue la preferencia del sistema y además hay un botón en la barra superior (sol y luna). La elección se guarda en `localStorage` (con `try/catch`) y se aplica como `data-tema` en `<html>` antes de dibujar. Sin elección manda `prefers-color-scheme`.

Fondo `#0D1422`, superficie `#131C2E`, tinta `#E7ECF5`, primario `#7FA2FF`, éxito `#5FD19B`, error y atención `#FF8A9B`, foco `#4CC3EE`. La pastilla «Publicada» usa tinta media (`#3F4B63`) para no ser lo más brillante de la pantalla.

### Contrastes medidos (WCAG, texto 4,5:1)

| Par                                            | Claro | Oscuro |
| ---------------------------------------------- | ----- | ------ |
| tinta / fondo                                  | 14,6  | 15,5   |
| tinta / superficie                             | 16,0  | 14,4   |
| tinta-2 / fondo                                | 8,0   | 9,7    |
| tinta-2 / lateral                              | 7,6   | 10,1   |
| tinta-3 / fondo                                | 5,1   | 6,5    |
| tinta-3 / lateral (títulos del menú)           | 4,8   | 6,7    |
| tinta-2 / `--superficie-2` (cabecera de tabla) | 5,3   | 5,6    |
| primario / superficie                          | 6,7   | 6,9    |
| texto sobre primario suave                     | 8,4   | 10,1   |
| visto (éxito sobre su fondo)                   | 5,7   | 7,6    |
| cruz (error sobre su fondo)                    | 6,1   | 7,1    |
| atención (en contorno)                         | 6,8   | 7,9    |
| pendiente                                      | 7,2   | 8,2    |
| desempate                                      | 4,8   | 7,8    |
| «PAES» del logo sobre el lateral               | 4,6   | 10,4   |
| contador del menú (dato)                       | 5,5   | 8,8    |
| contador que pide acción                       | 7,3   | 8,1    |
| «Publicada»                                    | 16,0  | 7,4    |

El foco (2 px, `#0089BA` claro y `#4CC3EE` oscuro) cumple 3:1 contra superficie y fondo como elemento no textual.

## Tipografía

- **Figtree** para toda la interfaz; títulos de página de 24 px en peso 700.
- **JetBrains Mono** (peso 500, D2) solo para datos: códigos de pregunta, folios, firmas, plazos, contadores y atajos. Respaldo: `ui-monospace`.
- **STIX Two Text** para fórmulas, citas, observaciones de revisores y el lema del ingreso.
- Cifras tabulares en tablas, indicadores y paginación.

## Marcas de estado

`.etiqueta.etiqueta--<estado>`: pastilla de radio 4 px con la marca dibujada como máscara (`--marca-visto`, `-anillo`, `-punto`, `-cruz`, `-medio`, `-raya`).

| Marca                                | Estados                                                      |
| ------------------------------------ | ------------------------------------------------------------ |
| Visto verde                          | aprobada, activa, completada, vigente, atendida, respondida  |
| Visto sobre tinta                    | publicada                                                    |
| Círculo abierto granate, en contorno | observada, en mora, vence pronto (`plazo`), confusa, vencida |
| Círculo abierto pizarra              | pendiente, modo de prueba (`prueba`), asignada               |
| Punto azul                           | en revisión, en curso, procesando                            |
| Cruz granate                         | rechazada, fallida, retirada, cancelada, anulada, inactiva   |
| Medio círculo cian                   | en desempate                                                 |
| Raya gris                            | borrador y todo lo neutro                                    |

Los errores de campo llevan la cruz y un texto que explica cómo corregir (`.campo__error`). Los avisos (`.aviso--*`) llevan ícono por forma y no usan borde izquierdo de color.

## Componentes compartidos (`src/componentes/`)

| Componente                                                                                                  | Qué hace                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DisenoGeneral`                                                                                             | «Saltar al contenido», menú, barra superior y `main#contenido` (`tabindex="-1"`, recibe el foco al navegar)                                                                                                                |
| `MenuLateral`                                                                                               | grupos y orden del DAS 7.4 desde `rutas/secciones.ts`; sección activa como hoja blanca con el visto del logo (se dibuja en 400 ms); contadores (D3); cajón en ≤ 900 px con `aria-expanded`, `inert` cerrado, Escape y velo |
| `BarraSuperior`                                                                                             | migas (rol › grupo › sección), buscador (Ctrl K), campana y botón de tema                                                                                                                                                  |
| `Pestanas`                                                                                                  | WAI-ARIA completo: `tablist`/`tab`/`tabpanel`, `aria-selected`, `tabindex` itinerante, flechas, Inicio y Fin; la línea se mueve solo con `transform`                                                                       |
| `DialogoConfirmacion`                                                                                       | `<dialog>` nativo; Cancelar con el foco inicial, Escape cancela; `peligro` pinta el botón en granate                                                                                                                       |
| `BuscadorGlobal`                                                                                            | Ctrl K: combobox y listbox con las secciones del rol y, para el administrador, preguntas por ID o texto                                                                                                                    |
| `AyudaAtajos`                                                                                               | tecla «?»: lista de los atajos que existen                                                                                                                                                                                 |
| `Campana`                                                                                                   | «Requiere atención» con los mismos contadores del menú; Escape o clic fuera la cierra                                                                                                                                      |
| `EstadoVacio`, `SegunCarga`, `Alerta`, `MensajeError`, `Paginacion`, `Selector`, `EncabezadoTabla`, `Icono` | estado vacío (visto grande en gris y una acción), cargando, errores, paginación y campos                                                                                                                                   |

Las tablas se apilan en ≤ 640 px; el hook `estado/etiquetas-de-tabla.ts` copia una sola vez el texto de cada cabecera a `data-th` de sus celdas.

## Movimiento

- 150 ms: hover, presionado, filas.
- 200 ms: entrada de cada vista (4 px), diálogos, campana.
- 400 ms: el visto del menú, el cajón del teléfono.
- Ninguna animación infinita (solo la ruedita de «cargando», con `currentColor`).

## Decisiones D1 a D5 (Nicolas, 14/11/2026)

- **D1.** Una sola mezcla global de dificultad (mínimo, objetivo y máximo; RN-09), editable en C09 Listas de opciones (HU-64). No hay mezcla por tipo de evaluación.
- **D2.** JetBrains Mono (peso 500) solo para datos.
- **D3.** Contadores del menú con los datos de la API: Mis revisiones, Desempates, Revisiones, Solicitudes de datos y Avisos de error (endpoint de conteo).
- **D4.** Tema oscuro por preferencia del sistema y con botón, recordado en este navegador.
- **D5.** Funciones fuera del DAS: Ctrl K, ayuda de atajos, campana con «Requiere atención». «Deshacer» se descartó (Nicolas, 14/11/2026). Lo que no está en el DAS se anota en `docs/planes/consola-rediseno-pendientes-documentacion.md`.

## Lo que se omitió a propósito

La maqueta usa datos de ejemplo; la consola manda. Se omitió lo que no tiene función real hoy: búsqueda, orden y selección masiva en el banco (la API no los ofrece; llegan con HU-53), reasignación de revisores (HU-28), cambio de rol en el menú y cifras en el ingreso, «Deshacer» y la mezcla de dificultad por tipo de evaluación.

## Datos que se agregaron a la API para el diseño

- **Variaciones del Panel:** `GET /admin/administracion/panel` entrega también `anterior`, el período de la misma duración justo antes. Estudiantes registrados y suscripciones vigentes se comparan con los que había al empezar el período; la aprobación de la IA, en puntos porcentuales. Sube es bueno (visto, verde) y baja es malo (cruz, granate); no hay otras cifras con otro sentido.
- **Fecha de asignación:** las revisiones y los desempates del docente traen `asignadoEn` (la columna `asignado_en` ya existía), para el folio del acta: «asignada el … · vence el …».

## Ajustes de la auditoría (14/11/2026)
- `--borde-control` (bordes de campos y alternativas, contraste ≥ 3:1) y `--sobre-sello` (texto sobre los sellos de prueba); los sellos tienen variante oscura.
- Pauta: barra fija con el enunciado, el avance y el límite de «No»; con más «No» que `max_no_para_aprobar` la opción «Aprobar» queda deshabilitada y se explica el motivo.
- Ingreso: hoja de acta con el logo y «SuperaPAES»; sin lema.
