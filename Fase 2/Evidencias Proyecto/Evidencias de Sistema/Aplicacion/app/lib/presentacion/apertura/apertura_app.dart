import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/apertura/ambito_apertura.dart';
import 'package:supera_paes/presentacion/apertura/pantalla_cargando.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/comunes/movimiento.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';

/// Cubre solo el arranque. El enrutador conserva la sesión, el perfil y los
/// enlaces profundos; su destino se revela una vez listo, sin reiniciarlo.
class AperturaApp extends ConsumerStatefulWidget {
  const AperturaApp({required this.child, super.key});

  final Widget child;

  @override
  ConsumerState<AperturaApp> createState() => _AperturaAppState();
}

class _AperturaAppState extends ConsumerState<AperturaApp>
    with TickerProviderStateMixin {
  late final AnimationController _entrada = AnimationController(vsync: this)
    ..addStatusListener(_alCompletarEntrada);
  late final AnimationController _fundido = AnimationController(vsync: this)
    ..addStatusListener(_alCompletarFundido);
  late final Listenable _animaciones = Listenable.merge([_entrada, _fundido]);
  Timer? _umbralEspera;
  bool _iniciada = false;
  bool _reducida = false;
  bool _minimoCumplido = false;
  bool _destinoListo = false;
  bool _salidaProgramada = false;
  bool _esperando = false;
  bool _terminada = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_terminada) return;
    _reducida = reducirMovimiento(context);
    _entrada.duration = duracion(
      context,
      TemaSuperaPaes.movimientoLento + TemaSuperaPaes.pausaApertura,
    );
    _fundido.duration = duracion(context, TemaSuperaPaes.fundidoApertura);
    if (_reducida) {
      _minimoCumplido = true;
      _entrada
        ..stop()
        ..value = 1;
      _fundido
        ..stop()
        ..value = 0;
    }
    if (_iniciada) return;
    _iniciada = true;
    _umbralEspera = Timer(TemaSuperaPaes.umbralEsperaApertura, () {
      if (mounted && !_terminada && !_destinoListo) {
        setState(() => _esperando = true);
      }
    });
    if (!_reducida) _entrada.forward();
  }

  void _alCompletarEntrada(AnimationStatus estado) {
    if (estado != AnimationStatus.completed || _reducida) return;
    _minimoCumplido = true;
    _intentarSalir();
  }

  void _alCompletarFundido(AnimationStatus estado) {
    if (estado == AnimationStatus.completed) _terminar();
  }

  void _intentarSalir() {
    if (!mounted || _terminada || !_minimoCumplido || !_destinoListo) return;
    if (_reducida) {
      _terminar();
    } else if (!_fundido.isAnimating) {
      _fundido.forward();
    }
  }

  void _programarSalida() {
    if (_terminada || _salidaProgramada || !_minimoCumplido || !_destinoListo) {
      return;
    }
    _salidaProgramada = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _salidaProgramada = false;
      _intentarSalir();
    });
  }

  void _terminar() {
    if (!mounted || _terminada) return;
    _umbralEspera?.cancel();
    setState(() => _terminada = true);
  }

  @override
  void dispose() {
    _umbralEspera?.cancel();
    _entrada.dispose();
    _fundido.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final sesion = ref.watch(sesionProvider);
    final perfil = ref.watch(perfilProvider);
    _destinoListo =
        (sesion.hasValue || sesion.hasError) &&
        (sesion.value == null || perfil.hasValue || perfil.hasError);
    _programarSalida();
    return AmbitoApertura(
      enCurso: !_terminada,
      child: Stack(
        fit: StackFit.expand,
        children: [
          ExcludeFocus(
            excluding: !_terminada,
            child: ExcludeSemantics(
              excluding: !_terminada,
              child: IgnorePointer(ignoring: !_terminada, child: widget.child),
            ),
          ),
          if (!_terminada)
            AnimatedBuilder(
              animation: _animaciones,
              builder: (context, _) {
                final proporcion =
                    TemaSuperaPaes.movimientoLento.inMilliseconds /
                    (TemaSuperaPaes.movimientoLento +
                            TemaSuperaPaes.pausaApertura)
                        .inMilliseconds;
                final avance = Interval(
                  0,
                  proporcion,
                  curve: TemaSuperaPaes.curvaEnfasis,
                ).transform(_entrada.value);
                return Opacity(
                  key: const ValueKey('fundido-apertura'),
                  opacity: 1 - _fundido.value,
                  child: PantallaCargando(
                    key: const ValueKey('apertura-inicial'),
                    avance: avance,
                    esperando: _esperando && !_destinoListo,
                  ),
                );
              },
            ),
        ],
      ),
    );
  }
}
