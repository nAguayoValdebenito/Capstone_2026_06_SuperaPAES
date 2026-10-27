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

  /// Colores del logo (DAS 7.5): «Supera» en azul oscuro y «PAES» en celeste.
  static const Color logoOscuro = Color(0xFF0B2653);
  static const Color logoCeleste = Color(0xFF009CD2);

  /// Tipografía de la interfaz.
  static const String fuenteInterfaz = 'Figtree';

  /// Tipografía de fórmulas y texto matemático.
  static const String fuenteFormulas = 'STIX Two Text';

  // Medidas de los componentes.
  static const double margenPantalla = 24;
  static const double altoBoton = 52;
  static const double altoBotonChico = 40;
  static const double altoCampo = 48;
  static const double radioBoton = 14;
  static const double radioBotonChico = 10;
  static const double radioCampo = 12;
  static const double radioTarjeta = 16;

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
      // Barra inferior: sin indicador; la pestaña activa va en azul.
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: superficie,
        indicatorColor: Colors.transparent,
        elevation: 0,
        height: 72,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (estados) => mini.copyWith(
            color: estados.contains(WidgetState.selected)
                ? primario
                : textoSecundario,
          ),
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
    );
  }
}
