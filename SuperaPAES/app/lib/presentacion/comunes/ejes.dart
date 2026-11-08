import 'package:flutter/material.dart';

import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/animados.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/movimiento.dart';

/// Nivel de un eje: texto, ícono y tono, además del color (RN-14 marca
/// «Reforzar» bajo 60 %): «Firme» ✓, «En camino» ↗ y «Reforzar» ⚑ con
/// destacador.
({String texto, IconData icono, TonoEtiqueta tono}) nivelDeEje(double valor) {
  if (valor < 0.6) {
    return (
      texto: 'Reforzar',
      icono: Icons.flag_rounded,
      tono: TonoEtiqueta.aviso,
    );
  }
  if (valor < 0.7) {
    return (
      texto: 'En camino',
      icono: Icons.trending_up_rounded,
      tono: TonoEtiqueta.primario,
    );
  }
  return (
    texto: 'Firme',
    icono: Icons.check_circle_rounded,
    tono: TonoEtiqueta.exito,
  );
}

/// Un eje con su nivel, su porcentaje y su barra. Las barras de varios ejes
/// se llenan escalonadas (40 ms entre ellas, máximo 6). Todas van en azul: el
/// nivel lo dicen el ícono y la etiqueta.
class FilaEje extends StatelessWidget {
  const FilaEje({
    required this.nombre,
    required this.valor,
    required this.indice,
    super.key,
    this.mostrarNivel = true,
  });

  final String nombre;

  /// De 0 a 1.
  final double valor;

  /// Posición en la lista, para escalonar la barra.
  final int indice;

  /// El resultado usa las marcas del servidor, sin recalcular RN-14.
  final bool mostrarNivel;

  @override
  Widget build(BuildContext context) {
    final nivel = nivelDeEje(valor);
    final retraso =
        duracion(context, TemaSuperaPaes.pasoEscalonado) *
        (indice.clamp(0, TemaSuperaPaes.topeEscalonado - 1) + 2);
    return Semantics(
      label:
          '$nombre: ${(valor * 100).round()} %'
          '${mostrarNivel ? ', ${nivel.texto}' : ''}',
      child: ExcludeSemantics(
        child: Padding(
          padding: const EdgeInsets.symmetric(
            vertical: TemaSuperaPaes.espacio8,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Wrap(
                alignment: WrapAlignment.spaceBetween,
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: TemaSuperaPaes.espacio8,
                runSpacing: TemaSuperaPaes.espacio4,
                children: [
                  Text(nombre, style: TemaSuperaPaes.cuerpoFuerte),
                  Wrap(
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: TemaSuperaPaes.espacio8,
                    children: [
                      if (mostrarNivel)
                        Etiqueta(
                          texto: nivel.texto,
                          tono: nivel.tono,
                          icono: nivel.icono,
                        ),
                      Text(
                        '${(valor * 100).round()} %',
                        style: TemaSuperaPaes.tabular(
                          TemaSuperaPaes.cuerpoFuerte,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 6),
              BarraAnimada(valor: valor, retraso: retraso),
            ],
          ),
        ),
      ),
    );
  }
}
