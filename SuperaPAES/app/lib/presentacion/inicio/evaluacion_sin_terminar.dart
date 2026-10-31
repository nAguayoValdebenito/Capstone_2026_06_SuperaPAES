import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/evaluacion_abierta.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/inicio/hoja_retomar_evaluacion.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';
import 'package:supera_paes/presentacion/resultado/estado_resultado.dart';

/// Lo que quedó sin terminar, en Inicio (A12; HU-60, CU-28): «Práctica sin
/// terminar» con «Seguir», la evaluación con tiempo con «Continuar» (A29) o,
/// si el servidor la cerró al consultarla, el aviso con su resultado. El
/// repaso sin terminar se agrega con su historia (HU-39). Sin nada, no
/// ocupa lugar.
class EvaluacionSinTerminar extends ConsumerWidget {
  const EvaluacionSinTerminar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final consulta = ref.watch(evaluacionAbiertaProvider).value;
    if (consulta?.cerrada case final cerrada?) {
      return _Cerrada(cerrada: cerrada);
    }
    final abierta = consulta?.abierta;
    if (abierta == null || !(abierta.esPractica || abierta.conTiempo)) {
      return const SizedBox.shrink();
    }
    return _Tarjeta(
      titulo: '${abierta.tipoNombre} sin terminar',
      detalle:
          '${abierta.prueba} · ${abierta.respondidas} de '
          '${abierta.cantidad} respondidas',
      boton: abierta.conTiempo ? 'Continuar' : 'Seguir',
      onPressed: () async {
        if (abierta.conTiempo) {
          await ofrecerRetomar(context, ref, abierta);
        } else {
          ref.read(practicaProvider.notifier).retomar(abierta);
          context.go(Rutas.pregunta);
        }
      },
    );
  }
}

/// La que se cerró al consultarla: por tiempo (RN-21) o por 2 horas sin
/// actividad (RN-19). Lo respondido quedó guardado.
class _Cerrada extends ConsumerWidget {
  const _Cerrada({required this.cerrada});

  final EvaluacionRecienCerrada cerrada;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tipo = cerrada.tipoNombre.toLowerCase();
    return _Tarjeta(
      titulo: cerrada.porTiempo
          ? 'Se acabó el tiempo de tu $tipo'
          : 'Tu $tipo se cerró por inactividad',
      detalle: cerrada.porTiempo
          ? 'Se corrigió con lo que respondiste.'
          : 'Pasaron 2 horas sin actividad. Lo que respondiste quedó '
                'guardado.',
      boton: 'Ver resultado',
      onPressed: () => abrirResultado(context, ref, cerrada.id),
    );
  }
}

/// Tarjeta con un título gris, el detalle y un botón chico a la derecha,
/// que baja de línea con letra grande (RNF-12).
class _Tarjeta extends StatelessWidget {
  const _Tarjeta({
    required this.titulo,
    required this.detalle,
    required this.boton,
    required this.onPressed,
  });

  final String titulo;
  final String detalle;
  final String boton;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Tarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            titulo,
            style: TemaSuperaPaes.etiqueta.copyWith(
              color: TemaSuperaPaes.textoSecundario,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 12,
            runSpacing: 8,
            children: [
              Text(detalle, style: TemaSuperaPaes.cuerpoFuerte),
              BotonChico(texto: boton, onPressed: onPressed),
            ],
          ),
        ],
      ),
    );
  }
}
