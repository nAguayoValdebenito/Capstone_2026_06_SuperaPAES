import 'package:flutter/material.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/sello_prueba.dart';

/// Comparte el navegador de Historial para que el Hero tenga origen y destino.
class SelloResultado extends StatelessWidget {
  const SelloResultado({
    required this.id,
    required this.codigo,
    required this.animar,
    super.key,
  });
  final int id;
  final String? codigo;
  final bool animar;
  @override
  Widget build(BuildContext context) => HeroMode(
    enabled: animar,
    child: Hero(
      tag: 'sello-evaluacion-$id',
      flightShuttleBuilder: (_, animacion, direccion, origen, destino) =>
          Material(
            type: MaterialType.transparency,
            child: SelloPrueba(
              Prueba.deCodigo(codigo ?? ''),
              key: ValueKey('vuelo-sello-$id'),
            ),
          ),
      child: SelloPrueba(Prueba.deCodigo(codigo ?? '')),
    ),
  );
}
