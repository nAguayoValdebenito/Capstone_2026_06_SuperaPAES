# Diseño de la app (guía para construir pantallas)

Esta guía es para todo el equipo y para el asistente de código que use cada uno. **Antes de crear o
cambiar una pantalla de la app, léela y abre el boceto de esa pantalla en Figma.** El sistema de
diseño es el del prototipo v3 (DAS 7.2 y 7.5) y ya está en el código:

- `lib/nucleo/tema.dart`: `TemaSuperaPaes`, con los colores, las medidas, los estilos de texto y
  el `ThemeData` (campos, botones, casillas y barra inferior).
- `lib/presentacion/comunes/componentes.dart`: los componentes de los bocetos.
- `lib/presentacion/verificar_correo/campo_codigo.dart`: el campo del código de 6 dígitos.

## Reglas

1. **Compara siempre con el boceto.** Busca la pantalla en la tabla de abajo, ábrela en Figma y
   respeta los textos, el orden, los estados (error, cargando, vacío) y las medidas. Si algo del
   boceto no se puede hacer, anótalo en el PR.
2. **Nada de colores, radios ni tamaños sueltos.** Usa `TemaSuperaPaes.<color>` y sus estilos de
   texto. No escribas `Color(0xFF…)`, `Colors.blue`, `fontSize: 15` ni `BorderRadius.circular(12)`
   en una pantalla. Si falta un valor, agrégalo a `tema.dart` con el nombre de la variable de Figma.
3. **Usa los componentes antes de crear otros.** Si un elemento se repite en dos pantallas y no
   existe, agrégalo a `componentes.dart`, con su prueba en `test/componentes_test.dart`.
4. **Sin barra superior.** Los bocetos no tienen `AppBar`. La pantalla parte con un `EnlaceVolver`
   (si se llega desde otra) y un `Encabezado`. Las pestañas de la barra inferior (Inicio, Practicar,
   Evaluaciones, Progreso y Perfil) tampoco llevan barra superior en sus bocetos. Inicio, Practicar y
   Perfil ya siguen su boceto; las demás usan `comunes/pantalla_base.dart`, que sí la tiene, porque
   todavía son de relleno («En construcción»). Al construir cada una según su boceto, deja de
   usar `PantallaBase`.
5. **Etiqueta arriba del campo**, no dentro: usa `CampoTexto` o `CampoContrasena`, no un
   `TextFormField` con `labelText`.
6. **Accesibilidad (RNF-12):** los pares de colores del tema ya cumplen contraste AA. Los botones
   de solo ícono llevan `tooltip`; el título va en `Encabezado`, que lo marca como encabezado. La
   pantalla debe aguantar letra grande sin desbordarse (usa `Wrap` en vez de `Row` para textos
   que pueden crecer).
7. **Pruebas:** como no hay `AppBar`, para saber en qué pantalla se está usa
   `rutaActual(contenedor)`, y para escribir en un campo usa `campo('Correo')`, los dos de
   `test/apoyo/app_de_prueba.dart`.

## Colores

| Nombre en el tema                                    | Valor                                                          | Uso                                                                                                                                                                                                                               |
| ---------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `primario`                                           | `#1D4ED8`                                                      | Botón principal, enlaces, foco, pestaña activa                                                                                                                                                                                    |
| `primarioSuave`                                      | `#E8EEFD`                                                      | Fondo de aviso informativo y de recuadros activos                                                                                                                                                                                 |
| `primarioOscuro`                                     | `#1E3A8A`                                                      | Texto sobre `primarioSuave`                                                                                                                                                                                                       |
| `texto`                                              | `#14213D`                                                      | Texto principal («tinta»)                                                                                                                                                                                                         |
| `textoSecundario`                                    | `#4B5563`                                                      | Bajadas, ayudas, íconos y pestañas inactivas                                                                                                                                                                                      |
| `fondo`                                              | `#F4F6FA`                                                      | Fondo de todas las pantallas                                                                                                                                                                                                      |
| `superficie`                                         | `#FFFFFF`                                                      | Campos, tarjetas y barra inferior                                                                                                                                                                                                 |
| `borde`                                              | `#DDE3EC`                                                      | Borde de tarjetas y separadores                                                                                                                                                                                                   |
| `bordeInput`                                         | `#C9D2DF`                                                      | Borde de campos, casillas y botón de contorno                                                                                                                                                                                     |
| `neutroSuave`                                        | `#EEF1F6`                                                      | Botón desactivado y aviso neutro                                                                                                                                                                                                  |
| `exito` / `exitoSuave` / `exitoTexto`                | `#15803D` / `#E7F6EC` / `#14532D`                              | Aviso de éxito                                                                                                                                                                                                                    |
| `error` / `errorSuave` / `errorTexto`                | `#B91C1C` / `#FDECEC` / `#7F1D1D`                              | Errores y aviso de error                                                                                                                                                                                                          |
| `aviso` / `avisoSuave` / `avisoBorde` / `avisoTexto` | `#B45309` / `#FFF4E5` / `#F5C77E` / `#7C2D12`                  | **En retiro.** El ámbar ya no es de la identidad: las pantallas que aún lo usan (reloj de A27, cupo de A12, Progreso, Historial) lo cambian por `Destacado` o por la paleta en sus fases (F3 a F6); el token sigue hasta entonces |
| `logoOscuro` / `logoCeleste`                         | `#0B2653` / `#009CD2`                                          | El logo, el trazo, la racha y el texto de `Destacado`                                                                                                                                                                             |
| `sobreMarcaSuave`                                    | `#FFFFFF` al 86 %                                              | Texto de apoyo sobre el degradado de «Hoy» (5,2:1 sobre `primario`)                                                                                                                                                               |
| `neutroFuerte`                                       | `#475569`                                                      | Ícono de la corrección sin acierto (6,7:1 sobre `neutroSuave`)                                                                                                                                                                    |
| `primarioMedio`                                      | `#6585E0`                                                      | Barras de las semanas pasadas (3,5:1 sobre blanco)                                                                                                                                                                                |
| `cuadricula` / `pasoCuadricula`                      | `#E3E8F1` / 22                                                 | Líneas del fondo de cuaderno (`FondoCuaderno`)                                                                                                                                                                                    |
| `destacador`                                         | `#009CD2` al 30 %                                              | Franja de `Destacado`                                                                                                                                                                                                             |
| `degradadoHoy` y `sombraMarca`                       | `primario` → `primarioOscuro`; `primario` al 18 %, blur 16, +8 | Solo la tarjeta «Hoy» de Inicio: es el único degradado de la app                                                                                                                                                                  |

Los **tonos de las cinco pruebas** viven en el `enum Prueba` de `tema.dart` (código, nombre, nombre
corto, `tono` y `fondo`); no se escriben en ninguna pantalla:

| Prueba                  | Tono      | Fondo     |
| ----------------------- | --------- | --------- |
| `Prueba.cl` (Lectora)   | `#0369A1` | `#E0F2FE` |
| `Prueba.m1`             | `#1D4ED8` | `#E8EEFD` |
| `Prueba.m2`             | `#4338CA` | `#EEF2FF` |
| `Prueba.hcs` (Historia) | `#1E40AF` | `#DBEAFE` |
| `Prueba.cie` (Ciencias) | `#0E7490` | `#E0F7FA` |

`Prueba.deCodigo('M1')` entrega la prueba de un código de la API; uno desconocido da `m1`.

Los `surfaceContainer*` del `ColorScheme` están fijados a `superficie` y `neutroSuave`, y el tema define
`dialogTheme` y `bottomSheetTheme` (fondo `superficie`, esquinas de `radioHoja`, asa), así que ningún
diálogo, menú u hoja toma el lila de `fromSeed`. La barra inferior deja `indicatorColor:
primarioSuave`; el indicador animado lo dibuja `BarraInferior` (fase 1).

## Texto

La fuente es Figtree (400, 600 y 700, empaquetadas en `assets/fuentes/`). En Figma los títulos
usan Figtree 800, que no está empaquetada: se ve con la más gruesa disponible.

| Estilo          | Tamaño y peso | Uso                                                   |
| --------------- | ------------- | ----------------------------------------------------- |
| `display`       | 44, 800       | Números grandes (puntaje, resultado)                  |
| `h1`            | 26, 800       | Título de la pantalla (va en `Encabezado`)            |
| `numero`        | 22, 800       | Cantidad de A13 y datos de A21 (Titulo/Número)        |
| `h2`            | 17, 700       | Título de sección o de tarjeta                        |
| `cuerpo`        | 15, 400       | Texto normal, bajadas y lo que se escribe en un campo |
| `cuerpoFuerte`  | 15, 600       | Texto normal destacado                                |
| `etiqueta`      | 14, 600       | Etiqueta de un campo y botones de texto               |
| `pequeno`       | 13, 400       | Ayudas, avisos y pies                                 |
| `pequenoFuerte` | 13, 600       | Enlaces dentro de un pie                              |
| `mini`          | 11, 700       | Etiquetas de la barra inferior                        |
| `botonGrande`   | 17, 700       | Botón de 52 (ya está en el tema)                      |
| `botonNormal`   | 14, 700       | Botón chico (ya está en `BotonChico`)                 |

