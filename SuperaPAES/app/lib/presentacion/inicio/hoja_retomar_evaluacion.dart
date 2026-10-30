import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/evaluacion_abierta.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/hoja_confirmacion.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';
import 'package:supera_paes/presentacion/resultado/estado_resultado.dart';

/// Lo que se eligió en A29.
enum AccionRetomar { continuar, verResultado }

/// A29 se muestra de a una (Inicio sigue montado detrás de las otras
/// pestañas y también la ofrece), y Inicio la abre sola una vez por
/// evaluación.
class EstadoHojaRetomar extends Notifier<({int? ofrecida, bool visible})> {
  @override
  ({int? ofrecida, bool visible}) build() => (ofrecida: null, visible: false);

  /// Si ya hay una abierta, no abre otra: devuelve `false`.
  bool abrir(int evaluacionId) {
    if (state.visible) return false;
    state = (ofrecida: evaluacionId, visible: true);
    return true;
  }

  void cerrar() => state = (ofrecida: state.ofrecida, visible: false);
}

final hojaRetomarProvider =
    NotifierProvider<EstadoHojaRetomar, ({int? ofrecida, bool visible})>(
      EstadoHojaRetomar.new,
    );

/// Retomar una evaluación con tiempo (A29; HU-60 esc. 2, CU-28, CU-10 2.b y
/// 5.a): al volver a la app, o al intentar empezar otra cosa, ofrece seguir
/// donde quedó; el reloj siguió corriendo (RN-21). Si el tiempo se acaba con
/// la hoja abierta, ofrece el resultado (A30).
Future<void> ofrecerRetomar(
  BuildContext context,
  WidgetRef ref,
  EvaluacionAbierta abierta,
) async {
  final hoja = ref.read(hojaRetomarProvider.notifier);
  if (!hoja.abrir(abierta.id)) return;
  final AccionRetomar? accion;
  try {
    accion = await mostrarHoja<AccionRetomar>(
      context,
      HojaRetomarEvaluacion(abierta: abierta),
    );
  } finally {
    hoja.cerrar();
  }
  if (!context.mounted) return;
  switch (accion) {
    // La evaluación con reloj (A27) se conecta con el paso 27 (HU-40.3);
    // mientras tanto, Continuar lleva a Evaluaciones (A25).
    case AccionRetomar.continuar:
      context.go(Rutas.evaluaciones);
    case AccionRetomar.verResultado:
      // Al consultarlo, el servidor la cierra y la corrige (RN-21).
      ref.invalidate(evaluacionAbiertaProvider);
      await abrirResultado(context, ref, abierta.id);
    case null:
      break;
  }
}

/// «18:05», o «1:05:30» desde una hora.
String relojDe(int segundos) {
  String dos(int n) => n.toString().padLeft(2, '0');
  final horas = segundos ~/ 3600;
  final minutos = segundos % 3600 ~/ 60;
  final resto = dos(segundos % 60);
  return horas > 0 ? '$horas:${dos(minutos)}:$resto' : '$minutos:$resto';
}

/// La hoja de A29, con el tiempo que queda en cuenta regresiva.
class HojaRetomarEvaluacion extends StatefulWidget {
  const HojaRetomarEvaluacion({required this.abierta, super.key});

  final EvaluacionAbierta abierta;

  @override
  State<HojaRetomarEvaluacion> createState() => _HojaRetomarEvaluacionState();
}

class _HojaRetomarEvaluacionState extends State<HojaRetomarEvaluacion> {
  late int _restantes = widget.abierta.segundosRestantes ?? 0;
  Timer? _reloj;

  @override
  void initState() {
    super.initState();
    if (_restantes > 0) {
      _reloj = Timer.periodic(const Duration(seconds: 1), (reloj) {
        setState(() => _restantes--);
        if (_restantes <= 0) reloj.cancel();
      });
    }
  }

  @override
  void dispose() {
    _reloj?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final abierta = widget.abierta;
    final tipo = abierta.tipoNombre.toLowerCase();
    final secundario = TemaSuperaPaes.pequeno.copyWith(
      color: TemaSuperaPaes.textoSecundario,
    );
    final termino = _restantes <= 0;
    final hijos = termino
        ? [
            Semantics(
              header: true,
              child: const Text('Se acabó el tiempo', style: TemaSuperaPaes.h2),
            ),
            Text(
              'Tu $tipo de ${abierta.prueba} se cerró y se corrigió con lo '
              'que respondiste.',
              style: TemaSuperaPaes.cuerpo.copyWith(
                color: TemaSuperaPaes.textoSecundario,
              ),
            ),
            FilledButton(
              onPressed: () =>
                  Navigator.of(context).pop(AccionRetomar.verResultado),
              child: const Text('Ver resultado'),
            ),
          ]
        : [
            Semantics(
              header: true,
              child: Text(
                'Tienes un $tipo sin terminar',
                style: TemaSuperaPaes.h2,
              ),
            ),
            Text(
              '${abierta.prueba} · ${abierta.respondidas} de '
              '${abierta.cantidad} respondidas. Tus respuestas están '
              'guardadas.',
              style: TemaSuperaPaes.cuerpo.copyWith(
                color: TemaSuperaPaes.textoSecundario,
              ),
            ),
            _TiempoQueQueda(segundos: _restantes),
            Text(
              'El reloj siguió corriendo mientras no estabas, como en la PAES '
              'real. Para empezar otra evaluación, primero termina esta.',
              style: secundario,
            ),
            FilledButton(
              onPressed: () =>
                  Navigator.of(context).pop(AccionRetomar.continuar),
              child: const Text('Continuar'),
            ),
          ];
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(
          TemaSuperaPaes.margenPantalla,
          24,
          TemaSuperaPaes.margenPantalla,
          TemaSuperaPaes.margenPantalla,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const IconoEnCirculo(
              icono: Icons.timer_outlined,
              fondo: TemaSuperaPaes.primarioSuave,
              color: TemaSuperaPaes.primario,
            ),
            for (final hijo in hijos) ...[const SizedBox(height: 14), hijo],
            const SizedBox(height: 8),
            BotonTexto(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cerrar'),
            ),
          ],
        ),
      ),
    );
  }
}

/// «Tiempo que te queda 18:05» en un recuadro gris (A29).
class _TiempoQueQueda extends StatelessWidget {
  const _TiempoQueQueda({required this.segundos});

  final int segundos;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: TemaSuperaPaes.neutroSuave,
        borderRadius: BorderRadius.circular(TemaSuperaPaes.radioCampo),
      ),
      // Wrap: con letra grande, el reloj baja bajo el texto (RNF-12).
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 12,
        runSpacing: 4,
        children: [
          const Text('Tiempo que te queda', style: TemaSuperaPaes.cuerpoFuerte),
          Text(relojDe(segundos), style: TemaSuperaPaes.h2),
        ],
      ),
    );
  }
}
