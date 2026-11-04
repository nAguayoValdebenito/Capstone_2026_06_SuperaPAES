import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/evaluacion_con_tiempo.dart';
import 'package:supera_paes/dominio/entidades/por_repasar.dart';
import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/evaluaciones/estado_evaluaciones.dart';
import 'package:supera_paes/presentacion/inicio/hoja_retomar_evaluacion.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';

/// Empezar la práctica desde A13, el aviso de A15 o «Ahora no» de A16
/// (CU-06 paso 3). Si el diagnóstico de la prueba está pendiente, primero lo
/// ofrece (A16, CU-06 alternativo 2.a). Si empieza, va a la pregunta; sin
/// preguntas suficientes, abre A15 (o se queda en ella con el aviso nuevo);
/// sin cupo, va a Cupo agotado (A22); con una evaluación con tiempo abierta,
/// ofrece retomarla (A29, CU-10 2.b). Otro rechazo queda en [errorEmpezar],
/// sobre el botón.
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
    if (await _ofrecerDiagnostico(datos)) return;
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
      } else if (error.codigo == codigoConTiempoAbierta &&
          await _ofrecerRetomar()) {
        return;
      } else if (mounted) {
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

  /// Empieza el repaso de la prueba o del eje (A24) y va a la pregunta. No
  /// usa cupo; con una evaluación con tiempo abierta, ofrece retomarla (A29).
  Future<void> empezarRepaso(
    PruebaPorRepasar prueba, {
    EjePorRepasar? eje,
  }) async {
    setState(() {
      empezando = true;
      errorEmpezar = null;
    });
    try {
      await ref.read(practicaProvider.notifier).iniciarRepaso(prueba, eje: eje);
      if (mounted) context.go(Rutas.pregunta);
    } on ErrorApi catch (error) {
      if (!mounted) return;
      if (error.codigo == codigoConTiempoAbierta && await _ofrecerRetomar()) {
        return;
      }
      if (mounted) setState(() => errorEmpezar = error.mensaje);
    } finally {
      if (mounted) setState(() => empezando = false);
    }
  }

  /// A16 una vez por prueba hasta que se abra de nuevo la app: si dijo
  /// «Ahora no», no se vuelve a ofrecer. Si no se pudo consultar, practica.
  Future<bool> _ofrecerDiagnostico(DatosPractica datos) async {
    if (ref.read(diagnosticosPospuestosProvider).contains(datos.pruebaId)) {
      return false;
    }
    final DisponibilidadDiagnostico diagnostico;
    try {
      diagnostico = await ref
          .read(repositorioEvaluacionesProvider)
          .disponibilidadDiagnostico(datos.pruebaId);
    } on Object {
      return false;
    }
    if (!mounted || !diagnostico.disponible) return false;
    setState(() => empezando = false);
    ref
        .read(ofertaDiagnosticoProvider.notifier)
        .ofrecer(diagnostico, practica: datos);
    await context.push(Rutas.ofrecerDiagnostico);
    return true;
  }

  /// RN-19: primero hay que terminar la evaluación con tiempo. Devuelve si
  /// se ofreció retomarla; si ya no estaba abierta (venció entre medio), el
  /// llamador muestra el mensaje.
  Future<bool> _ofrecerRetomar() async {
    ref.invalidate(evaluacionAbiertaProvider);
    final abierta = (await ref.read(evaluacionAbiertaProvider.future))?.abierta;
    if (!mounted || abierta == null || !abierta.conTiempo) return false;
    // Con la hoja abierta, el botón ya no está empezando nada.
    setState(() => empezando = false);
    await ofrecerRetomar(context, ref, abierta);
    return true;
  }

  static const String codigoConTiempoAbierta = 'EVALUACION_CON_TIEMPO_ABIERTA';
}
