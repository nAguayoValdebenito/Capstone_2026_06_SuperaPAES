import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/animados.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/comunes/movimiento.dart';
import 'package:supera_paes/presentacion/evaluaciones/estado_evaluaciones.dart';
import 'package:supera_paes/presentacion/inicio/hoja_retomar_evaluacion.dart';

enum FaseReloj { normal, cincoMinutos, ultimoMinuto }

FaseReloj faseReloj(int segundos) => segundos <= 60
    ? FaseReloj.ultimoMinuto
    : segundos <= 300
    ? FaseReloj.cincoMinutos
    : FaseReloj.normal;

/// Memoria compartida entre A27 y A28: cada aviso se anuncia una sola vez.
class AvisosReloj extends Notifier<Map<int, Set<FaseReloj>>> {
  @override
  Map<int, Set<FaseReloj>> build() {
    ref.watch(sesionProvider.select((s) => s.value?.estudiante.id));
    return {};
  }

  String? registrar(int id, int segundos) {
    if (segundos <= 0 || segundos > 300) return null;
    final fase = faseReloj(segundos);
    if (state[id]?.contains(fase) ?? false) return null;
    state = {
      ...state,
      id: {
        ...?state[id],
        fase,
        if (fase == FaseReloj.ultimoMinuto) FaseReloj.cincoMinutos,
      },
    };
    return fase == FaseReloj.ultimoMinuto
        ? 'Queda 1 minuto. Revisa tus respuestas antes de entregar.'
        : 'Quedan 5 minutos. Puedes revisar tus respuestas.';
  }
}

final avisosRelojProvider =
    NotifierProvider<AvisosReloj, Map<int, Set<FaseReloj>>>(AvisosReloj.new);

class RelojEvaluacion extends ConsumerStatefulWidget {
  const RelojEvaluacion({required this.alVencer, this.alAviso, super.key});
  final VoidCallback alVencer;
  final ValueChanged<String?>? alAviso;
  @override
  ConsumerState<RelojEvaluacion> createState() => _RelojEvaluacionState();
}

class _RelojEvaluacionState extends ConsumerState<RelojEvaluacion>
    with WidgetsBindingObserver {
  Timer? _reloj;
  Timer? _ocultar;
  String? _aviso;
  bool _entregada = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _reloj = Timer.periodic(const Duration(seconds: 1), (_) => _avanzar());
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _avanzar();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState estado) {
    if (estado == AppLifecycleState.resumed) _avanzar();
  }

  void _avanzar() {
    final curso = ref.read(evaluacionConTiempoProvider);
    if (curso == null || !mounted) return;
    setState(() {});
    if (!(ModalRoute.of(context)?.isCurrent ?? true)) return;
    final segundos = curso.segundosRestantes;
    if (segundos <= 0) {
      _reloj?.cancel();
      if (!_entregada) {
        _entregada = true;
        widget.alVencer();
      }
      return;
    }
    final aviso = ref
        .read(avisosRelojProvider.notifier)
        .registrar(curso.evaluacion.id, segundos);
    if (aviso == null) return;
    setState(() => _aviso = aviso);
    widget.alAviso?.call(aviso);
    unawaited(
      SemanticsService.sendAnnouncement(
        View.of(context),
        aviso,
        Directionality.of(context),
      ),
    );
    _ocultar?.cancel();
    _ocultar = Timer(const Duration(seconds: 3), () {
      if (mounted) {
        setState(() => _aviso = null);
        widget.alAviso?.call(null);
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _reloj?.cancel();
    _ocultar?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final curso = ref.watch(evaluacionConTiempoProvider);
    final segundos = curso?.segundosRestantes ?? 0;
    final total =
        curso?.evaluacion.duracionSegundos ??
        curso?.evaluacion.segundosRestantes ??
        1;
    final fase = faseReloj(segundos);
    final (fondo, tinta) = switch (fase) {
      FaseReloj.normal => (TemaSuperaPaes.neutroSuave, TemaSuperaPaes.texto),
      FaseReloj.cincoMinutos => (
        TemaSuperaPaes.logoOscuro,
        TemaSuperaPaes.superficie,
      ),
      FaseReloj.ultimoMinuto => (
        TemaSuperaPaes.errorSuave,
        TemaSuperaPaes.errorTexto,
      ),
    };
    return SizedBox(
      width: TemaSuperaPaes.anchoReloj,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            label: 'Tiempo que te queda: ${relojDe(segundos)}',
            child: ExcludeSemantics(
              child: AnimatedContainer(
                key: const ValueKey('fase-reloj'),
                duration: duracion(context, TemaSuperaPaes.transicionReloj),
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: fondo,
                  borderRadius: BorderRadius.circular(
                    TemaSuperaPaes.radioTarjeta,
                  ),
                ),
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Row(
                    children: [
                      Icon(Icons.timer_outlined, size: 16, color: tinta),
                      const SizedBox(width: 6),
                      Text(
                        relojDe(segundos),
                        style: TemaSuperaPaes.tabular(
                          TemaSuperaPaes.pequenoFuerte.copyWith(color: tinta),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 4),
          BarraAnimada(
            valor: total <= 0 ? 0 : (segundos / total).clamp(0, 1),
            alto: TemaSuperaPaes.altoBarraReloj,
            color: fase == FaseReloj.ultimoMinuto
                ? TemaSuperaPaes.error
                : TemaSuperaPaes.logoOscuro,
          ),
          if (_aviso != null && widget.alAviso == null) ...[
            const SizedBox(height: 6),
            Text(
              _aviso!,
              style: TemaSuperaPaes.pequeno,
              key: const ValueKey('aviso-reloj'),
            ),
          ],
        ],
      ),
    );
  }
}
