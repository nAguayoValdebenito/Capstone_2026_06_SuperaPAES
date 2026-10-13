import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/presentacion/comunes/pantalla_base.dart';

/// Botón provisional que lleva a otra pantalla mientras no existe el flujo
/// real.
class AccionNavegacion {
  const AccionNavegacion(this.texto, this.ruta, {this.reemplazar = false});

  final String texto;
  final String ruta;

  /// `true` reemplaza la pila (por ejemplo, al entrar a la cuenta);
  /// `false` abre la pantalla encima, con botón para volver.
  final bool reemplazar;
}

/// Pantalla provisional de una sección que aún no se construye.
class EnConstruccion extends StatelessWidget {
  const EnConstruccion({
    required this.descripcion,
    super.key,
    this.hijos = const [],
    this.acciones = const [],
    this.accionesBarra = const [],
  });

  final String descripcion;

  /// Contenido adicional bajo la descripción.
  final List<Widget> hijos;

  final List<AccionNavegacion> acciones;

  /// Acciones de la barra superior.
  final List<Widget> accionesBarra;

  @override
  Widget build(BuildContext context) {
    final textos = Theme.of(context).textTheme;
    return PantallaBase(
      acciones: accionesBarra,
      hijos: [
        Text('En construcción', style: textos.titleMedium),
        const SizedBox(height: 8),
        Text(descripcion, style: textos.bodyLarge),
        ...hijos,
        if (acciones.isNotEmpty) const SizedBox(height: 24),
        for (final accion in acciones)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: OutlinedButton(
              onPressed: () => accion.reemplazar
                  ? context.go(accion.ruta)
                  : context.push(accion.ruta),
              child: Text(accion.texto),
            ),
          ),
      ],
    );
  }
}
