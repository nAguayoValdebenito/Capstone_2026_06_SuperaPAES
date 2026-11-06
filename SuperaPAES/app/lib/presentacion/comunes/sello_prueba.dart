import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/animados.dart';
import 'package:supera_paes/presentacion/comunes/glifos.dart';
import 'package:supera_paes/presentacion/comunes/movimiento.dart';

/// Sello de una prueba: su ícono en su tono, sobre su fondo suave. Con
/// [sobreMarca] va en blanco sobre el degradado de «Hoy».
class SelloPrueba extends StatelessWidget {
  const SelloPrueba(
    this.prueba, {
    super.key,
    this.tamano = 40,
    this.sobreMarca = false,
  });

  final Prueba prueba;
  final double tamano;
  final bool sobreMarca;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: Container(
      width: tamano,
      height: tamano,
      decoration: BoxDecoration(
        color: sobreMarca ? TemaSuperaPaes.superficie : prueba.fondo,
        borderRadius: BorderRadius.circular(
          tamano >= 56 ? TemaSuperaPaes.radioMedio : TemaSuperaPaes.radioChico,
        ),
      ),
      child: Center(child: GlifoPrueba(prueba, tamano: tamano * 0.6)),
    ),
  );
}

/// Chip de prueba con sello mini de 20 a la izquierda. Seleccionado:
/// fondo suave de su tono, borde y texto en su tono, peso 700 y un ✓ (no
/// depende solo del color). Zona táctil de 48.
class ChipPrueba extends StatelessWidget {
  const ChipPrueba({
    required this.prueba,
    required this.seleccionado,
    required this.onTap,
    super.key,
  });

  final Prueba prueba;
  final bool seleccionado;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final d = duracion(
      context,
      TemaSuperaPaes.movimientoRapido,
      conservarFundido: true,
    );
    return Semantics(
      selected: seleccionado,
      button: true,
      label: prueba.nombre,
      onTap: onTap,
      child: ExcludeSemantics(
        child: Presionable(
          radio: 24,
          onTap: () {
            unawaited(HapticFeedback.selectionClick());
            onTap();
          },
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              minHeight: TemaSuperaPaes.zonaTactil,
            ),
            child: Center(
              widthFactor: 1,
              child: AnimatedContainer(
                duration: d,
                curve: TemaSuperaPaes.curvaEntrada,
                padding: const EdgeInsets.fromLTRB(6, 6, 14, 6),
                decoration: BoxDecoration(
                  color: seleccionado
                      ? prueba.fondo
                      : TemaSuperaPaes.superficie,
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(
                    color: seleccionado ? prueba.tono : TemaSuperaPaes.borde,
                    width: seleccionado ? 1.5 : 1,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // El sello se queda siempre (identidad); al elegir, su
                    // fondo pasa a blanco y aparece un ✓ al final.
                    SelloPrueba(prueba, tamano: 24, sobreMarca: seleccionado),
                    const SizedBox(width: TemaSuperaPaes.espacio8),
                    Flexible(
                      child: Text(
                        prueba.corto,
                        style: TemaSuperaPaes.etiqueta.copyWith(
                          color: seleccionado
                              ? prueba.tono
                              : TemaSuperaPaes.texto,
                          fontWeight: seleccionado
                              ? FontWeight.w700
                              : FontWeight.w600,
                        ),
                      ),
                    ),
                    // Sin animar el tamaño (solo opacidad, escala, traslación
                    // y color): el ✓ aparece con el cambio de color del chip.
                    if (seleccionado)
                      Padding(
                        padding: const EdgeInsets.only(
                          left: TemaSuperaPaes.espacio4,
                        ),
                        child: Icon(
                          Icons.check_rounded,
                          size: 18,
                          color: prueba.tono,
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Fila de chips de prueba que pasa a la línea siguiente.
class ChipsDePrueba extends StatelessWidget {
  const ChipsDePrueba({
    required this.pruebas,
    required this.seleccionada,
    required this.onChanged,
    super.key,
  });

  final List<Prueba> pruebas;
  final Prueba seleccionada;
  final ValueChanged<Prueba> onChanged;

  @override
  Widget build(BuildContext context) => Wrap(
    spacing: TemaSuperaPaes.espacio8,
    children: [
      for (final p in pruebas)
        ChipPrueba(
          prueba: p,
          seleccionado: p == seleccionada,
          onTap: () => onChanged(p),
        ),
    ],
  );
}