Los colores van con `copyWith`, por ejemplo
`TemaSuperaPaes.pequeno.copyWith(color: TemaSuperaPaes.textoSecundario)`.

## Medidas

| Nombre                                                      | Valor                | Uso                                                                                |
| ----------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------- |
| `espacio4` a `espacio32`                                    | 4, 8, 12, 16, 24, 32 | Escala de espacios: márgenes y separaciones salen de aquí                          |
| `margenPantalla`                                            | 24                   | Margen a los lados (ya está en `PantallaFormulario`; en tablet crece para centrar) |
| `altoBoton`                                                 | 52                   | `FilledButton`, `OutlinedButton` y `BotonTexto`                                    |
| `altoBotonChico`                                            | 40                   | `BotonChico`                                                                       |
| `altoCampo`                                                 | 48                   | Campos de texto                                                                    |
| `radioBoton`                                                | 14                   | Botones de 52                                                                      |
| `radioBotonChico`                                           | 10                   | Botón chico                                                                        |
| `radioCampo`                                                | 14                   | Campos, avisos y casillas del código                                               |
| `radioTarjeta`                                              | 20                   | Tarjetas                                                                           |
| `altoChip` / `radioChip`                                    | 36 / 18              | Chips                                                                              |
| `altoEtiqueta`                                              | 24                   | Etiquetas (radio de la mitad)                                                      |
| `altoBarra`                                                 | 8                    | Barra del cupo de A12 (radio de la mitad)                                          |
| `altoSegmento` / `radioSegmento`                            | 40 / 10              | Opción del selector segmentado (A13); la barra mide 48                             |
| `botonRedondo`                                              | 44                   | Botones «–» y «+» de la cantidad (A13)                                             |
| `circuloLetra`                                              | 28                   | Círculo con la letra de cada alternativa (A17)                                     |
| `altoTextoLectura`                                          | 150                  | Alto máximo del texto de lectura en la pregunta (A20)                              |
| `altoAvance`                                                | 6                    | Barra del avance de la práctica (A17)                                              |
| `radioHoja`                                                 | 20                   | Esquinas de arriba de las hojas que suben desde abajo (A11 y A18)                  |
| `radioDato`                                                 | 10                   | Recuadros de un dato chico, como el acierto por dificultad (A35)                   |
| `altoBarraSemana` / `radioBarraSemana` / `anchoBarraSemana` | 88 / 6 / 40          | Barra más alta del avance semana a semana, su radio y su ancho (A35)               |
| `anilloResumen`                                             | 148                  | Diámetro del anillo del resumen de la práctica (A21)                               |
| `altoBarraReloj`                                            | 3                    | Barra del tiempo restante bajo el reloj (A27)                                      |

Entre los elementos de un formulario van 16 de separación; el diseño de referencia mide 390 × 844.

Desde el plan de mejora visual (tanda A, 03/11) hay **tres radios**: `radioGrande` 20 (tarjetas y
hojas), `radioMedio` 14 (botones, campos y avisos) y `radioChico` 10 (botón chico, datos y sellos).
También:

| Nombre                                           | Valor                           | Uso                                                                                                              |
| ------------------------------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `sombraSuave`                                    | sombra de `texto` al 6 %        | Lo que se toca (opciones, tarjetas de prueba de A12, `ListaDeFilas`). Lo que solo informa queda plano, con borde |
| `zonaTactil`                                     | 48                              | Zona mínima que responde al toque; usa `ZonaTactil` si lo que se ve es más chico                                 |
| `movimientoRapido` / `Normal` / `Lento`          | 150 / 200 / 400 ms              | Duración de las animaciones, siempre con `duracion(context, ...)`                                                |
| `movimientoFoco`                                 | 700 ms                          | El único momento de autor de una pantalla (anillo, conteo del puntaje)                                           |
| `curvaEntrada` / `curvaSalida`                   | `easeOutCubic` / `easeInCubic`  | Curvas de las animaciones                                                                                        |
| `curvaEnfasis` / `curvaLineal`                   | `emphasizedDecelerate` / lineal | Momentos de autor y transiciones de pantalla / esqueleto y barra del reloj                                       |
| `desplazamientoPantalla` / `desplazamientoLista` | 24 / 8 dp                       | Eje horizontal entre pantallas / entrada escalonada de una lista                                                 |
| `pasoEscalonado` / `topeEscalonado`              | 40 ms / 6                       | Entrada escalonada: 40 ms entre elementos y, desde el sexto, todos juntos                                        |
| `tabulares` y `tabular(estilo)`                  | `FontFeature.tabularFigures()`  | Todo número que cambia o cuenta (cupo, porcentaje, puntaje, reloj): conserva su ancho                            |
| `anchoFormulario` / `anchoLectura`               | 560 / 720                       | Ancho máximo del contenido en tablet (formularios y pantallas de lectura)                                        |
| `anchoTablet`                                    | 600                             | Lado corto desde el que el equipo es tablet; bajo eso, la app queda en vertical                                  |

**Movimiento:** solo se animan opacidad, escala, traslación y color, nunca el diseño de la página, y
toda duración pasa por `duracion(context, base, {conservarFundido})` (`comunes/movimiento.dart`), que
da cero si el teléfono pide reducir el movimiento; con `conservarFundido: true` queda un fundido de
150 ms (el que confirma lo que el estudiante eligió: chips, cambio de plan). Las animaciones de autor
(trazo, anillo, conteo, destellos) usan `sinAnimarMomentos(context)` y con movimiento reducido llegan
a su estado final **en el primer cuadro**. Cada controlador se libera en `dispose`; no se usan
`BackdropFilter`, sombras grandes en listas ni temporizadores sueltos (el retraso va dentro de la misma
animación con un `Interval`).

## Componentes

