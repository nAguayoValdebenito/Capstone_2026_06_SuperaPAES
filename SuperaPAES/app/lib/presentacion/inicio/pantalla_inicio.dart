import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/dominio/entidades/evaluacion_abierta.dart';
import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/inicio/aviso_verificar_correo.dart';
import 'package:supera_paes/presentacion/inicio/estado_inicio.dart';
import 'package:supera_paes/presentacion/inicio/evaluacion_sin_terminar.dart';
import 'package:supera_paes/presentacion/inicio/hoja_retomar_evaluacion.dart';
import 'package:supera_paes/presentacion/inicio/pruebas_inicio.dart';
import 'package:supera_paes/presentacion/inicio/tarjeta_cupo.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
import 'package:supera_paes/presentacion/perfil_estudio/hoja_confirmar_curso.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';

/// Inicio del estudiante (A12; HU-35, RF-A05, CU-06 paso 1): el saludo con la
/// racha, el cupo del día, el aviso de correo sin verificar, lo que quedó sin
/// terminar (HU-60) y sus pruebas. Al empezar el año escolar, pide confirmar
/// el curso (A11); con una evaluación con tiempo sin terminar, ofrece
/// retomarla (A29).
class PantallaInicio extends ConsumerStatefulWidget {
  const PantallaInicio({super.key});

  @override
  ConsumerState<PantallaInicio> createState() => _PantallaInicioState();
}

class _PantallaInicioState extends ConsumerState<PantallaInicio> {
  /// Una hoja a la vez: A11 se muestra una vez por apertura de Inicio.
  bool _hojaAbierta = false;

  /// Al volver a la app se leen de nuevo el perfil y el cupo: si empezó
  /// marzo, A11 aparece sin reiniciarla, y si pasó la medianoche, el cupo
  /// vuelve a estar completo.
  late final AppLifecycleListener _ciclo;

  @override
  void initState() {
    super.initState();
    _ciclo = AppLifecycleListener(
      onResume: () {
        // Y lo que quedó sin terminar: el reloj siguió corriendo (RN-21).
        ref
          ..invalidate(perfilProvider)
          ..invalidate(cupoDeHoyProvider)
          ..invalidate(evaluacionAbiertaProvider);
      },
    );
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await _revisarCurso(ref.read(perfilProvider).value);
      await _revisarAbierta(ref.read(evaluacionAbiertaProvider).value);
    });
  }

  @override
  void dispose() {
    _ciclo.dispose();
    super.dispose();
  }

  Future<void> _revisarCurso(PerfilEstudiante? perfil) async {
    if (_hojaAbierta || !mounted || perfil == null) return;
    if (!perfil.debeConfirmarCurso) return;
    _hojaAbierta = true;
    await mostrarConfirmarCurso(context, perfil);
    _hojaAbierta = false;
  }

  /// CU-28: al volver a la app con una evaluación con tiempo abierta, ofrece
  /// retomarla (A29) una sola vez; después sigue en su tarjeta.
  Future<void> _revisarAbierta(ConsultaEvaluacionAbierta? consulta) async {
    final abierta = consulta?.abierta;
    if (_hojaAbierta || !mounted || abierta == null || !abierta.conTiempo) {
      return;
    }
    if (ref.read(hojaRetomarProvider).ofrecida == abierta.id) return;
    _hojaAbierta = true;
    await ofrecerRetomar(context, ref, abierta);
    _hojaAbierta = false;
  }

  /// Deslizar hacia abajo relee el cupo y el perfil. Si falla, la tarjeta
  /// del cupo muestra el error con «Reintentar».
  Future<void> _actualizar() async {
    ref
      ..invalidate(cupoDeHoyProvider)
      ..invalidate(perfilProvider)
      ..invalidate(evaluacionAbiertaProvider);
    try {
      await ref.read(cupoDeHoyProvider.future);
    } on Object {
      return;
    }
  }

  @override
  Widget build(BuildContext context) {
    ref
      ..listen(perfilProvider, (_, perfil) => _revisarCurso(perfil.value))
      ..listen(
        evaluacionAbiertaProvider,
        (_, consulta) => _revisarAbierta(consulta.value),
      );
    final estudiante = ref.watch(sesionProvider).value?.estudiante;

    return PantallaFormulario(
      separacion: 14,
      alActualizar: _actualizar,
      hijos: [
        SaludoInicio(nombre: estudiante?.nombre ?? ''),
        const TarjetaCupo(),
        if (estudiante?.correoVerificado == false) const AvisoVerificarCorreo(),
        const EvaluacionSinTerminar(),
        const PruebasInicio(),
      ],
    );
  }
}
