import 'package:flutter/material.dart';

import 'package:supera_paes/nucleo/tema.dart';

/// Tono, fondo suave e ícono de una prueba (plan de mejora visual del
/// 02/11). Los cinco tonos salen del azul de la marca; cada prueba tiene su
/// ícono para no depender solo del color (Lectora e Historia son cercanos).
/// El primario y los colores de éxito, error y aviso no cambian.
typedef EstiloPrueba = ({Color tono, Color fondo, IconData icono});

/// El estilo de la prueba con ese código (`CL`, `M1`, `M2`, `HCS` o `CIE`);
/// una prueba desconocida usa el azul de la marca.
EstiloPrueba estiloDePrueba(String codigo) => switch (codigo) {
  'CL' => (
    tono: const Color(0xFF0369A1),
    fondo: const Color(0xFFE0F2FE),
    icono: Icons.menu_book_rounded,
  ),
  'M2' => (
    tono: const Color(0xFF4338CA),
    fondo: const Color(0xFFEEF2FF),
    icono: Icons.functions_rounded,
  ),
  'HCS' => (
    tono: const Color(0xFF1E40AF),
    fondo: const Color(0xFFDBEAFE),
    icono: Icons.account_balance_outlined,
  ),
  'CIE' => (
    tono: const Color(0xFF0E7490),
    fondo: const Color(0xFFE0F7FA),
    icono: Icons.science_outlined,
  ),
  _ => (
    tono: TemaSuperaPaes.primario,
    fondo: TemaSuperaPaes.primarioSuave,
    icono: Icons.calculate_outlined,
  ),
};

/// Sello de una prueba: su ícono en su tono, sobre un cuadrado de su fondo
/// suave con radio chico. Es decorativo: el nombre de la prueba va al lado.
class SelloPrueba extends StatelessWidget {
  const SelloPrueba({required this.codigo, super.key, this.tamano = 40});

  final String codigo;
  final double tamano;

  @override
  Widget build(BuildContext context) {
    final estilo = estiloDePrueba(codigo);
    return ExcludeSemantics(
      child: Container(
        width: tamano,
        height: tamano,
        decoration: BoxDecoration(
          color: estilo.fondo,
          borderRadius: BorderRadius.circular(TemaSuperaPaes.radioChico),
        ),
        child: Icon(estilo.icono, size: tamano * 0.55, color: estilo.tono),
      ),
    );
  }
}
