import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/boton_principal.dart';

/// Guardado de un paso del perfil (A08 al corregir el curso y A10): mientras
/// guarda, [guardando]; si la API rechaza, el mensaje del primer problema en
/// [errorGuardar]; si sale bien, va a la pantalla siguiente.
mixin GuardarPaso<T extends ConsumerStatefulWidget> on ConsumerState<T> {
  String? errorGuardar;
  bool guardando = false;
  int intentosGuardar = 0;

  EstadoBoton get estadoGuardar => guardando
      ? EstadoBoton.cargando
      : errorGuardar != null
      ? EstadoBoton.error
      : EstadoBoton.normal;

  Future<void> guardarYSeguir(
    Future<void> Function() guardar,
    String destino,
  ) async {
    if (guardando) return;
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
        setState(() {
          intentosGuardar++;
          errorGuardar = problemas.isEmpty
              ? error.mensaje
              : problemas.first.mensaje;
        });
      }
    } finally {
      if (mounted) setState(() => guardando = false);
    }
  }
}
