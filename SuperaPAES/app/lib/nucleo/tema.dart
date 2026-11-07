import 'package:flutter/material.dart';

/// Tema de la app según el sistema de diseño del prototipo (DAS 7.5; página
/// «Componentes» de Figma, versión 3). Los nombres de los colores y de los
/// estilos de texto son los de las variables y estilos de Figma. Todos los
/// pares de texto y fondo cumplen contraste AA (RNF-12). Guía para usarlo:
/// `app/DISENO.md`.
abstract final class TemaSuperaPaes {
  // Colores (variables «color/…» de Figma).
  static const Color primario = Color(0xFF1D4ED8);
  static const Color primarioSuave = Color(0xFFE8EEFD);
  static const Color primarioOscuro = Color(0xFF1E3A8A);
  static const Color texto = Color(0xFF14213D); // «tinta»
  static const Color textoSecundario = Color(0xFF4B5563);
  static const Color fondo = Color(0xFFF4F6FA);
  static const Color superficie = Color(0xFFFFFFFF);
  static const Color borde = Color(0xFFDDE3EC);
  static const Color bordeInput = Color(0xFFC9D2DF);
  static const Color neutroSuave = Color(0xFFEEF1F6);
  static const Color exito = Color(0xFF15803D);
  static const Color exitoSuave = Color(0xFFE7F6EC);
  static const Color exitoTexto = Color(0xFF14532D);
  static const Color error = Color(0xFFB91C1C);
  static const Color errorSuave = Color(0xFFFDECEC);
  static const Color errorTexto = Color(0xFF7F1D1D);
  static const Color aviso = Color(0xFFB45309);
  static const Color avisoSuave = Color(0xFFFFF4E5);
  static const Color avisoBorde = Color(0xFFF5C77E);
  static const Color avisoTexto = Color(0xFF7C2D12);

  /// Texto secundario sobre el degradado de «Hoy» (blanco al 86 %, al menos
  /// 5,2:1 sobre [primario]).
  static const Color sobreMarcaSuave = Color(0xDBFFFFFF);

  /// Gris pizarra del ícono de la corrección sin acierto (6,7:1 sobre
  /// [neutroSuave]).
  static const Color neutroFuerte = Color(0xFF475569);

  /// Barras de datos pasados, como las semanas anteriores de A35 (3,5:1
  /// sobre blanco).
  static const Color primarioMedio = Color(0xFF6585E0);

  /// Identidad «cuaderno de cuadros»: líneas de la cuadrícula del fondo
  /// (sobre [fondo]), una cada [pasoCuadricula].
  static const Color cuadricula = Color(0xFFE3E8F1);
  static const double pasoCuadricula = 22;

  /// El destacador: el celeste del logo al 30 %. Marca lo que pide atención
  /// sin usar amarillo ni naranja.
  static const Color destacador = Color(0x4D009CD2);

