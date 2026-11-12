import 'package:flutter/material.dart';

import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/hoja_confirmacion.dart';

/// Sin cuentas de tiendas no hay compra (decidido por Sebastian, 04/11):
/// elegir un plan o confirmar un cambio solo avisa el modo de prueba, como
/// en la maqueta A43. Devuelve `true` con «Entendido».
Future<bool> avisarModoDePrueba(
  BuildContext context,
  String elegido, {
  String cancelar = 'Ver otros planes',
}) async {
  final entendido = await mostrarHoja<bool>(
    context,
    HojaConfirmacion(
      titulo: 'Modo de prueba',
      contenido: Text(
        'Versión de prueba: las compras no generan cobros reales. Elegiste '
        '$elegido.',
        style: TemaSuperaPaes.cuerpo.copyWith(
          color: TemaSuperaPaes.textoSecundario,
        ),
      ),
      confirmar: 'Entendido',
      cancelar: cancelar,
    ),
  );
  return entendido ?? false;
}
