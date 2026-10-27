import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/nucleo/errores.dart';

/// Guardado de un paso del perfil (A08 al corregir el curso y A10): mientras
/// guarda, [guardando]; si la API rechaza, el mensaje del primer problema en
/// [errorGuardar]; si sale bien, va a la pantalla siguiente.
mixin GuardarPaso<T extends ConsumerStatefulWidget> on ConsumerState<T> {
  String? errorGuardar;
  bool guardando = false;

  Future<void> guardarYSeguir(
    Future<void> Function() guardar,
    String destino,
  ) async {
    setState(() {
      guardando = true;
      errorGuardar = null;
    });
    try {
      await guardar();
      if (mounted) context.go(destino);
    } on ErrorApi catch (error) {
      final problemas = error.problemas;
      if (mounted) {
        setState(
          () => errorGuardar = problemas.isEmpty
              ? error.mensaje
              : problemas.first.mensaje,
        );
      }
    } finally {
      if (mounted) setState(() => guardando = false);
    }
  }
}