  /// El único degradado de la app, el de la tarjeta «Hoy» de Inicio.
  static const LinearGradient degradadoHoy = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [primario, primarioOscuro],
  );

  /// Colores del logo (DAS 7.5): «Supera» en azul oscuro y «PAES» en celeste.
  static const Color logoOscuro = Color(0xFF0B2653);
  static const Color logoCeleste = Color(0xFF009CD2);

  /// Tipografía de la interfaz.
  static const String fuenteInterfaz = 'Figtree';

  /// Tipografía de fórmulas y texto matemático.
  static const String fuenteFormulas = 'STIX Two Text';

  // Escala de espacios: los márgenes y separaciones salen de aquí, sin
  // valores sueltos (plan de mejora visual del 02/11).
  static const double espacio4 = 4;
  static const double espacio8 = 8;
  static const double espacio12 = 12;
  static const double espacio16 = 16;
  static const double espacio24 = 24;
  static const double espacio32 = 32;

  // Tres radios de la identidad: 20 en tarjetas y hojas, 14 en botones,
  // campos y avisos, y 10 en lo chico (botón chico y datos).
  static const double radioGrande = 20;
  static const double radioMedio = 14;
  static const double radioChico = 10;

  // Movimiento: solo se animan opacidad, escala y color, nunca el diseño de
  // la página, y todo respeta «reducir el movimiento» (ver `duracion` en
  // `presentacion/comunes/movimiento.dart`).
  static const Duration movimientoRapido = Duration(milliseconds: 150);
  static const Duration movimientoNormal = Duration(milliseconds: 200);
  static const Duration movimientoLento = Duration(milliseconds: 400);

  /// Salida de las páginas y medidas de la barra inferior (F1).
  static const Duration movimientoSalidaPantalla = Duration(milliseconds: 280);
  static const double altoBarraNavegacion = 72;
  static const double anchoIndicadorNavegacion = 64;
  static const double altoIndicadorNavegacion = 32;
  static const double escalaLetraBarra = 1.3;
  static const double escalaPulsoPestana = 1.08;

  /// Un solo momento de autor por pantalla: el anillo del resumen o el
  /// conteo del puntaje.
  static const Duration movimientoFoco = Duration(milliseconds: 700);
  static const Curve curvaEntrada = Curves.easeOutCubic;
  static const Curve curvaSalida = Curves.easeInCubic;

  /// Transiciones de pantalla y momentos de autor.
  static const Curve curvaEnfasis = Easing.emphasizedDecelerate;

  /// Lo que avanza a ritmo constante: el esqueleto y la barra del reloj.
  static const Curve curvaLineal = Curves.linear;

  /// Distancia del eje horizontal entre pantallas y de la entrada
  /// escalonada de las listas.
  static const double desplazamientoPantalla = 24;
  static const double desplazamientoLista = 8;

  /// Entrada escalonada: 40 ms entre elementos y, desde el sexto, entran
  /// todos con él.
  static const Duration pasoEscalonado = Duration(milliseconds: 40);
  static const int topeEscalonado = 6;

  /// Sombra suave de lo que se toca (el color [texto] al 6 %, a 2 de
  /// distancia); lo que solo informa queda plano, con borde.
  static const List<BoxShadow> sombraSuave = [
    BoxShadow(color: Color(0x0F14213D), blurRadius: 12, offset: Offset(0, 2)),
    BoxShadow(color: Color(0x0A14213D), blurRadius: 2, offset: Offset(0, 1)),
  ];

  /// Sombra con el tinte de la marca, solo para la tarjeta «Hoy».
  static const List<BoxShadow> sombraMarca = [
    BoxShadow(color: Color(0x2E1D4ED8), blurRadius: 16, offset: Offset(0, 8)),
  ];

  /// Zona de toque mínima de Android (48 dp; 44 pt en iOS), aunque lo que se
  /// ve sea más chico.
  static const double zonaTactil = 48;

  /// En tablet (600 dp o más) el contenido va centrado con este ancho
  /// máximo: 560 en formularios y 720 en pantallas de lectura (la pregunta,
  /// su corrección y su revisión, y los textos legales). Bajo 600 dp la
  /// pantalla usa todo el ancho, como siempre.
  static const double anchoFormulario = 560;
  static const double anchoLectura = 720;

  /// Desde este ancho (el lado corto de la pantalla) el equipo es una tablet:
  /// los teléfonos quedan fijos en vertical y la tablet gira libre.
  static const double anchoTablet = 600;

  // Medidas de los componentes.
  static const double margenPantalla = espacio24;
  static const double altoBoton = 52;
  static const double altoBotonChico = 40;
  static const double altoCampo = 48;
  static const double radioBoton = radioMedio;
  static const double radioBotonChico = radioChico;
  static const double radioCampo = radioMedio;
  static const double radioTarjeta = radioGrande;
  static const double altoChip = 36;
  static const double radioChip = 18;
  static const double altoEtiqueta = 24;

  /// Barra del cupo de A12; su radio es la mitad del alto.
  static const double altoBarra = 8;

  /// Opción activa del selector segmentado (la dificultad de A13), dentro de
  /// un fondo de radio [radioCampo] con relleno 4: la barra mide 48, la zona
  /// táctil.
  static const double radioSegmento = radioCampo - espacio4;
  static const double altoSegmento = zonaTactil - 2 * espacio4;

  /// Botones redondos de la cantidad de A13.
  static const double botonRedondo = 44;

  /// Círculo con la letra de cada alternativa (A17 a A20).
  static const double circuloLetra = 28;

  /// Alto máximo del texto de lectura dentro de la pregunta (A20); el resto
  /// se recorre ahí mismo o con «Ampliar texto».
  static const double altoTextoLectura = 210;

  /// Barra del avance de la práctica (A17), como la de los pasos del perfil.
  static const double altoAvance = 6;

  /// Esquinas de arriba de las hojas que suben desde abajo (A11 y A18).
  static const double radioHoja = radioGrande;

  /// Recuadros de un dato chico, como el acierto por dificultad de A35.
  static const double radioDato = radioChico;

  /// Barras del avance semana a semana de A35: la más alta mide esto.
  static const double altoBarraSemana = 88;
  static const double radioBarraSemana = 6;
  static const double anchoBarraSemana = 40;

  /// Anillo del resumen de la práctica (A21).
  static const double anilloResumen = 148;

  /// Barra del tiempo restante de las evaluaciones (A27).
  static const double altoBarraReloj = 3;

  // Estilos de texto (estilos «Titulo/…», «Texto/…» y «Boton/…» de Figma).
  static const TextStyle display = TextStyle(
    fontSize: 44,
    fontWeight: FontWeight.w800,
    height: 1.1,
    color: texto,
  );
  static const TextStyle h1 = TextStyle(
    fontSize: 26,
    fontWeight: FontWeight.w800,
    height: 1.2,
    color: texto,
  );

  /// Titulo/Número: la cantidad de A13 y los datos de A21.
  static const TextStyle numero = TextStyle(
    fontSize: 22,
    fontWeight: FontWeight.w800,
    height: 1.2,
    color: texto,
  );
  static const TextStyle h2 = TextStyle(
    fontSize: 17,
    fontWeight: FontWeight.w700,
    height: 1.3,
    color: texto,
  );
  static const TextStyle cuerpo = TextStyle(
    fontSize: 15,
    height: 1.45,
    color: texto,
  );
  static const TextStyle cuerpoFuerte = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w600,
    height: 1.45,
    color: texto,
  );
  static const TextStyle etiqueta = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    height: 1.4,
    color: texto,
  );
  static const TextStyle pequeno = TextStyle(
    fontSize: 13,
    height: 1.4,
    color: texto,
  );
  static const TextStyle pequenoFuerte = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w600,
    height: 1.4,
    color: texto,
  );
  static const TextStyle mini = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w700,
    height: 1.3,
  );
  static const TextStyle botonGrande = TextStyle(
    fontFamily: fuenteInterfaz,
    fontSize: 17,
    fontWeight: FontWeight.w700,
    height: 1.2,
  );
  static const TextStyle botonNormal = TextStyle(
    fontFamily: fuenteInterfaz,
    fontSize: 14,
    fontWeight: FontWeight.w700,
    height: 1.2,
  );

  /// Cifras tabulares: todo número que cambia o cuenta (cupo, porcentaje,
  /// puntaje, reloj) conserva su ancho.
  static const List<FontFeature> tabulares = [FontFeature.tabularFigures()];

  static TextStyle tabular(TextStyle base) =>
      base.copyWith(fontFeatures: tabulares);

  static OutlineInputBorder _bordeCampo(Color color, double ancho) =>
      OutlineInputBorder(
        borderRadius: BorderRadius.circular(radioCampo),
        borderSide: BorderSide(color: color, width: ancho),
      );

  static RoundedRectangleBorder _formaBoton(double radio) =>
      RoundedRectangleBorder(borderRadius: BorderRadius.circular(radio));

  static ThemeData get claro {
    final esquema = ColorScheme.fromSeed(
      seedColor: primario,
      primary: primario,
      onPrimary: superficie,
      primaryContainer: primarioSuave,
      onPrimaryContainer: primarioOscuro,
      surface: superficie,
      // Ningún diálogo, menú u hoja toma el lila de `fromSeed`: los
      // contenedores quedan en los neutros de la paleta.
      surfaceContainerLowest: superficie,
      surfaceContainerLow: superficie,
      surfaceContainer: superficie,
      surfaceContainerHigh: superficie,
      surfaceContainerHighest: neutroSuave,
      surfaceTint: Colors.transparent,
      onSurface: texto,
      onSurfaceVariant: textoSecundario,
      error: error,
      outline: bordeInput,
      outlineVariant: borde,
    );
    return ThemeData(
      colorScheme: esquema,
      fontFamily: fuenteInterfaz,
      scaffoldBackgroundColor: fondo,
      textTheme: const TextTheme(
        displayLarge: display,
        headlineMedium: h1,
        titleLarge: h2,
        titleMedium: cuerpoFuerte,
        bodyLarge: cuerpo,
        bodyMedium: pequeno,
        labelLarge: etiqueta,
        labelSmall: mini,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: fondo,
        foregroundColor: texto,
        titleTextStyle: TextStyle(
          fontFamily: fuenteInterfaz,
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: texto,
        ),
      ),
      // Campo (Normal, Vacío, Foco y Error).
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: superficie,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 13,
        ),
        hintStyle: cuerpo.copyWith(color: textoSecundario),
        helperStyle: pequeno.copyWith(color: textoSecundario),
        errorStyle: pequeno.copyWith(color: error),
        border: _bordeCampo(bordeInput, 1),
        enabledBorder: _bordeCampo(bordeInput, 1),
        focusedBorder: _bordeCampo(primario, 2),
        errorBorder: _bordeCampo(error, 2),
        focusedErrorBorder: _bordeCampo(error, 2),
        disabledBorder: _bordeCampo(borde, 1),
      ),
      // Botón: Primario, Contorno y Texto; Deshabilitado sin color.
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(altoBoton),
          padding: const EdgeInsets.symmetric(horizontal: 20),
          shape: _formaBoton(radioBoton),
          textStyle: botonGrande,
          backgroundColor: primario,
          foregroundColor: superficie,
          disabledBackgroundColor: neutroSuave,
          disabledForegroundColor: textoSecundario,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(altoBoton),
          padding: const EdgeInsets.symmetric(horizontal: 20),
          shape: _formaBoton(radioBoton),
          textStyle: botonGrande,
          backgroundColor: superficie,
          foregroundColor: texto,
          side: const BorderSide(color: bordeInput),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: primario,
          textStyle: etiqueta.copyWith(fontFamily: fuenteInterfaz),
        ),
      ),
      checkboxTheme: CheckboxThemeData(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
        side: const BorderSide(color: bordeInput, width: 2),
        fillColor: WidgetStateProperty.resolveWith(
          (estados) =>
              estados.contains(WidgetState.selected) ? primario : superficie,
        ),
      ),
      // Barra inferior: la pestaña activa va en azul, con su texto en
      // negrita; el indicador lo dibuja `BarraInferior`.
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: superficie,
        indicatorColor: primarioSuave,
        elevation: 0,
        height: altoBarraNavegacion,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (estados) => estados.contains(WidgetState.selected)
              ? mini.copyWith(color: primario, fontWeight: FontWeight.w800)
              : mini.copyWith(color: textoSecundario),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (estados) => IconThemeData(
            size: 22,
            color: estados.contains(WidgetState.selected)
                ? primario
                : textoSecundario,
          ),
        ),
      ),
      dividerTheme: const DividerThemeData(color: borde, space: 1),
      // Las hojas que suben desde abajo: superficie blanca, esquinas de
      // `radioHoja`, asa y el ancho de un formulario en tablet.
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: superficie,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        dragHandleColor: bordeInput,
        constraints: BoxConstraints(maxWidth: anchoFormulario),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(radioHoja)),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: superficie,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radioGrande),
        ),
      ),
    );
  }
}