| Componente (en `componentes.dart`)                                                                                                                             | Para qué                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PantallaFormulario(hijos: [...], pie:)`                                                                                                                       | Estructura de la pantalla: sin barra superior, desplazable, márgenes de 24 y 16 entre hijos. El `pie` queda fijo abajo (el botón principal de A08 a A10). Con `alActualizar`, deslizar hacia abajo recarga (A12).                                                                                                                                                      |
| `PieConError(boton:, error:)`                                                                                                                                  | Pie fijo con el error del botón justo sobre él, para que siempre se vea.                                                                                                                                                                                                                                                                                               |
| `EnlaceVolver(texto:, destino:)`                                                                                                                               | «‹ Inicio». Vuelve atrás; si no hay historial, va a `destino`.                                                                                                                                                                                                                                                                                                         |
| `Encabezado(titulo:, bajada:)`                                                                                                                                 | Título `h1` y bajada gris. `bajadaRica` para partes en negrita; `centrado` para pantallas con logo.                                                                                                                                                                                                                                                                    |
| `CampoTexto(etiqueta:, controller:)`                                                                                                                           | Campo con etiqueta arriba, `pista`, `ayuda` abajo y validación.                                                                                                                                                                                                                                                                                                        |
| `CampoContrasena(etiqueta:, controller:)`                                                                                                                      | Igual, con el ojo para mostrarla.                                                                                                                                                                                                                                                                                                                                      |
| `CampoConEtiqueta(etiqueta:, child:)`                                                                                                                          | Para poner la etiqueta y la ayuda a otro control.                                                                                                                                                                                                                                                                                                                      |
| `CampoCodigo(controller:)` (en `verificar_correo/`)                                                                                                            | Código de 6 dígitos en casillas, con `error`.                                                                                                                                                                                                                                                                                                                          |
| `Aviso(tono:, texto:, destacado:)`                                                                                                                             | Hoja blanca con borde fino y el ícono en su tono (sin relleno pastel; el texto va en tinta). Tonos de `TonoAviso`: `info`, `aviso`, `error`, `exito`, `neutro` y `primario`; error y éxito llevan además su propio borde e ícono. Con `textoRico`, la negrita puede ir en medio (A09b).                                                                                |
| `Tarjeta(child:)`                                                                                                                                              | Recuadro blanco con borde, radio 16 y relleno 16.                                                                                                                                                                                                                                                                                                                      |
| `BotonChico(texto:, onPressed:)`                                                                                                                               | Botón de 40 dentro de un aviso o de una fila.                                                                                                                                                                                                                                                                                                                          |
| `IconoEnCirculo(icono:, color:)`                                                                                                                               | Ícono suelto (sin círculo) de 32 en una zona de 48 sobre el título: el basurero de A42 y el reloj de A29.                                                                                                                                                                                                                                                              |
| `BotonTexto(child:, onPressed:)`                                                                                                                               | Botón de texto a lo ancho, como «Reenviar enlace».                                                                                                                                                                                                                                                                                                                     |
| `CargandoEnBoton()`                                                                                                                                            | Indicador dentro de un botón mientras se envía. **En retiro:** lo reemplaza `BotonPrincipal(estado: EstadoBoton.cargando)` a medida que cada pantalla se porta (F2 a F6); queda solo en botones que no son el principal.                                                                                                                                               |
| `PieConEnlace(pregunta:, enlace:, onPressed:)`                                                                                                                 | «¿No tienes cuenta? **Crea una**».                                                                                                                                                                                                                                                                                                                                     |
| `DatoResumen(valor:, texto:)`                                                                                                                                  | Número grande con su texto debajo, en un tercio de una `Row` («15 correctas» de A21 y A30).                                                                                                                                                                                                                                                                            |
| `AlternativaCorregidaVista(...)` y `ExplicacionCorreccion(...)` (en `correccion/partes_correccion.dart`)                                                       | Alternativa ya corregida y la tarjeta «Explicación» con «Por qué la B no es correcta» (A19 y A33).                                                                                                                                                                                                                                                                     |
| `HojaConfirmacion(titulo:, contenido:, confirmar:, cancelar:, confirmarEsPrincipal:, icono:)` y `confirmarEnHoja(context, hoja)` (en `hoja_confirmacion.dart`) | Hoja que sube desde abajo, sobre el teléfono completo y la barra inferior (`mostrarHoja` usa `useRootNavigator`), con un botón que confirma y otro que vuelve (A18, A41); devuelve `true` si confirma. Con `confirmarEsPrincipal: false` (terminar una práctica), el botón lleno es «Seguir practicando». El fondo, las esquinas y el asa salen de `bottomSheetTheme`. |
| `ErrorConReintento(error:, mensaje:, alReintentar:)` (en `error_con_reintento.dart`)                                                                           | Lo que no se pudo cargar, con «Reintentar» (Progreso, A41). Se ve como `EstadoError`.                                                                                                                                                                                                                                                                                  |

Identidad y estados (tanda A del plan de mejora visual, 03/11):

| Componente                                                                                                                               | Para qué                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SelloPrueba(Prueba.m1, tamano:, sobreMarca:)` (en `sello_prueba.dart`)                                                                  | Sello de cada prueba: su glifo en su tono sobre su fondo suave; con `sobreMarca`, sobre el degradado de «Hoy». Úsalo junto al nombre de la prueba.                                                                                                                                                                                  |
| `GlifoPrueba(prueba, tamano:, color:)` e `IconoPestana(indice, color:, activa:)` (en `glifos.dart`)                                      | Los cinco glifos de prueba y los cinco de pestaña, dibujados con `CustomPainter` con el trazo redondeado del logo. Reemplazan a los `Icons.*` de los sellos y de la barra inferior.                                                                                                                                                 |
| `ChipPrueba(prueba:, seleccionado:, onTap:)` y `ChipsDePrueba(pruebas:, seleccionada:, onChanged:)` (en `sello_prueba.dart`)             | Chip con el sello de la prueba; el elegido toma el fondo y el borde de su tono y suma un ✓ (no depende solo del color). Zona de 48 y fundido de 150 ms que se conserva con movimiento reducido.                                                                                                                                     |
| `FilaEje(nombre:, valor:, indice:)` y `nivelDeEje(valor)` (en `ejes.dart`)                                                               | Un eje con su nivel («Firme» ✓, «En camino» ↗, «Reforzar» ⚑ con destacador; RN-14), su porcentaje tabular y su barra, que se llena escalonada.                                                                                                                                                                                      |
| `Trazo(ancho:, color:, avance:)`, `TrazoAnimado(hasta:, retraso:)`, `SimboloLogo(ancho:, avance:)` y `PintorTrazoLogo` (en `trazo.dart`) | El trazo que sube del logo, dibujado con código: el símbolo de vacíos, errores y logros. `avance` de 0 a 1 lo dibuja en parte; `TrazoAnimado` se dibuja solo al aparecer (completo con movimiento reducido). `SimboloLogo` es el símbolo del logo (`simbolo_sin_trazo.png`) con el trazo celeste dibujado encima, para la apertura. |
| `GrupoEsqueleto(child:, quieto:)` y `Bloque(ancho:, alto:, radio:)` (en `estados.dart`)                                                  | Carga con la forma de lo que viene. Un solo controlador por pantalla: todos los `Bloque` laten juntos y el lector dice «Cargando» una vez. `quieto` (sin conexión) o movimiento reducido dejan el gris fijo. `EsqueletoTarjeta(lineas:)` arma una tarjeta y crea su propio grupo solo si no hay uno encima.                         |
| `EstadoVacio(titulo:, texto:, accion:, alTocar:)` (en `estados.dart`)                                                                    | Lo que se muestra cuando no hay nada todavía, con el trazo y un botón opcional.                                                                                                                                                                                                                                                     |
| `EstadoError(error:, mensaje:, alReintentar:, titulo:)` (en `estados.dart`)                                                              | Lo que no se pudo cargar, en tono neutro, con el trazo a medio camino y «Reintentar». En depuración anota la causa de un error que no vino de la API.                                                                                                                                                                               |
| `AvisoServidor(child:)`                                                                                                                  | Sobre todas las pantallas, en la raíz de la app: si una respuesta tarda más de 5 s, avisa que el servidor está despertando (Render gratuito). Flota arriba, no mueve la pantalla y deja pasar los toques. No se usa a mano                                                                                                          |
| `ZonaTactil(onTap:, child:)` (en `componentes_seleccion.dart`)                                                                           | Lleva la zona de toque a 48 sin cambiar lo que se ve (chips y segmentos).                                                                                                                                                                                                                                                           |

Base de diseño y movimiento (fase 0 de la implementación de las maquetas, 06/11). Todo en
`comunes/`, con sus pruebas en `test/base_de_diseno_test.dart`:

| Componente                                                               | Para qué                                                                                                                                                                           | Con «reducir movimiento»         |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `FondoCuaderno(child:)` y `PantallaFormulario`                           | Cuadrícula estática (un `RepaintBoundary` que se pinta una vez) detrás de toda `PantallaFormulario`. Con letra de 1,5 o más, el `pie` fijo pasa al final del contenido desplazable | Igual                            |
| `Destacado(texto:, icono:)`                                              | Franja celeste al 30 % bajo el texto: lo que pide atención («Reforzar», «Sin verificar», «Tu racha subió»). Reemplaza al ámbar                                                     | Igual                            |
| `LineaDatos(datos: [('8', 'correctas'), …])`                             | Los datos de apoyo en una línea, con cifras tabulares; pasa a la siguiente sin partir un dato. Reemplaza las fichas iguales                                                        | Igual                            |
| `Presionable(onTap:, child:)`                                            | Escala 0,98 en 100 ms (vuelve en 150) con ondulación                                                                                                                               | Solo la ondulación               |
| `AparecerEscalonado(indice:, child:)`                                    | Fundido + 8 dp, 200 ms, 40 ms entre elementos, tope de 6; solo la primera carga (`activo`)                                                                                         | Todo junto, ya visible           |
| `BarraAnimada(valor:, retraso:, etiquetaSemantica:)`                     | Barra de 400 ms sobre un riel visible; si el valor cambia sigue desde donde estaba                                                                                                 | Barra final                      |
| `ContadorAnimado(valor:, estilo:, sufijo:, miles:)`                      | Número que cuenta (700 ms) con cifras tabulares y `FittedBox` (no se parte a 2,0); el lector oye solo el final                                                                     | Número final                     |
| `AnilloAvance(valor:, centro:, destellos:)`                              | Anillo de 148 que se llena en 700 ms; con `destellos`, 8 chispas al terminar (una vez)                                                                                             | Anillo lleno, sin destellos      |
| `Sacudida(veces:, child:)`                                               | 4 dp en 300 ms al fallar (sube `veces`)                                                                                                                                            | Sin sacudida                     |
| `Cambiante(clave:, child:)`                                              | Fundido de 200 ms + 15 % hacia arriba al cambiar un texto o bloque                                                                                                                 | Fundido de 150 ms                |
| `MarcaRacha(encender:)`                                                  | El trazo del logo como marca de la racha; crece con la letra                                                                                                                       | Trazo completo                   |
| `BotonPrincipal(texto:, onPressed:, estado:, error:, intentosFallidos:)` | El `FilledButton` principal con estados `EstadoBoton.normal`, `cargando` (sigue azul, rueda blanca, no se apaga), `exito` (✓ verde) y `error` (texto encima y sacudida)            | Corte entre estados              |
| `LogoAcceso()`                                                           | Logo oficial de los formularios de acceso: entrada de escala 0,96 a 1 en 400 ms, con espacio fijo de 146 × 120; espera a que termine la apertura inicial                           | Escala final en el primer cuadro |

