import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/inicio/aviso_verificar_correo.dart';
import 'package:supera_paes/presentacion/inicio/estado_inicio.dart';
import 'package:supera_paes/presentacion/inicio/pruebas_inicio.dart';
import 'package:supera_paes/presentacion/inicio/tarjeta_cupo.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
import 'package:supera_paes/presentacion/perfil_estudio/hoja_confirmar_curso.dart';

/// Inicio del estudiante (A12; HU-35, RF-A05, CU-06 paso 1): el saludo con la
/// racha, el cupo del día, el aviso de correo sin verificar y sus pruebas. Al
/// empezar el año escolar, pide confirmar el curso (A11).
class PantallaInicio extends ConsumerStatefulWidget {
  const PantallaInicio({super.key});

  @override
  ConsumerState<PantallaInicio> createState() => _PantallaInicioState();
}

class _PantallaInicioState extends ConsumerState<PantallaInicio> {
  /// La hoja de A11 se muestra una vez por apertura de Inicio.
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
        ref
          ..invalidate(perfilProvider)
          ..invalidate(cupoDeHoyProvider);
      },
    );
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _revisarCurso(ref.read(perfilProvider).value),
    );
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

  /// Deslizar hacia abajo relee el cupo y el perfil. Si falla, la tarjeta
  /// del cupo muestra el error con «Reintentar».
  Future<void> _actualizar() async {
    ref
      ..invalidate(cupoDeHoyProvider)
      ..invalidate(perfilProvider);
    try {
      await ref.read(cupoDeHoyProvider.future);
    } on Object {
      return;
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(perfilProvider, (_, perfil) => _revisarCurso(perfil.value));
    final estudiante = ref.watch(sesionProvider).value?.estudiante;

    return PantallaFormulario(
      separacion: 14,
      alActualizar: _actualizar,
      hijos: [
        SaludoInicio(nombre: estudiante?.nombre ?? ''),
        const TarjetaCupo(),
        if (estudiante?.correoVerificado == false) const AvisoVerificarCorreo(),
        const PruebasInicio(),
      ],
    );
  }
}
