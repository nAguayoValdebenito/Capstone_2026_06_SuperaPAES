import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/nucleo/configuracion.dart';
import 'package:supera_paes/presentacion/aplicacion.dart';

void main() {
  Configuracion.verificar();
  runApp(const ProviderScope(child: AplicacionSuperaPaes()));
}