Mientras cada pantalla no se porte a sus componentes nuevos (fases 1 a 6) conviven con los
anteriores; al portarla se borra el anterior.

Los mensajes de error que ve el estudiante no dicen «API»: «Sin conexión por ahora. Revisa tu internet e
inténtalo de nuevo.», «Tuvimos un problema. Inténtalo en un rato.» y «No recibimos … Inténtalo de nuevo.».
En las pruebas, `test/tamanos_test.dart` recorre todas las pantallas en 360 × 640 y 768 × 1024 con la
letra a 1 y a 2: una pantalla nueva entra sola al recorrido al agregarla a `secciones.dart`.

En `comunes/componentes_seleccion.dart`:

| Componente                                                                        | Para qué                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OpcionRadio(texto:, seleccionada:, onTap:, detalle:)`                            | Opción con radio, una entre varias (cursos de A08). `detalle` va gris debajo (el contenido elegido en A13).                                                                                                |
| `SelectorSegmentado(opciones:, seleccionado:, onChanged:)`                        | Una opción entre pocas, a lo ancho (dificultad de A13).                                                                                                                                                    |
| `OpcionAlternativa(letra:, texto:, seleccionada:, onTap:, resultado:, etiqueta:)` | Alternativa de una pregunta con su letra en un círculo (A17 a A20). Su texto admite fórmulas e imágenes. Corregida (A19), `resultado` la pinta verde o roja y `etiqueta` dice «Tu respuesta» o «Correcta». |

En `comunes/formato_pregunta_vista.dart` (HU-34.2):

| Componente                            | Para qué                                                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TextoConFormulas(texto, estilo:)`    | Todo texto de una pregunta (enunciado, alternativa, explicación, texto de lectura): Markdown con fórmulas `$…$` y `$$…$$` en LaTeX e imágenes `![alt](url)`. |
| `ImagenAmpliable(url:, alternativo:)` | Imagen que se toca para verla en pantalla completa y agrandarla.                                                                                             |

No muestres el texto de una pregunta con `Text`: usa `TextoConFormulas`, o las fórmulas se verán como
`$\frac{x}{2}$`.
| `TarjetaCasilla(titulo:, marcada:, onTap:, detalle:, etiqueta:)` | Tarjeta con casilla (pruebas de A10). |
| `ChipSeleccion(texto:, seleccionado:, onTap:)` y `GrupoChips(chips:)` | Chips Normal y Activo, que pasan a la línea siguiente (A09 y A10). |
| `Etiqueta(texto:, tono:, icono:)` | Ícono y texto en su tono, sin píldora pastel: «Sugerida» (`TonoEtiqueta.primario`), «Sin verificar» (`aviso`, va con `Destacado`), «Correcta» o «Rendido» (`exito`, con ✓) y «Tu respuesta» fallada (`error`, con ✕). |
| `IndicadorPasos(paso:, total:, opcional:, accion:)` | «Paso 2 de 3 · Opcional» con su barra y «Omitir». |
| `FilaDato(etiqueta:, valor:)` | «Curso · 3° medio» dentro de una tarjeta (A37). Una etiqueta larga baja de línea y ocupa a lo más la mitad. |
| `FilaNavegacion(texto:, onTap:, detalle:, icono:, peligro:)` y `ListaDeFilas(filas:)` | Filas con «›» separadas por una línea (A37). Con `icono` y `detalle`, como las opciones de A22. Con `peligro`, el título y el ícono van en rojo («Borrar mi cuenta» en A39). El ícono va suelto, en azul, sin círculo. `ListaDeFilas` es una lista plana con borde, sin sombra. |

Los botones grandes no necesitan estilo propio: `FilledButton` (principal) y `OutlinedButton`
(contorno, como «Cerrar sesión») ya salen con 52 de alto, a lo ancho y con radio 14. Las casillas
son `Checkbox`. En teléfono, la barra es `BarraInferior`; en tablet se conserva `NavigationBar`.
Las pestañas y las pantallas siguen declaradas en `secciones.dart`. Los íconos son los de
Material (`Icons.…_rounded` o `_outlined`) en vez de los SVG de Figma, salvo los glifos de las pruebas y
de las pestañas, que son propios (`glifos.dart`).

## Íconos nativos (F2.1)

Los íconos usan los recursos aprobados `icono_ios_1024.png` e
`icono_android_frente_432.png` de la maqueta, sin dependencias adicionales.

- **Android:** `mipmap-anydpi-v26/ic_launcher.xml` define el ícono adaptativo con
  fondo blanco (`fondo_icono_launcher`) y el símbolo centrado del frente original.
  `ic_launcher_foreground.png` tiene un lienzo de 108 dp: 108, 162, 216, 324 y
  432 px según la densidad. Un margen nativo de 7 % por lado mantiene también las
  puntas del libro dentro de la zona segura circular de 66 dp, sin recortar el PNG.
  Los cinco `ic_launcher.png` de respaldo también usan la marca. El manifiesto
  apunta al mismo recurso para `icon` y `roundIcon`; el lanzador aplica su máscara.
- **iOS:** `AppIcon.appiconset` conserva su catálogo y sus nombres; todos los PNG
  tienen el tamaño requerido por `Contents.json`, fondo blanco opaco y formato RGB
  sin canal alfa. La imagen de App Store mide 1024 × 1024 px. Las esquinas las aplica
  el sistema, no la imagen.

## Apertura nativa (F2.2)

La apertura muestra únicamente el libro y el birrete de
`assets/imagenes/simbolo_sin_trazo.png` (590 × 564, transparente). Es el mismo recurso
de la maqueta y de `SimboloLogo`: el trazo celeste se dibujará en Flutter en F2.3.
El fondo nativo es `#F4F6FA`, equivalente a `TemaSuperaPaes.fondo`, tanto en modo claro
como oscuro. No se agregan dependencias ni esperas nativas.

El símbolo queda centrado en la ventana, en una caja de 160 × 153 dp/pt. Este es el
contrato de posición y tamaño para la pantalla de carga Flutter; el alto redondea la
proporción original del símbolo al ancho 160 de `SimboloLogo`.

| Plataforma            | Recursos                                                                                                                                                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Android 8–11          | `drawable/launch_background.xml` y su variante `drawable-v21` usan `fondo_apertura` y el símbolo centrado con las dimensiones de `dimensiones_apertura.xml`.                                                                                                                                                                   |
| Android 12 o superior | `values-v31/styles.xml` y `values-night-v31/styles.xml` asignan el fondo con `windowSplashScreenBackground` y el símbolo estático con `windowSplashScreenAnimatedIcon`. El PNG tiene un lienzo transparente de 288 dp y el mismo símbolo de 160 × 153 dp dentro, protegido frente a la máscara circular de 192 dp del sistema. |
| iOS                   | `LaunchScreen.storyboard` centra `LaunchImage` con restricciones de 160 × 153 pt y `scaleAspectFit`; el catálogo aporta los PNG transparentes 1x, 2x y 3x.                                                                                                                                                                     |

Los PNG de Android tienen variantes mdpi, hdpi, xhdpi, xxhdpi y xxxhdpi. Los temas
`NormalTheme` mantienen el mismo fondo mientras Flutter prepara su primer cuadro.
La pantalla de carga, su animación, la espera por sesión y el fundido al destino
se describen en F2.3; F2.2 configura la apertura nativa estática.

## Apertura Flutter (F2.3)

`AperturaApp`, en `presentacion/apertura/`, cubre una sola vez el arranque de la app.
Usa `PantallaCargando` con `SimboloLogo`, centrado en la ventana y con el ancho de
160 de la apertura nativa. La línea de espera se coloca debajo sin mover el símbolo.
El fondo es `TemaSuperaPaes.fondo`; el símbolo usa el PNG sin trazo existente y el
trazo se dibuja con `PintorTrazoLogo`.

| Momento                | Comportamiento                                                                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entrada                | Trazo de 400 ms y pausa de 250 ms, en una misma animación de 650 ms.                                                                                                 |
| Destino listo          | Se revela mediante un fundido de 300 ms. No se fuerza otra espera si la lectura tardó más que la entrada.                                                            |
| Lectura superior a 1 s | Una línea fina indica la espera, sin rueda ni porcentaje inventado. Se mantiene el símbolo completo.                                                                 |
| Movimiento reducido    | Símbolo completo en el primer cuadro y cambio directo al estar listo; la línea de espera es estática. También se respeta activar la preferencia durante la apertura. |

La apertura observa los providers existentes de sesión y perfil. El enrutador sigue
decidiendo entre ingreso, Inicio y perfil inicial; se conserva la dirección que
esté preparando, sin reiniciar el navegador ni cambiar las reglas de redirección.
Se espera la lectura inicial del perfil para evitar mostrar Inicio antes del paso
de perfil que corresponda. Los errores conservan el tratamiento existente de las rutas.

