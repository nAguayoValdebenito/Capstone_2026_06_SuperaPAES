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

| Nombre en el tema | Valor     | Uso                                                |
| ----------------- | --------- | -------------------------------------------------- |
| `primario`        | `#1D4ED8` | Botón principal, enlaces, foco, pestaña activa     |
| `primarioSuave`   | `#E8EEFD` | Fondo de aviso informativo y de recuadros activos  |
| `primarioOscuro`  | `#1E3A8A` | Texto sobre `primarioSuave`                        |
| `texto`           | `#14213D` | Texto principal («tinta»)                          |
| `textoSecundario` | `#4B5563` | Bajadas, ayudas, íconos y pestañas inactivas       |
| `fondo`           | `#F4F6FA` | Fondo de todas las pantallas                       |
| `superficie`      | `#FFFFFF` | Campos, tarjetas y barra inferior                  |
| `borde`           | `#DDE3EC` | Borde de tarjetas y separadores                    |
| `bordeInput`      | `#C9D2DF` | Borde de campos, casillas y botón de contorno      |
| `neutroSuave`     | `#EEF1F6` | Botón desactivado y aviso neutro                   |
| `exito` / `exitoSuave` / `exitoTexto` | `#15803D` / `#E7F6EC` / `#14532D` | Aviso de éxito |
| `error` / `errorSuave` / `errorTexto` | `#B91C1C` / `#FDECEC` / `#7F1D1D` | Errores y aviso de error |
| `aviso` / `avisoSuave` / `avisoBorde` / `avisoTexto` | `#B45309` / `#FFF4E5` / `#F5C77E` / `#7C2D12` | Aviso de advertencia |
| `logoOscuro` / `logoCeleste` | `#0B2653` / `#009CD2` | Solo el logo                |

## Texto

La fuente es Figtree (400, 600 y 700, empaquetadas en `assets/fuentes/`). En Figma los títulos
usan Figtree 800, que no está empaquetada: se ve con la más gruesa disponible.

| Estilo          | Tamaño y peso | Uso                                             |
| --------------- | ------------- | ----------------------------------------------- |
| `display`       | 44, 800       | Números grandes (puntaje, resultado)            |
| `h1`            | 26, 800       | Título de la pantalla (va en `Encabezado`)      |
| `numero`        | 22, 800       | Cantidad de A13 y datos de A21 (Titulo/Número)  |
| `h2`            | 17, 700       | Título de sección o de tarjeta                  |
| `cuerpo`        | 15, 400       | Texto normal, bajadas y lo que se escribe en un campo |
| `cuerpoFuerte`  | 15, 600       | Texto normal destacado                          |
| `etiqueta`      | 14, 600       | Etiqueta de un campo y botones de texto         |
| `pequeno`       | 13, 400       | Ayudas, avisos y pies                           |
| `pequenoFuerte` | 13, 600       | Enlaces dentro de un pie                        |
| `mini`          | 11, 700       | Etiquetas de la barra inferior                  |
| `botonGrande`   | 17, 700       | Botón de 52 (ya está en el tema)                |
| `botonNormal`   | 14, 700       | Botón chico (ya está en `BotonChico`)           |

Los colores van con `copyWith`, por ejemplo
`TemaSuperaPaes.pequeno.copyWith(color: TemaSuperaPaes.textoSecundario)`.

## Medidas

| Nombre            | Valor | Uso                                            |
| ----------------- | ----- | ---------------------------------------------- |
| `margenPantalla`  | 24    | Margen a los lados (ya está en `PantallaFormulario`) |
| `altoBoton`       | 52    | `FilledButton`, `OutlinedButton` y `BotonTexto` |
| `altoBotonChico`  | 40    | `BotonChico`                                    |
| `altoCampo`       | 48    | Campos de texto                                 |
| `radioBoton`      | 14    | Botones de 52                                   |
| `radioBotonChico` | 10    | Botón chico                                     |
| `radioCampo`      | 12    | Campos, avisos y casillas del código            |
| `radioTarjeta`    | 16    | Tarjetas                                        |
| `altoChip` / `radioChip` | 36 / 18 | Chips                                   |
| `altoEtiqueta`    | 24    | Etiquetas (radio de la mitad)                   |
| `altoBarra`       | 8     | Barra del cupo de A12 (radio de la mitad)       |
| `altoSegmento` / `radioSegmento` | 36 / 9 | Opción del selector segmentado (A13) |
| `botonRedondo`    | 44    | Botones «–» y «+» de la cantidad (A13)          |
| `circuloLetra`    | 28    | Círculo con la letra de cada alternativa (A17)  |
| `altoTextoLectura`| 210   | Alto máximo del texto de lectura en la pregunta (A20) |
| `altoAvance`      | 6     | Barra del avance de la práctica (A17)           |
| `radioHoja`       | 24    | Esquinas de arriba de las hojas que suben desde abajo (A11 y A18) |
| `radioDato`       | 10    | Recuadros de un dato chico, como el acierto por dificultad (A35) |
| `altoBarraSemana` / `radioBarraSemana` | 88 / 6 | Barra más alta del avance semana a semana y su radio (A35) |