/// Las cinco pruebas de la PAES: nombre, tono y fondo suave. Los tonos salen
/// del azul de la marca y cada prueba tiene además su glifo (`GlifoPrueba`),
/// para no depender solo del color (Lectora e Historia son cercanos).
enum Prueba {
  cl(
    'CL',
    'Competencia Lectora',
    'Lectora',
    Color(0xFF0369A1),
    Color(0xFFE0F2FE),
  ),
  m1('M1', 'Matemática 1', 'M1', Color(0xFF1D4ED8), Color(0xFFE8EEFD)),
  m2('M2', 'Matemática 2', 'M2', Color(0xFF4338CA), Color(0xFFEEF2FF)),
  hcs(
    'HCS',
    'Historia y Ciencias Sociales',
    'Historia',
    Color(0xFF1E40AF),
    Color(0xFFDBEAFE),
  ),
  cie('CIE', 'Ciencias', 'Ciencias', Color(0xFF0E7490), Color(0xFFE0F7FA));

  const Prueba(this.codigo, this.nombre, this.corto, this.tono, this.fondo);

  /// La prueba con ese código (`CL`, `M1`, `M2`, `HCS` o `CIE`); una prueba
  /// desconocida usa el azul de la marca (M1).
  factory Prueba.deCodigo(String codigo) =>
      values.firstWhere((prueba) => prueba.codigo == codigo, orElse: () => m1);

  final String codigo;
  final String nombre;
  final String corto;
  final Color tono;
  final Color fondo;
}
