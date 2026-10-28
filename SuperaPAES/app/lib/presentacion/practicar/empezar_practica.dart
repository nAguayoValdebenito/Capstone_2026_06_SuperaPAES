import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';

/// Empezar la práctica desde A13 o desde el aviso de A15 (CU-06 paso 3).
/// Si empieza, va a la pregunta; sin preguntas suficientes, abre A15 (o se
/// queda en ella con el aviso nuevo); sin cupo, va a Cupo agotado (A22).
/// Otro rechazo queda en [errorEmpezar], sobre el botón.
mixin EmpezarPractica<T extends ConsumerStatefulWidget> on ConsumerState<T> {
  String? errorEmpezar;
  bool empezando = false;

  /// Si la pantalla es el aviso de A15, que ya muestra el aviso nuevo.
  bool get esAvisoSinPreguntas => false;

  Future<void> empezar(DatosPractica datos) async {
    setState(() {
      empezando = true;
      errorEmpezar = null;
    });
    try {
      final empezo = await ref.read(practicaProvider.notifier).iniciar(datos);
      if (!mounted) return;
      if (empezo) {
        context.go(Rutas.pregunta);
      } else if (!esAvisoSinPreguntas) {
        await context.push(Rutas.sinPreguntas);
      }
    } on ErrorApi catch (error) {
      if (!mounted) return;
      if (error.codigo == 'CUPO_AGOTADO') {
        context.go(Rutas.cupoAgotado);
      } else {
        setState(
          () => errorEmpezar = error.problemas.isEmpty
              ? error.mensaje
              : error.problemas.first.mensaje,
        );
      }
    } finally {
      if (mounted) setState(() => empezando = false);
    }
  }
}
