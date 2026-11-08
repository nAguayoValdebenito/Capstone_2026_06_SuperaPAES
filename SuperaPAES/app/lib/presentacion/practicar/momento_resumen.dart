import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/animados.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/inicio/estado_inicio.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';

/// Memoria de presentacion: no repetir la celebracion al volver al resumen.
/// Se descarta al cambiar de estudiante; no altera resultados ni cupos.
class ResumenesVistos extends Notifier<Set<int>> {
  @override
  Set<int> build() {
    ref.watch(sesionProvider.select((s) => s.value?.estudiante.id));
    return {};
  }

  void registrar(int id) => state = {...state, id};
}

final resumenesVistosProvider = NotifierProvider<ResumenesVistos, Set<int>>(
  ResumenesVistos.new,
);

class MomentoResumen extends ConsumerStatefulWidget {
  const MomentoResumen({
    required this.resumen,
    required this.marcador,
    required this.tiempo,
    super.key,
  });
  final ResumenPractica resumen;
  final String marcador;
  final String tiempo;
  @override
  ConsumerState<MomentoResumen> createState() => _MomentoResumenState();
}

class _MomentoResumenState extends ConsumerState<MomentoResumen> {
  late final bool _primeraVez;
  @override
  void initState() {
    super.initState();
    _primeraVez = !ref
        .read(resumenesVistosProvider)
        .contains(widget.resumen.id);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        ref.read(resumenesVistosProvider.notifier).registrar(widget.resumen.id);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final resumen = widget.resumen;
    final rachaInicial = ref.watch(practicaProvider).rachaInicial;
    final rachaActual = ref.watch(cupoDeHoyProvider).value?.racha;
    final subio =
        rachaInicial != null &&
        rachaActual != null &&
        rachaActual > rachaInicial;
    // Textos de la maqueta adaptados a los datos disponibles; por aprobar.
    final frase = resumen.porcentaje >= 70
        ? '¡Muy buena práctica! ${widget.marcador.replaceAll('/', ' de ')}.'
        : 'Vas en camino: ${widget.marcador.replaceAll('/', ' de ')}. '
              'Repasa las que fallaste y vuelve a intentarlo.';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(
          child: AnilloAvance(
            valor: (resumen.porcentaje / 100).clamp(0, 1),
            animar: _primeraVez,
            destellos: _primeraVez && resumen.porcentaje >= 70,
            centro: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ContadorAnimado(
                  valor: resumen.porcentaje.round(),
                  estilo: TemaSuperaPaes.display,
                  sufijo: ' %',
                  desde: _primeraVez ? 0 : resumen.porcentaje.round(),
                  duracionBase: _primeraVez
                      ? TemaSuperaPaes.movimientoFoco
                      : Duration.zero,
                ),
                const Text('de acierto', style: TemaSuperaPaes.pequeno),
              ],
            ),
          ),
        ),
        Text(
          widget.marcador,
          textAlign: TextAlign.center,
          style: TemaSuperaPaes.h2,
        ),
        const SizedBox(height: 12),
        Text(
          frase,
          textAlign: TextAlign.center,
          style: TemaSuperaPaes.cuerpoFuerte,
        ),
        if (subio) ...[
          const SizedBox(height: 16),
          Row(
            children: [
              MarcaRacha(encender: _primeraVez),
              const SizedBox(width: 8),
              Expanded(
                child: Destacado(
                  texto:
                      'Tu racha subió a $rachaActual '
                      '${rachaActual == 1 ? 'día' : 'días'}',
                ),
              ),
            ],
          ),
        ],
        const SizedBox(height: 16),
        LineaDatos(
          datos: [
            ('${resumen.correctas}', 'correctas'),
            ('${resumen.incorrectas}', 'incorrectas'),
            (widget.tiempo, 'tiempo'),
          ],
        ),
      ],
    );
  }
}