Entre los elementos de un formulario van 16 de separación; el diseño de referencia mide 390 × 844.

## Componentes

| Componente (en `componentes.dart`) | Para qué                                                       |
| ---------------------------------- | -------------------------------------------------------------- |
| `PantallaFormulario(hijos: [...], pie:)` | Estructura de la pantalla: sin barra superior, desplazable, márgenes de 24 y 16 entre hijos. El `pie` queda fijo abajo (el botón principal de A08 a A10). Con `alActualizar`, deslizar hacia abajo recarga (A12). |
| `PieConError(boton:, error:)`      | Pie fijo con el error del botón justo sobre él, para que siempre se vea. |
| `EnlaceVolver(texto:, destino:)`   | «‹ Inicio». Vuelve atrás; si no hay historial, va a `destino`. |
| `Encabezado(titulo:, bajada:)`     | Título `h1` y bajada gris. `bajadaRica` para partes en negrita; `centrado` para pantallas con logo. |
| `CampoTexto(etiqueta:, controller:)` | Campo con etiqueta arriba, `pista`, `ayuda` abajo y validación. |
| `CampoContrasena(etiqueta:, controller:)` | Igual, con el ojo para mostrarla.                     |
| `CampoConEtiqueta(etiqueta:, child:)` | Para poner la etiqueta y la ayuda a otro control.           |
| `CampoCodigo(controller:)` (en `verificar_correo/`) | Código de 6 dígitos en casillas, con `error`. |
| `Aviso(tono:, texto:, destacado:)` | Recuadro con ícono. Tonos de `TonoAviso`: `info`, `aviso`, `error`, `exito`, `neutro` y `primario`. Con `textoRico`, la negrita puede ir en medio (A09b). |
| `Tarjeta(child:)`                  | Recuadro blanco con borde, radio 16 y relleno 16.              |
| `BotonChico(texto:, onPressed:)`   | Botón de 40 dentro de un aviso o de una fila.                  |
| `BotonTexto(child:, onPressed:)`   | Botón de texto a lo ancho, como «Reenviar enlace».             |
| `CargandoEnBoton()`                | Indicador dentro de un botón mientras se envía.                |
| `PieConEnlace(pregunta:, enlace:, onPressed:)` | «¿No tienes cuenta? **Crea una**».                 |
| `DatoResumen(valor:, texto:)`      | Número grande con su texto debajo, en un tercio de una `Row` («15 correctas» de A21 y A30). |
| `AlternativaCorregidaVista(...)` y `ExplicacionCorreccion(...)` (en `correccion/partes_correccion.dart`) | Alternativa ya corregida y la tarjeta «Explicación» con «Por qué la B no es correcta» (A19 y A33). |
| `HojaConfirmacion(titulo:, contenido:, confirmar:, cancelar:)` y `confirmarEnHoja(context, hoja)` (en `hoja_confirmacion.dart`) | Hoja que sube desde abajo con un botón que confirma y otro que vuelve (A18, A41); devuelve `true` si confirma. |
| `ErrorConReintento(error:, mensaje:, alReintentar:)` (en `error_con_reintento.dart`) | Lo que no se pudo cargar, con «Reintentar» (Progreso, A41). |

En `comunes/componentes_seleccion.dart`:

