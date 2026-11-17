import 'dart:async';

import 'package:clock/clock.dart';
import 'package:flutter/material.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/trazo.dart';

/// Usa exclusivamente la fecha de reinicio recibida de la API.
class CuentaRegresivaCupo extends StatefulWidget {
  const CuentaRegresivaCupo({required this.reiniciaEn, super.key});
  final DateTime reiniciaEn;
  @override
  State<CuentaRegresivaCupo> createState() => _CuentaRegresivaCupoState();
}

class _CuentaRegresivaCupoState extends State<CuentaRegresivaCupo> {
  late final Timer _reloj;
  @override
  void initState() {
    super.initState();
    _reloj = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _reloj.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final diferencia = widget.reiniciaEn.difference(clock.now());
    final segundos = diferencia.isNegative ? 0 : diferencia.inSeconds;
    String dos(int valor) => valor.toString().padLeft(2, '0');
    return Wrap(
      spacing: TemaSuperaPaes.espacio16,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        const Trazo(ancho: 56),
        Semantics(
          label:
              'Reinicio del cupo en ${segundos ~/ 3600} horas '
              'y ${segundos ~/ 60 % 60} minutos',
          child: ExcludeSemantics(
            child: Text(
              '${dos(segundos ~/ 3600)}:${dos(segundos ~/ 60 % 60)}:'
              '${dos(segundos % 60)}',
              style: TemaSuperaPaes.numero.copyWith(
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
