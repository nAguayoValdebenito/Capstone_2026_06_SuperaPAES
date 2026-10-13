import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/comunes/esqueleto_con_pestanas.dart'
    show EsqueletoConPestanas;
import 'package:supera_paes/presentacion/comunes/secciones.dart';

/// Estructura común de las pantallas: barra superior con el título de la
/// sección actual y el contenido desplazable. La barra inferior de las
/// pestañas la agrega [EsqueletoConPestanas].
class PantallaBase extends StatelessWidget {
  const PantallaBase({
    required this.hijos,
    super.key,
    this.acciones = const [],
  });

  final List<Widget> hijos;

  /// Acciones de la barra superior (por ejemplo, ir a Mi cuenta).
  final List<Widget> acciones;

  @override
  Widget build(BuildContext context) {
    final seccion = seccionDeRuta(GoRouterState.of(context).uri.path);
    return Scaffold(
      appBar: AppBar(
        title: Text(seccion?.titulo ?? Textos.nombreApp),
        actions: acciones,
      ),
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.all(24), children: hijos),
      ),
    );
  }
}
