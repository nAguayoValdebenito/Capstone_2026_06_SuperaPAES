import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/evaluacion_con_tiempo.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/evaluaciones/cabecera_con_reloj.dart';
import 'package:supera_paes/presentacion/evaluaciones/estado_evaluaciones.dart';
import 'package:supera_paes/presentacion/pregunta/cuerpo_pregunta.dart';

/// Pregunta con reloj (A27; HU-40 esc. 2, CU-10 pasos 5 y 6, RN-07 y
/// RN-21): el tiempo que queda, sin corrección al responder. Tocar una
/// alternativa la guarda y se puede cambiar hasta entregar; se avanza, se
/// vuelve atrás, se ven todas o se entrega (A28).
class PantallaPreguntaConReloj extends ConsumerWidget {
  const PantallaPreguntaConReloj({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final enCurso = ref.watch(evaluacionConTiempoProvider);
    if (enCurso == null || enCurso.preguntas.isEmpty) {
      return const SinEvaluacionEnCurso();
    }
    // La clave vuelve arriba y limpia el aviso con cada pregunta.
    return _VistaPregunta(
      key: ValueKey(enCurso.pregunta.itemId),
      pregunta: enCurso.pregunta,
      total: enCurso.preguntas.length,
      indice: enCurso.actual,
    );
  }
}

class _VistaPregunta extends ConsumerStatefulWidget {
  const _VistaPregunta({
    required this.pregunta,
    required this.total,
    required this.indice,
    super.key,
  });

  final PreguntaConTiempo pregunta;
  final int total;
  final int indice;

  @override
  ConsumerState<_VistaPregunta> createState() => _VistaPreguntaState();
}

class _VistaPreguntaState extends ConsumerState<_VistaPregunta> {
  /// La alternativa que se está guardando.
  int? _guardando;
  String? _error;

  Future<void> _elegir(int alternativaId) async {
    // La que ya está guardada no se vuelve a mandar.
    if (alternativaId == widget.pregunta.elegidaId) return;
    setState(() {
      _guardando = alternativaId;
      _error = null;
    });
    try {
      await ref
          .read(evaluacionConTiempoProvider.notifier)
          .responder(widget.pregunta.itemId, alternativaId);
    } on ErrorApi catch (error) {
      if (!mounted) return;
      // Se acabó el tiempo según el servidor: se entrega con lo guardado.
      if (error.codigo == 'EVALUACION_CERRADA') {
        unawaited(entregarEvaluacion(context, ref));
        return;
      }
      setState(() => _error = error.mensaje);
    } finally {
      if (mounted) setState(() => _guardando = null);
    }
  }

  void _ir(int diferencia) => ref
      .read(evaluacionConTiempoProvider.notifier)
      .irA(widget.indice + diferencia);

  @override
  Widget build(BuildContext context) {
    final pregunta = widget.pregunta;
    final elegida = _guardando ?? pregunta.elegidaId;
    final esLaUltima = widget.indice >= widget.total - 1;
    return PantallaFormulario(
      anchoMaximo: TemaSuperaPaes.anchoLectura,
      separacion: 14,
      hijos: [
        const CabeceraConReloj(),
        Text(
          'Pregunta ${widget.indice + 1} de ${widget.total}',
          style: TemaSuperaPaes.pequeno.copyWith(
            color: TemaSuperaPaes.textoSecundario,
          ),
        ),
        ...cuerpoDePregunta(
          texto: pregunta.texto,
          enunciado: pregunta.enunciado,
          alternativas: pregunta.alternativas,
          elegida: elegida,
          alElegir: _guardando == null ? _elegir : null,
        ),
        if (_error case final error?)
          Aviso(tono: TonoAviso.error, texto: error)
        else if (_guardando != null)
          const Aviso(tono: TonoAviso.neutro, texto: 'Guardando tu respuesta…')
        else if (pregunta.respondida)
          const Aviso(
            tono: TonoAviso.exito,
            texto: 'Respuesta guardada. Puedes cambiarla hasta entregar.',
          ),
      ],
      pie: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: widget.indice == 0 ? null : () => _ir(-1),
                  child: const Text('Anterior'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: esLaUltima ? null : () => _ir(1),
                  child: const Text('Siguiente'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Expanded(
                child: TextButton(
                  onPressed: () => context.push(Rutas.verTodas),
                  child: const Text('Ver todas'),
                ),
              ),
              Expanded(
                child: TextButton(
                  onPressed: () => context.push(Rutas.verTodas),
                  child: const Text('Entregar'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
