import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/enrutador.dart';

/// Raíz de la app de estudiantes.
class AplicacionSuperaPaes extends ConsumerWidget {
  const AplicacionSuperaPaes({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: Textos.nombreApp,
      theme: TemaSuperaPaes.claro,
      routerConfig: ref.watch(enrutadorProvider),
      debugShowCheckedModeBanner: false,
    );
  }
}