Mientras la apertura está visible, el destino no recibe toques, foco ni semántica.
`AmbitoApertura` evita una segunda transición de ruta debajo del fundido inicial;
después se conservan los movimientos de F1. Al cerrar o renovar sesión no se repite
la apertura. Los dos controladores y el temporizador del umbral se liberan al desmontar.

Los valores viven en `TemaSuperaPaes`: `anchoSimboloApertura` (160),
`altoSimboloApertura` (153), `grosorLineaApertura` (2), `pausaApertura` (250 ms),
`fundidoApertura` (300 ms) y `umbralEsperaApertura` (1 s). El trazo reutiliza
`movimientoLento` (400 ms). Todas las duraciones animadas pasan por `duracion`.

`test/apertura_test.dart` cubre los tiempos, sesión rápida y lenta, ausencia de sesión,
error del almacén, espera por perfil incompleto, dirección pública, movimiento reducido,
centrado con letra a 2,0 en teléfono y tablet, cierre de sesión y desmontaje anticipado.

## Ingreso y sesión vencida (F2.4)

A03 usa `LogoAcceso` y `BotonPrincipal`. La entrada del logo comienza cuando la
apertura inicial deja de cubrir el formulario. No cambia el espacio del logo ni
se repite al corregir un campo. Con movimiento reducido se ve completo desde el
primer cuadro, incluso si se activa la preferencia mientras está entrando.

El botón conserva el azul al enviar, bloquea envíos repetidos y muestra la marca
de éxito durante 600 ms antes de guardar la sesión y continuar con la navegación
existente. Esta confirmación usa un controlador cancelable; con movimiento reducido
no espera. Durante el envío y la confirmación los campos y enlaces quedan bloqueados.
Los errores generales de la API aparecen una sola vez sobre el botón; los errores
por campo mantienen su lugar. Cada intento fallido actualiza la sacudida existente,
que se omite al reducir movimiento. Corregir un campo restablece el estado normal.

Cuando el interceptor intenta renovar y la API responde 401, `EstadoSesion` mantiene
su cierre local existente y activa `avisoSesionVencidaProvider`, un estado de
presentación solo en memoria. A03 muestra el aviso con región semántica activa:

> Tu sesión terminó. Vuelve a entrar para seguir.

El aviso se limpia al abrir una sesión nueva, al cerrar voluntariamente o al borrar
la cuenta. No se activa por una contraseña incorrecta ni por una renovación sin
conexión; esta última conserva la sesión, como antes. No cambia el interceptor,
el almacenamiento seguro, los contratos ni las redirecciones.

Las medidas nuevas están en `TemaSuperaPaes`: `anchoLogoAcceso` (146),
`altoLogoAcceso` (120), `escalaEntradaLogoAcceso` (0,96) y `confirmacionAcceso`
(600 ms). La entrada reutiliza `movimientoLento` y todas las duraciones animadas
pasan por `duracion`. A01 los adopta en F2.5 y A04 en F2.6.

`ingreso_diseno_test.dart` verifica el logo, la espera por la apertura, los estados
del botón, envíos repetidos, errores de credenciales, aviso a través del interceptor,
limpieza tras ingresar, cierre voluntario, falta de conexión, letra a 2,0,
movimiento reducido y desmontaje durante la confirmación. Las pruebas previas de
sesión, apertura y tamaños se conservan.

## Crear cuenta (F2.5)

A01 usa `LogoAcceso` y los cuatro estados de `BotonPrincipal`. Conserva el formulario,
las validaciones locales y de la API, el código de invitación opcional y la salida a
Verificar correo. El envío se protege contra duplicados; campos, casilla y enlaces
quedan bloqueados al enviar y confirmar. El éxito se muestra durante 600 ms antes de
guardar la sesión, sin espera con movimiento reducido. El controlador se cancela al
desmontar, como en A03.

`RequisitosContrasena` actualiza sus marcas al editar la contraseña o el correo:

- Largo de 8 a 72 caracteres, contando caracteres Unicode como el validador existente.
- Distinta del correo, con su misma normalización de espacios y mayúsculas.
- Contraseña no común: queda pendiente hasta que la API acepta el registro; un rechazo
  por `contrasena_comun` la marca como no cumplida. Editarla vuelve a dejarla pendiente.

Las marcas usan ícono, color y estado semántico; no duplican la lista de contraseñas
comunes ni el control de bytes de la API. La ayuda bajo el campo conserva la copia
de DOC-06: «De 8 a 72 caracteres. No uses una contraseña común ni tu correo.».

La casilla conserva los nombres y las versiones de los documentos vigentes obtenidos
por el provider. Si ambos comparten versión, la copia de DOC-06 se presenta como:

> Acepto los Términos y condiciones y la Política de privacidad (versión 1.0) y declaro tener 14 años o más.

`1.0` es solo el ejemplo de DOC-06: no está fijado en el código. Si las versiones son
distintas se muestra la de cada documento junto a su nombre. Los dos enlaces siguen
abriendo los textos vigentes. Si la API indica que los documentos cambiaron, se recargan
y se vuelve a exigir aceptación; se envían los identificadores de las nuevas versiones.

Cuando falta aceptar, la casilla tiene borde y marca de error, una sacudida por intento
y un mensaje con región semántica activa. La sacudida se omite con movimiento reducido.
La casilla y el texto conservan una zona de toque mínima de 48 dp. Aceptar elimina el
error visual sin enviar automáticamente el registro. Se reutilizan los tokens del tema.

`registro_diseno_test.dart` cubre marcas, Unicode y correo, autoridad de la API sobre
contraseñas comunes, error y movimiento de la casilla, tamaño de toque, versiones
distintas y cambiantes, enlaces, registro pendiente y duplicados, desmontaje y letra
a 2,0 con y sin movimiento reducido. `registro_test.dart` mantiene sus casos; la
expectativa de la casilla se actualiza a la copia exacta de DOC-06.

## Recuperar contraseña (F2.6)

A04 usa `LogoAcceso` y `BotonPrincipal` con los estados normal, cargando, éxito y
error. Conserva el correo, su validación, el enlace de vuelta al ingreso y la llamada
pública existente de recuperación; la contraseña nueva sigue definiéndose en A05.

Al aceptar la API la solicitud, el botón confirma éxito durante 600 ms y muestra el
estado de correo enviado con el texto genérico existente: «Si [correo] está registrado,
te llegará un enlace…». La pantalla no determina ni revela si existe esa cuenta.
La confirmación es una región semántica activa y mantiene la explicación de un solo
uso, vencimiento y sustitución del enlace anterior.

El botón principal pasa de «Enviar enlace» a «Reenviar enlace» y pide otro al mismo
correo confirmado. Durante cualquiera de las solicitudes y su confirmación se bloquean
los envíos repetidos y la edición del correo. El reenvío usa el mismo contrato: no
se agrega una espera ni un límite local; los errores y límites de la API se muestran.

Editar un correo distinto limpia la confirmación anterior y vuelve al envío inicial.
Un error de reenvío conserva el correo confirmado para reintentar. Los errores de
campo quedan bajo el correo y los generales aparecen una sola vez sobre el botón.
Con movimiento reducido el logo aparece completo y no hay espera de confirmación;
también se respeta activar la preferencia durante el éxito. El controlador se libera
al desmontar y las respuestas tardías no actualizan la pantalla descartada.

Se reutilizan los tokens y componentes de F2.4; no se agregan dependencias, rutas,
parámetros de negocio ni cambios en la API o la sesión.
`recuperacion_diseno_test.dart` cubre estados, duplicados, correo normalizado, envío
y reenvío pendientes, errores de campo, desconexión y 429, reintento, cambio de correo,
letra 2,0, movimiento reducido y desmontaje. Los casos de `recuperacion_test.dart`
se mantienen; su selector de reenvío adopta el botón principal.

## Perfil inicial (F2.7)

A08–A10 mantienen el borrador, los catálogos, las sugerencias y el contrato de
guardado existentes. `IndicadorPasos` llena cada segmento con `BarraAnimada`;
los segmentos de los pasos anteriores ya aparecen completos. Los pasos usan
la transición horizontal de F1 (24 dp, entrada de 400 ms y salida de 280 ms),
incluido volver conservando la selección. Con movimiento reducido queda el
fundido de 150 ms y las barras aparecen completas; activar la preferencia
durante el avance termina la animación.

Las opciones de curso usan `OpcionRadio(conMovimiento: true)` y las áreas y
electivos, `ChipTexto`. Animan el color en 150 ms y dan vibración de selección.
Los chips conservan una zona táctil de al menos 48 y el estado semántico. Los
componentes anteriores siguen disponibles para las pantallas de otras fases.
El ancho del borde de las opciones animadas no cambia al seleccionar.

A09b anuncia el tope existente de tres áreas con una región semántica activa;
el aviso usa el tono informativo de la identidad. No cambia la selección al
intentar una cuarta área.

