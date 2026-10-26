import 'package:flutter/material.dart';
import 'package:supera_paes/dominio/entidades/documento_legal.dart';
import 'package:supera_paes/presentacion/comunes/vista_documento_legal.dart';

/// Pantalla Términos y condiciones (A02): la versión vigente.
class PantallaTerminos extends StatelessWidget {
  const PantallaTerminos({super.key});

  @override
  Widget build(BuildContext context) {
    return const VistaDocumentoLegal(tipo: TipoDocumentoLegal.terminos);
  }
}
