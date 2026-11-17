import 'package:flutter/material.dart';

import 'package:supera_paes/presentacion/comunes/estados.dart';

/// Lo que no se pudo cargar (Progreso, A41): el mensaje de la API, o
/// [mensaje] si el error es otro, y «Reintentar». Se muestra con
/// [EstadoError]: en tono neutro, con el trazo.
class ErrorConReintento extends StatelessWidget {
  const ErrorConReintento({
    required this.error,
    required this.mensaje,
    required this.alReintentar,
    super.key,
  });

  final Object error;
  final String mensaje;
  final VoidCallback alReintentar;

  @override
  Widget build(BuildContext context) =>
      EstadoError(error: error, mensaje: mensaje, alReintentar: alReintentar);
}