A10 identifica cada tarjeta por el código de prueba recibido: `TarjetaCasilla`
con `prueba:` usa su tono, fondo y `SelloPrueba`. Las sugerencias quedan bajo el
título para permitir letra grande. La prueba a reforzar usa `ChipPrueba`;
«Ninguna» usa `ChipTexto`. Se conservan el electivo de Ciencias, la preferencia
opcional y su limpieza si se desmarca esa prueba.

Los botones de los pasos usan `BotonPrincipal` y muestran carga y errores sin
duplicarlos. El guardado bloquea solicitudes repetidas y conserva el destino
existente: Inicio en la bienvenida, Perfil al editar y solo curso al corregir.

A11 mantiene la hoja sobre el navegador raíz, sin cierre por arrastre ni por
toque exterior. Muestra «¿Sigues en [curso]?», usando el curso de la API; para
egresados pregunta si ya egresaron. Conserva la explicación y los datos que
envía al confirmar o corregir. Es desplazable con letra 2,0; durante la petición
bloquea ambas acciones y al fallar permite reintentar. Un error tardío no
actualiza la hoja descartada.

`perfil_diseno_test.dart` cubre pasos, vibración, transiciones, tonos, sellos,
borrador al volver, refuerzo, guardado lento, reintento y A08b/A09b/A11 con letra
2,0, con y sin movimiento reducido. `componentes_test.dart` comprueba la
semántica de `ChipTexto` y activar movimiento reducido durante las barras.
Se conservan las aserciones de `perfil_test.dart`; su selector de refuerzo
adopta `ChipPrueba`. No se modifican API, modelo de datos, rutas ni dependencias.

## Revisión de la fase de arranque (F2.8)

`arranque_marca_integracion_test.dart` recorre los widgets de la app con los
repositorios de prueba, sin red: ingreso → registro → verificación pendiente →
perfil inicial → Inicio → cierre → nuevo ingreso. También cubre recuperación,
reenvío, regreso al ingreso, renovación rechazada, credenciales incorrectas y
reingreso que limpia el aviso. Ambos recorridos se prueban con letra 2,0, con y
sin movimiento reducido. Se comprueban la sesión guardada, las llamadas, la
aceptación legal, el perfil, la barra y que la apertura no se repita.

Si se activa movimiento reducido durante el éxito de A03 o A01, la espera se
termina sin cancelarla: la sesión aceptada todavía debe guardarse y continuar
al destino. Dos casos de regresión reproducían la pérdida de ese paso antes
de la corrección. Abandonar la pantalla conserva la cancelación por desmontaje
ya cubierta en las pruebas previas. No cambia el contrato ni el almacenamiento.

La validación automática incluye formato, análisis, suite completa, compilación
Android y revisión de los recursos nativos de íconos y apertura. Los recorridos
con repositorios de prueba y la validación de XML/PNG no reemplazan la revisión
manual en un dispositivo; compilar y verificar iOS requiere macOS.

## Inicio, Practicar y estados del estudiante (F3)

`estadoUsuarioProvider`, en `comunes/estado_usuario.dart`, deriva una sola
proyección de sesión, cupo, perfil y suscripción. Expone `cubre(pruebaId)`,
`cupoRestante`, bonos, `disponibles(pruebaId)`, `cantidadSugerida(pruebaId)` y
`enMora`. Disponible `null` significa sin límite; cero significa agotado.
La cobertura procede del servidor, no del nombre del plan ni de una fecha
calculada en el teléfono. Inicio, A13–A16, A22 y la cifra de la pregunta usan
esta proyección; no se copian cupos entre pantallas.

| Estado            | Presentación                                                       |
| ----------------- | ------------------------------------------------------------------ |
| G1: sin verificar | Cupo recibido, aviso de verificación y botón tonal.                |
| G2: verificado    | Cupo recibido y aviso de invitaciones.                             |
| G3: con bonos     | Cupo diario y saldo extra separados; práctica usa su suma.         |
| S1: una prueba    | La incluida no usa cupo; el contador corresponde a las demás.      |
| S2: todas         | «Practicas sin límite», sellos y ningún contador de cupo.          |
| S3: en mora       | Mantiene cobertura efectiva y muestra el aviso de cobro pendiente. |

Inicio usa `MarcaRacha` sin llama ni píldora; «Hoy» es el único bloque con
degradado, con sello blanco, botón blanco a la medida y trazo de fondo que se
omite desde letra 1,3. El cupo usa contador y barra animados. La grilla conserva
las pruebas del perfil, dos columnas con letra normal y una con letra grande;
«Reforzar» lleva `Destacado` y las cubiertas indican su inclusión. La entrada
escalonada ocurre solo en la primera carga visible, después de la apertura.
Recargar relee también la suscripción y usa `RefreshIndicator.adaptive`.

A13 no lleva «‹ Inicio». Sus chips usan `ChipPrueba`; la selección del segmento
se desliza y, con letra grande, se organiza en dos filas para conservar las
palabras enteras. El resumen de cantidad, prueba, alcance y dificultad cambia con
`Cambiante`. La cantidad usa cifras tabulares y se limita a las disponibles
para la prueba; el envío utiliza exactamente esa cantidad. Se conserva el rango
existente de prácticas de 5 a 20 y la validación final de la estructura en el
servidor. Si el cupo no alcanza el mínimo, se muestran las restantes y salidas
a actividades sin cupo o pruebas incluidas, sin enviar una cantidad inválida.

A14 muestra el acierto ponderado y «Conviene reforzar» cuando lo indica Progreso;
no calcula umbrales en el teléfono. A15 conserva las alternativas de la API y
añade el trazo de estado vacío. A16 usa una banda con sello y trazo y mantiene
sus datos reales. A22 añade la cuenta regresiva tabular a partir de `reiniciaEn`,
las pruebas cubiertas y acceso a diagnósticos. Los temporizadores se liberan.

Cargando se muestra `GrupoEsqueleto` con la forma de la pantalla; sin conexión,
el esqueleto queda quieto junto a `EstadoError` y «Reintentar». No se presentan
cupos ni porcentajes de ejemplo. El aviso global de servidor despertando sigue
activo. A07b compara las versiones vigentes y aceptadas ya disponibles en la API:
solo informa cambios menores, permite leerlos y descartar el aviso en memoria;
no acepta documentos ni resuelve cambios mayores por el estudiante.

La ampliación autorizada de `/suscripciones/actual` añade `alcance`,
`pruebasIncluidas` y `coberturaVigente`. El repositorio reutiliza la misma regla
de vigencia efectiva que `cubrePrueba`, con el reloj del servicio; no cambia
el esquema. La proyección de suscripción de Privacidad recibe los mismos campos.
La app no supone cobertura si una respuesta anterior no los contiene.

`inicio_estados_test.dart` cubre G1–S3, cambio de prueba y de suscripción, cupo
bajo, envío y pregunta coherentes, carga, desconexión, A07b y servidor despertando,
con letra 2,0 y movimiento reducido. Las pruebas anteriores conservan sus
validaciones: se desplazan hasta el contenido y usan chips con sello; para probar
el rango completo y preguntas de prácticas de diez, disponen de cupo suficiente
y comprueban la cifra correspondiente a esa cuenta. La prueba del segmento usa
la Figtree empaquetada y comprueba que las palabras no se partan con letra 2,0.

## Práctica, corrección y resumen (F4)

La rama `feat/practica-momentos` actualiza A17–A24 a partir de la maqueta
compilada y la especificación F4.

- La cabecera consulta `estadoUsuarioProvider` para el cupo y la cobertura.
  El total de preguntas procede de la práctica iniciada en el servidor: no se
  recalcula al consumir cupo. El sello acompaña a la prueba y el riel del progreso
  usa `borde`, con avance de 400 ms.
- Las alternativas de práctica activan `conMovimiento`: selección de 150 ms,
  pulso del círculo y vibración de selección. La correcta pulsa una vez; correcta
  y elegida conservan sus etiquetas e íconos. La respuesta correcta sigue llegando
  únicamente después de confirmar y recibir la corrección del servidor (RN-06).
- `FranjaCorreccion` muestra el acierto en verde con trazo y el error con birrete
  gris sobre fondo neutro. En el error, la explicación precede al enunciado.
  La lectura ocupa como máximo 150 dp y conserva «Ampliar texto».
- «Terminar» usa `HojaConfirmacion` sobre el navegador raíz. A23 permite elegir
  uno de los cuatro motivos de la maqueta; **el envío está pendiente** de conectar
  la API de reportes. El botón permanece deshabilitado y la hoja informa que el
  envío no está disponible. No se simulan confirmaciones.
