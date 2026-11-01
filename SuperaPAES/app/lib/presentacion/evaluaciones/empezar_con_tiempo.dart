import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/inicio/hoja_retomar_evaluacion.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';

/// Empezar una evaluación con tiempo desde A16 o A26 (CU-10 pasos 3 y 4).
/// Si empieza, va a la primera pregunta (A27); con otra evaluación con
/// tiempo abierta, ofrece retomarla (A29, CU-10 2.b). Otro rechazo, como el
/// uso gratis agotado, queda en [errorConTiempo], sobre el botón.
mixin EmpezarConTiempo<T extends ConsumerStatefulWidget> on ConsumerState<T> {
  String? errorConTiempo;
  bool empezandoConTiempo = false;

  /// [iniciar] arma la evaluación; [alRechazar] relee lo que haya cambiado.
  Future<void> empezarConTiempo(
    Future<void> Function() iniciar, {
    VoidCallback? alRechazar,
  }) async {
    setState(() {
      empezandoConTiempo = true;
      errorConTiempo = null;
    });
    try {
      await iniciar();
      if (mounted) context.go(Rutas.preguntaConReloj);
    } on ErrorApi catch (error) {
      if (!mounted) return;
      if (error.codigo == 'EVALUACION_CON_TIEMPO_ABIERTA' &&
          await _ofrecerRetomar()) {
        return;
      }
      alRechazar?.call();
      if (mounted) {
        setState(
          () => errorConTiempo = error.problemas.isEmpty
              ? error.mensaje
              : error.problemas.first.mensaje,
        );
      }
    } finally {
      if (mounted) setState(() => empezandoConTiempo = false);
    }
  }

  Future<bool> _ofrecerRetomar() async {
    ref.invalidate(evaluacionAbiertaProvider);
    final abierta = (await ref.read(evaluacionAbiertaProvider.future))?.abierta;
    if (!mounted || abierta == null || !abierta.conTiempo) return false;
    setState(() => empezandoConTiempo = false);
    await ofrecerRetomar(context, ref, abierta);
    return true;
  }
}
