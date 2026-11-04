import 'package:flutter/material.dart';

import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/hoja_confirmacion.dart';

/// A18 · Confirmar respuesta (HU-32 esc. 4, CU-07 paso 2, RN-07): en la
/// práctica la corrección es inmediata, así que la respuesta no se puede
/// cambiar después. Devuelve `true` si el estudiante confirma; cerrar la
/// hoja o «Cambiar alternativa» vuelve a la pregunta con su elección.
Future<bool> confirmarRespuesta(
  BuildContext context,
  String letra, {
  bool esRepaso = false,
}) =>
    // Sobre la barra inferior; la pregunta se sigue viendo detrás.
    confirmarEnHoja(
      context,
      HojaConfirmarRespuesta(letra: letra, esRepaso: esRepaso),
    );

class HojaConfirmarRespuesta extends StatelessWidget {
  const HojaConfirmarRespuesta({
    required this.letra,
    super.key,
    this.esRepaso = false,
  });

  final String letra;

  /// El repaso se corrige igual que la práctica (HU-39).
  final bool esRepaso;

  @override
  Widget build(BuildContext context) {
    return HojaConfirmacion(
      titulo: '¿Confirmas la alternativa $letra?',
      contenido: Text(
        '${esRepaso ? 'En el repaso' : 'En la práctica'} la corrección es '
        'inmediata, así que después no podrás cambiarla.',
        style: TemaSuperaPaes.cuerpo.copyWith(
          color: TemaSuperaPaes.textoSecundario,
        ),
      ),
      confirmar: 'Confirmar',
      cancelar: 'Cambiar alternativa',
    );
  }
}