- `MomentoResumen` usa el porcentaje del servidor en `AnilloAvance` y
  `ContadorAnimado`, ambos de 700 ms. Los destellos aparecen desde 70 %, una vez
  por resumen durante la sesión. Al reducir movimiento se muestran los valores
  finales, también si la opción cambia durante el conteo. La racha solo se anuncia
  cuando el dato real aumenta respecto al inicio de la práctica.
- A24 conserva la consulta del servidor y su límite de preguntas recientes
  (RN-04/RN-05); los grupos de errores incorporan el sello de la prueba.

Textos **por aprobar** (decisión 2 de la auditoría): «¡Bien! Era la {letra}.»,
«Era la {letra}. Mira cómo se resuelve. Tú marcaste la {letra}.»,
«¡Muy buena práctica! {correctas} de {contadas}.»,
«Vas en camino: {correctas} de {contadas}. Repasa las que fallaste y vuelve a
intentarlo.», «Tu racha subió a {días} días» y los motivos de A23. La frase de éxito
omite la cantidad de preguntas difíciles de la maqueta porque el resumen actual
no entrega ese desglose. El aviso provisional «El envío de avisos aún no está
disponible.» también queda por aprobar.

Las pruebas cubren acierto, error, 70 %, 40 %, cupo cambiante, racha, regreso al
resumen, letra 2,0, movimiento reducido y su activación durante una animación.
Las capturas de revisión se generan desde widgets con repositorios de prueba;
no representan una validación manual en dispositivo.

## Navegación persistente (F1)

`enrutador.dart` mantiene un navegador independiente por pestaña. La fuente de pantallas sigue
siendo `secciones.dart`; `rutas_navegacion.dart` declara su pestaña dueña y las excepciones sin barra.
No cambia ninguna dirección pública ni el control de sesión o de perfil inicial.

| Pestaña      | Pantallas secundarias existentes que conservan su barra                                         |
| ------------ | ----------------------------------------------------------------------------------------------- |
| Inicio       | Verificar correo, Cupo agotado y Repaso de errores                                              |
| Practicar    | Elegir alcance, Sin preguntas, Ofrecer diagnóstico y Resumen de práctica                        |
| Evaluaciones | Antes de empezar, Antes del ensayo, Resultado y Revisión                                        |
| Progreso     | Historial; conserva la dirección anterior `/evaluaciones/historial`                             |
| Perfil       | Mi suscripción, Planes, Invitaciones, Mis datos, Puntajes, Borrar cuenta, Términos y Privacidad |

La pestaña dueña queda seleccionada en sus pantallas secundarias. Tocar otra pestaña conserva la
pila y el estado de la anterior; tocar de nuevo la activa vuelve a su raíz con `goBranch` e
`initialLocation`. Las páginas fuera del shell se declaran en `rutasSinBarra`: carga y acceso,
los tres pasos del perfil inicial, pregunta y corrección de práctica, pregunta con reloj y mapa
para entregar. Al entrar a concentración se apila sobre el navegador raíz; la corrección y la
pregunta siguiente se reemplazan para no acumular respuestas en la pila.

**Planes compartidos:** `/planes` sigue siendo el enlace canónico de Perfil. `abrirPlanes(context)`
lo abre en la rama actual: desde Cupo usa `/inicio/planes` y desde Evaluaciones,
`/evaluaciones/planes`. Son variantes internas de la misma pantalla y los mismos providers;
volver regresa a la pantalla de origen. No agregan datos ni procesos de compra.

Términos y Privacidad mantienen `/terminos` y `/privacidad`, y se pueden abrir sin sesión. En ese
caso, o durante el perfil inicial, no se muestra la barra. Con sesión y perfil completo pertenecen
a Perfil. Las hojas usan `useRootNavigator: true` y cubren también la barra.

