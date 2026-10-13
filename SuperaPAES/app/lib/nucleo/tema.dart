import 'package:flutter/material.dart';

/// Tema de la app, con los mismos colores y tipografías que la consola
/// (prototipo en Figma; diseño de referencia de teléfono: 390 × 844).
/// Todos los pares de texto y fondo cumplen contraste AA (RNF-12).
abstract final class TemaSuperaPaes {
  static const Color primario = Color(0xFF1D4ED8);
  static const Color texto = Color(0xFF14213D);
  static const Color textoSecundario = Color(0xFF4A5568);
  static const Color fondo = Color(0xFFF4F6FA);
  static const Color superficie = Color(0xFFFFFFFF);
  static const Color borde = Color(0xFFD5DBE6);
  static const Color exito = Color(0xFF15803D);
  static const Color error = Color(0xFFB91C1C);
  static const Color aviso = Color(0xFFB45309);

  /// Tipografía de la interfaz.
  static const String fuenteInterfaz = 'Figtree';

  /// Tipografía de fórmulas y texto matemático.
  static const String fuenteFormulas = 'STIX Two Text';

  static ThemeData get claro {
    final esquema = ColorScheme.fromSeed(
      seedColor: primario,
      primary: primario,
      onPrimary: superficie,
      surface: superficie,
      onSurface: texto,
      onSurfaceVariant: textoSecundario,
      error: error,
      outline: borde,
    );
    return ThemeData(
      colorScheme: esquema,
      fontFamily: fuenteInterfaz,
      scaffoldBackgroundColor: fondo,
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
      navigationBarTheme: const NavigationBarThemeData(
        backgroundColor: superficie,
      ),
    );
  }
}