| Componente                          | Para qué                                                      |
| ----------------------------------- | ------------------------------------------------------------- |
| `OpcionRadio(texto:, seleccionada:, onTap:, detalle:)` | Opción con radio, una entre varias (cursos de A08). `detalle` va gris debajo (el contenido elegido en A13). |
| `SelectorSegmentado(opciones:, seleccionado:, onChanged:)` | Una opción entre pocas, a lo ancho (dificultad de A13). |
| `OpcionAlternativa(letra:, texto:, seleccionada:, onTap:, resultado:, etiqueta:)` | Alternativa de una pregunta con su letra en un círculo (A17 a A20). Su texto admite fórmulas e imágenes. Corregida (A19), `resultado` la pinta verde o roja y `etiqueta` dice «Tu respuesta» o «Correcta». |

En `comunes/formato_pregunta_vista.dart` (HU-34.2):

| Componente                          | Para qué                                                      |
| ----------------------------------- | ------------------------------------------------------------- |
| `TextoConFormulas(texto, estilo:)`  | Todo texto de una pregunta (enunciado, alternativa, explicación, texto de lectura): Markdown con fórmulas `$…$` y `$$…$$` en LaTeX e imágenes `![alt](url)`. |
| `ImagenAmpliable(url:, alternativo:)` | Imagen que se toca para verla en pantalla completa y agrandarla. |

No muestres el texto de una pregunta con `Text`: usa `TextoConFormulas`, o las fórmulas se verán como
`$\frac{x}{2}$`.
| `TarjetaCasilla(titulo:, marcada:, onTap:, detalle:, etiqueta:)` | Tarjeta con casilla (pruebas de A10).  |
| `ChipSeleccion(texto:, seleccionado:, onTap:)` y `GrupoChips(chips:)` | Chips Normal y Activo, que pasan a la línea siguiente (A09 y A10). |
| `Etiqueta(texto:, tono:)`           | «Sugerida» (`TonoEtiqueta.primario`), «Sin verificar» (`aviso`), «Correcta» (`exito`) o «Tu respuesta» fallada (`error`). |
| `IndicadorPasos(paso:, total:, opcional:, accion:)` | «Paso 2 de 3 · Opcional» con su barra y «Omitir». |
| `FilaDato(etiqueta:, valor:)`       | «Curso · 3° medio» dentro de una tarjeta (A37).                |
| `FilaNavegacion(texto:, onTap:, detalle:, icono:, peligro:)` y `ListaDeFilas(filas:)` | Filas con «›» separadas por una línea (A37). Con `icono` y `detalle`, como las opciones de A22. Con `peligro`, el título y el ícono van en rojo y sin círculo («Borrar mi cuenta» en A39). |

Los botones grandes no necesitan estilo propio: `FilledButton` (principal) y `OutlinedButton`
(contorno, como «Cerrar sesión») ya salen con 52 de alto, a lo ancho y con radio 14. Las casillas
son `Checkbox` y la barra inferior es la `NavigationBar` de `secciones.dart`. Los íconos son los de
Material (`Icons.…_outlined`) en vez de los SVG de Figma.

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