| Componente                                     | Presentación y accesibilidad                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BarraInferior`                                | Cinco destinos con `IconoPestana`, píldora que se traslada y pulso al cambiar. Expone etiqueta, acción y selección a lectores de pantalla. La letra se limita a 1,3 solo dentro de la barra, con una línea y `FittedBox`; el contenido de las pantallas conserva la escala completa del sistema. Sin movimiento, el indicador y el glifo aparecen en su estado final en el primer cuadro. |
| `ContenedorPestanas`                           | Fundido de 200 ms entre navegadores sin desmontarlos. Las ramas inactivas no reciben toques, foco, semántica ni ticks. Con movimiento reducido el cambio es inmediato.                                                                                                                                                                                                                    |
| `paginaConMovimiento` / `transicionDePantalla` | `CustomTransitionPage` con 24 dp horizontales, entrada de 400 ms y salida de 280 ms. Con movimiento reducido solo queda un fundido de 150 ms. En iPhone conserva el detector nativo del borde; durante el gesto normal la página sigue el dedo.                                                                                                                                           |

Los valores nuevos pertenecen a `TemaSuperaPaes`: `movimientoSalidaPantalla` (280 ms),
`altoBarraNavegacion` (72), `anchoIndicadorNavegacion` (64), `altoIndicadorNavegacion` (32),
`escalaLetraBarra` (1,3) y `escalaPulsoPestana` (1,08). La píldora usa `primarioSuave` y las etiquetas
usan `mini`. Android habilita `enableOnBackInvokedCallback` para el gesto predictivo de volver.

Las pruebas de F1 están en `navegacion_test.dart` y `barra_inferior_test.dart`: direcciones,
pestañas, pilas, Planes compartidos, concentración, sesión y perfil, hojas, letra a 2,0 y movimiento
reducido. `widget_test.dart` y `tamanos_test.dart` siguen recorriendo todas las pantallas actuales.
Las pantallas de fases posteriores que todavía no existen no se crean en F1.

Ejemplo, una pantalla con formulario:

```dart
return PantallaFormulario(
  hijos: [
    const EnlaceVolver(texto: 'Inicio', destino: Rutas.inicio),
    const Encabezado(titulo: 'Recupera tu contraseña', bajada: 'Te enviaremos un enlace.'),
    CampoTexto(etiqueta: 'Correo', controller: _correo, keyboardType: TextInputType.emailAddress),
    if (error != null) Aviso(tono: TonoAviso.error, texto: error),
    FilledButton(onPressed: _enviar, child: const Text('Enviar enlace')),
  ],
);
```

## Bocetos en Figma

Archivo del prototipo: <https://www.figma.com/design/Xd4L6RJ5MRudCuXt8PpINg>. Los componentes
están en la página «Componentes v3» (nodo `30:300`) y las pantallas en «App estudiante». Para abrir
una pantalla, agrega `?node-id=` con el nodo (cambiando `:` por `-`), por ejemplo
<https://www.figma.com/design/Xd4L6RJ5MRudCuXt8PpINg?node-id=32-356>.

| Pantalla | Boceto                                       | Nodo       | En el código                                                                                                                                                                                                                                                                                                                                                                                    |
| -------- | -------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01      | Crear cuenta                                 | `32:356`   | `crear_cuenta/`                                                                                                                                                                                                                                                                                                                                                                                 |
| A01b     | Crear cuenta, contraseña que no cumple       | `32:400`   | `crear_cuenta/`                                                                                                                                                                                                                                                                                                                                                                                 |
| A02      | Términos y condiciones                       | `32:454`   | `comunes/vista_documento_legal.dart`                                                                                                                                                                                                                                                                                                                                                            |
| A02b     | Política de privacidad                       | `32:497`   | `comunes/vista_documento_legal.dart`                                                                                                                                                                                                                                                                                                                                                            |
| A03      | Iniciar sesión                               | `32:537`   | `ingreso/`                                                                                                                                                                                                                                                                                                                                                                                      |
| A04      | Recuperar contraseña                         | `32:567`   | `recuperar_contrasena/`                                                                                                                                                                                                                                                                                                                                                                         |
| A05      | Nueva contraseña (página de la consola)      | `32:594`   | `consola/src/paginas/restablecer-contrasena/`                                                                                                                                                                                                                                                                                                                                                   |
| A06      | Verificar correo                             | `32:636`   | `verificar_correo/`                                                                                                                                                                                                                                                                                                                                                                             |
| A06b     | Verificar correo, código incorrecto          | `32:677`   | `verificar_correo/`                                                                                                                                                                                                                                                                                                                                                                             |
| A06c     | Verificar correo, código bloqueado           | `32:716`   | `verificar_correo/`                                                                                                                                                                                                                                                                                                                                                                             |
| A08      | Perfil, paso 1: tu curso                     | `32:871`   | `perfil_estudio/pantalla_paso_curso.dart`                                                                                                                                                                                                                                                                                                                                                       |
| A08b     | Paso 1, si ya egresó                         | `32:927`   | `perfil_estudio/pantalla_paso_curso.dart`                                                                                                                                                                                                                                                                                                                                                       |
| A09      | Perfil, paso 2: áreas de carrera             | `32:985`   | `perfil_estudio/pantalla_paso_areas.dart`                                                                                                                                                                                                                                                                                                                                                       |
| A09b     | Paso 2, tope de tres áreas                   | `32:1028`  | `perfil_estudio/pantalla_paso_areas.dart`                                                                                                                                                                                                                                                                                                                                                       |
| A10      | Perfil, paso 3: tus pruebas                  | `33:643`   | `perfil_estudio/pantalla_paso_pruebas.dart`                                                                                                                                                                                                                                                                                                                                                     |
| A11      | Confirmar el curso en marzo                  | `33:730`   | `perfil_estudio/hoja_confirmar_curso.dart`                                                                                                                                                                                                                                                                                                                                                      |
| A12      | Inicio                                       | `33:794`   | `inicio/`. **Cambia respecto del boceto por la tanda C del plan de mejora visual:** arriba, la tarjeta «Hoy» (`tarjeta_hoy.dart`), con lo que quedó sin terminar, el diagnóstico pendiente, la prueba a reforzar o la práctica libre; cupo compacto; racha amable; pruebas en grilla de dos columnas con su sello (una columna con letra desde 1,3). Sin «Repasar errores», que llega con HU-39 |
| A13      | Personalizar la práctica                     | `33:883`   | `practicar/pantalla_personalizar_practica.dart`                                                                                                                                                                                                                                                                                                                                                 |
| A14      | Elegir eje, contenido o habilidad            | `33:983`   | `practicar/pantalla_elegir_alcance.dart`                                                                                                                                                                                                                                                                                                                                                        |
| A15      | Sin preguntas suficientes                    | `33:1059`  | `practicar/pantalla_sin_preguntas.dart`                                                                                                                                                                                                                                                                                                                                                         |
| A16      | Ofrecer el diagnóstico                       | por anotar | `evaluaciones/pantalla_ofrecer_diagnostico.dart` (se abre al tocar «Empezar práctica» con el diagnóstico pendiente y desde A25)                                                                                                                                                                                                                                                                 |
| A17      | Pregunta de práctica                         | `33:1134`  | `pregunta/pantalla_pregunta.dart` (F4: incluye la hoja A23; envío pendiente de API)                                                                                                                                                                                                                                                                                                             |
| A18      | Confirmar respuesta                          | `33:1187`  | `pregunta/hoja_confirmar_respuesta.dart`                                                                                                                                                                                                                                                                                                                                                        |
| A19      | Corrección con explicación                   | `33:1243`  | `correccion/pantalla_correccion.dart`                                                                                                                                                                                                                                                                                                                                                           |
| A19b     | Corrección de una respuesta incorrecta       | `33:1299`  | `correccion/pantalla_correccion.dart`                                                                                                                                                                                                                                                                                                                                                           |
| A20      | Pregunta de Competencia Lectora              | `33:1355`  | `pregunta/texto_de_lectura.dart`                                                                                                                                                                                                                                                                                                                                                                |
| A22      | Cupo agotado                                 | `34:975`   | `cupo_agotado/pantalla_cupo_agotado.dart` («Suscríbete» sin precio hasta HU-43). Con los textos aprobados en el plan de mejora visual y una cuenta regresiva hasta el reinicio, con la hora que entrega la API                                                                                                                                                                                  |
| A21      | Resumen de la práctica                       | `33:1403`  | `practicar/pantalla_resumen_practica.dart` (sin «Ver la revisión», que llega con HU-61)                                                                                                                                                                                                                                                                                                         |
| A24      | Repasar errores                              | `34:1123`  | `repaso/pantalla_repaso.dart`. Sin el filtro «Todas» del boceto: cada repaso es de una prueba. La tarjeta de Inicio, `TarjetaRepaso` en `inicio/evaluacion_sin_terminar.dart`; las preguntas, las de la práctica                                                                                                                                                                                |
| A43      | Planes                                       | `36:1705`  | `planes/pantalla_planes.dart`. Elegir un plan avisa el modo de prueba: no hay compra                                                                                                                                                                                                                                                                                                            |
| A44      | Mi suscripción                               | `36:1799`  | `planes/pantalla_mi_suscripcion.dart`, con A46 (en mora) en la misma pantalla                                                                                                                                                                                                                                                                                                                   |
| A34      | Historial                                    | `35:1443`  | `resultado/pantalla_historial.dart`, con filtros, marcas y páginas; se abre desde Progreso y desde el resultado                                                                                                                                                                                                                                                                                 |
| A25      | Evaluaciones                                 | por anotar | `evaluaciones/pantalla_evaluaciones.dart` y `tarjetas_evaluaciones.dart`                                                                                                                                                                                                                                                                                                                        |
| A26      | Antes de empezar                             | por anotar | `evaluaciones/pantalla_antes_de_empezar.dart`; la del ensayo completo, sin boceto propio, en `pantalla_antes_del_ensayo.dart` (las condiciones comunes en `condiciones_evaluacion.dart`)                                                                                                                                                                                                        |
| A27      | Pregunta con reloj                           | por anotar | `evaluaciones/pantalla_pregunta_con_reloj.dart` (el reloj en `cabecera_con_reloj.dart`; sin el eje de la pregunta, que la API no entrega)                                                                                                                                                                                                                                                       |
| A28      | Ver todas y entregar                         | por anotar | `evaluaciones/pantalla_ver_todas.dart`                                                                                                                                                                                                                                                                                                                                                          |
| A29      | Retomar una evaluación                       | por anotar | `inicio/hoja_retomar_evaluacion.dart` («Continuar» abre A27 y «Entregar ahora», A28)                                                                                                                                                                                                                                                                                                            |
| A30      | Resultado de mini-ensayo                     | por anotar | `resultado/pantalla_resultado.dart` (sin «Ir al historial», que llega con HU-62)                                                                                                                                                                                                                                                                                                                |
| A31      | Resultado del diagnóstico                    | por anotar | `resultado/pantalla_resultado.dart` y `partes_diagnostico.dart` (con «Diagnóstico · Entregado» en vez del año)                                                                                                                                                                                                                                                                                  |
| A32      | Resultado de ensayo completo                 | por anotar | `resultado/pantalla_resultado.dart` (el puntaje con el año y el proceso de la tabla)                                                                                                                                                                                                                                                                                                            |
| A32b     | Ensayo sin tabla de conversión               | por anotar | `resultado/pantalla_resultado.dart`                                                                                                                                                                                                                                                                                                                                                             |
| A33      | Revisión pregunta por pregunta               | por anotar | `resultado/pantalla_revision.dart` (alternativas y explicación de `correccion/partes_correccion.dart`)                                                                                                                                                                                                                                                                                          |
| A35      | Progreso                                     | `35:1532`  | `progreso/` (sin «Historial», que llega con HU-62)                                                                                                                                                                                                                                                                                                                                              |
| A36      | Progreso de una prueba sin respuestas        | `35:1664`  | `progreso/pantalla_progreso.dart`                                                                                                                                                                                                                                                                                                                                                               |
| A37      | Perfil                                       | `35:1721`  | `perfil/` (ya sigue el boceto)                                                                                                                                                                                                                                                                                                                                                                  |
| A38      | Invitar                                      | por anotar | `invitaciones/` (link, código, compartir, registrados, verificados y preguntas ganadas, y el saldo y el tope del mes con `FilaDato`)                                                                                                                                                                                                                                                            |
| A39      | Mis datos y privacidad                       | por anotar | `mis_datos/` (descarga, puntajes y «Borrar mi cuenta»; sin «Solicitudes sobre mis datos» ni los términos aceptados, que llegan con HU-09)                                                                                                                                                                                                                                                       |
| A41      | Puntajes PAES                                | `36:1574`  | `puntajes/` (el interruptor del permiso abre una hoja con el permiso completo)                                                                                                                                                                                                                                                                                                                  |
| A42      | Borrar mi cuenta                             | por anotar | `mis_datos/pantalla_borrar_cuenta.dart`                                                                                                                                                                                                                                                                                                                                                         |
| A42b     | Borrar mi cuenta con una suscripción vigente | por anotar | `mis_datos/pantalla_borrar_cuenta.dart` (también ofrece descargar los datos, como pide CU-14 paso 4, y «Cancelar» es el mismo botón con borde de A42)                                                                                                                                                                                                                                           |

Las demás pantallas están en la misma página, con el código del DAS en el nombre (A07, A13…).
Agrega su fila aquí cuando las construyas.

## La A05 y la página de invitación en la consola

La A05 se abre desde el correo en el navegador del teléfono, así que sigue este mismo sistema y no
el de la consola de escritorio. Sus estilos están en
`consola/src/paginas/restablecer-contrasena/restablecer-contrasena.css` (clases `restablecer__…`,
con los mismos valores de esta guía). No los mezcles con `global.css`.

La página de invitación (W01 en el teléfono y W02 en el computador, `/invitar/<código>`) sigue el
mismo criterio: `consola/src/paginas/invitar/invitar.css` (clases `invitar__…`), una sola columna
centrada que sirve para los dos tamaños.
