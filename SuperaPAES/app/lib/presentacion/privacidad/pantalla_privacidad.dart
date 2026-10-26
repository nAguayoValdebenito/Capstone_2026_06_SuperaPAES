import 'package:flutter/material.dart';
import 'package:supera_paes/dominio/entidades/documento_legal.dart';
import 'package:supera_paes/presentacion/comunes/vista_documento_legal.dart';

/// Pantalla Política de privacidad (A02b): la versión vigente.
class PantallaPrivacidad extends StatelessWidget {
  const PantallaPrivacidad({super.key});

  @override
  Widget build(BuildContext context) {
    return const VistaDocumentoLegal(tipo: TipoDocumentoLegal.privacidad);
  }
}