| Pantalla | Boceto                                   | Nodo      | En el código                          |
| -------- | ---------------------------------------- | --------- | ------------------------------------- |
| A01      | Crear cuenta                             | `32:356`  | `crear_cuenta/`                       |
| A01b     | Crear cuenta, contraseña que no cumple   | `32:400`  | `crear_cuenta/`                       |
| A02      | Términos y condiciones                   | `32:454`  | `comunes/vista_documento_legal.dart`  |
| A02b     | Política de privacidad                   | `32:497`  | `comunes/vista_documento_legal.dart`  |
| A03      | Iniciar sesión                           | `32:537`  | `ingreso/`                            |
| A04      | Recuperar contraseña                     | `32:567`  | `recuperar_contrasena/`               |
| A05      | Nueva contraseña (página de la consola)  | `32:594`  | `consola/src/paginas/restablecer-contrasena/` |
| A06      | Verificar correo                         | `32:636`  | `verificar_correo/`                   |
| A06b     | Verificar correo, código incorrecto      | `32:677`  | `verificar_correo/`                   |
| A06c     | Verificar correo, código bloqueado       | `32:716`  | `verificar_correo/`                   |
| A08      | Perfil, paso 1: tu curso                 | `32:871`  | `perfil_estudio/pantalla_paso_curso.dart` |
| A08b     | Paso 1, si ya egresó                     | `32:927`  | `perfil_estudio/pantalla_paso_curso.dart` |
| A09      | Perfil, paso 2: áreas de carrera         | `32:985`  | `perfil_estudio/pantalla_paso_areas.dart` |
| A09b     | Paso 2, tope de tres áreas               | `32:1028` | `perfil_estudio/pantalla_paso_areas.dart` |
| A10      | Perfil, paso 3: tus pruebas              | `33:643`  | `perfil_estudio/pantalla_paso_pruebas.dart` |
| A11      | Confirmar el curso en marzo              | `33:730`  | `perfil_estudio/hoja_confirmar_curso.dart` |
| A12      | Inicio                                   | `33:794`  | `inicio/` (ya sigue el boceto; sin «Práctica sin terminar», «Repasar errores» ni diagnóstico, que llegan con HU-60, HU-39 y HU-36) |
| A13      | Personalizar la práctica                 | `33:883`  | `practicar/pantalla_personalizar_practica.dart` |
| A14      | Elegir eje, contenido o habilidad        | `33:983`  | `practicar/pantalla_elegir_alcance.dart` |
| A15      | Sin preguntas suficientes                | `33:1059` | `practicar/pantalla_sin_preguntas.dart` |
| A17      | Pregunta de práctica                     | `33:1134` | `pregunta/pantalla_pregunta.dart` (sin «Avisar un error», que llega con HU-37) |
| A18      | Confirmar respuesta                      | `33:1187` | `pregunta/hoja_confirmar_respuesta.dart` |
| A19      | Corrección con explicación               | `33:1243` | `correccion/pantalla_correccion.dart` |
| A19b     | Corrección de una respuesta incorrecta   | `33:1299` | `correccion/pantalla_correccion.dart` |
| A20      | Pregunta de Competencia Lectora          | `33:1355` | `pregunta/texto_de_lectura.dart` |
| A22      | Cupo agotado                             | `34:975`  | `cupo_agotado/pantalla_cupo_agotado.dart` («Suscríbete» sin precio hasta HU-43) |
| A21      | Resumen de la práctica                   | `33:1403` | `practicar/pantalla_resumen_practica.dart` (sin «Ver la revisión», que llega con HU-61) |
| A30      | Resultado de mini-ensayo                 | por anotar | `resultado/pantalla_resultado.dart` (sin «Ir al historial», que llega con HU-62) |
| A32      | Resultado de ensayo completo             | por anotar | `resultado/pantalla_resultado.dart` (el puntaje con el año y el proceso de la tabla) |
| A32b     | Ensayo sin tabla de conversión           | por anotar | `resultado/pantalla_resultado.dart` |
| A33      | Revisión pregunta por pregunta           | por anotar | `resultado/pantalla_revision.dart` (alternativas y explicación de `correccion/partes_correccion.dart`) |
| A35      | Progreso                                 | `35:1532` | `progreso/` (sin «Historial», que llega con HU-62) |
| A36      | Progreso de una prueba sin respuestas    | `35:1664` | `progreso/pantalla_progreso.dart`      |
| A37      | Perfil                                   | `35:1721` | `perfil/` (ya sigue el boceto)         |
| A39      | Mis datos y privacidad                   | por anotar | `mis_datos/` (descarga, puntajes y «Borrar mi cuenta»; sin «Solicitudes sobre mis datos» ni los términos aceptados, que llegan con HU-09) |
| A41      | Puntajes PAES                            | `36:1574` | `puntajes/` (el interruptor del permiso abre una hoja con el permiso completo) |
| A42      | Borrar mi cuenta                         | por anotar | `mis_datos/pantalla_borrar_cuenta.dart` |
| A42b     | Borrar mi cuenta con una suscripción vigente | por anotar | `mis_datos/pantalla_borrar_cuenta.dart` (también ofrece descargar los datos, como pide CU-14 paso 4, y «Cancelar» es el mismo botón con borde de A42) |

Las demás pantallas están en la misma página, con el código del DAS en el nombre (A07, A13…).
Agrega su fila aquí cuando las construyas.

## La A05 en la consola

La A05 se abre desde el correo en el navegador del teléfono, así que sigue este mismo sistema y no
el de la consola de escritorio. Sus estilos están en
`consola/src/paginas/restablecer-contrasena/restablecer-contrasena.css` (clases `restablecer__…`,
con los mismos valores de esta guía). No los mezcles con `global.css`.
