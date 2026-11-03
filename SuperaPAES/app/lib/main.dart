import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/nucleo/configuracion.dart';
import 'package:supera_paes/nucleo/orientacion.dart';
import 'package:supera_paes/presentacion/aplicacion.dart';

Future<void> main() async {
  Configuracion.verificar();
  WidgetsFlutterBinding.ensureInitialized();
  await fijarVerticalEnTelefonos();
  runApp(const ProviderScope(child: AplicacionSuperaPaes()));
}
