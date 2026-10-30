import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';

/// Aviso de Inicio mientras el correo no esté verificado (HU-05.2), como en
/// el boceto A12: sin verificar, el cupo es de 10 preguntas diarias (RN-01).
/// Lleva a Verificar correo (A06), que se abre encima para volver a Inicio.
/// Inicio decide cuándo mostrarlo.
class AvisoVerificarCorreo extends StatelessWidget {
  const AvisoVerificarCorreo({super.key});

  /// Desde esta escala de letra, «Verificar» va debajo del texto para que la
  /// fila no se desborde (RNF-12).
  static const double escalaParaApilar = 1.3;

  @override
  Widget build(BuildContext context) {
    final mensaje = Row(
      children: [
        const Icon(
          Icons.mail_outline,
          size: 20,
          color: TemaSuperaPaes.primarioOscuro,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            'Verifica tu correo y sube tu cupo a 20 preguntas diarias.',
            style: TemaSuperaPaes.pequeno.copyWith(
              color: TemaSuperaPaes.primarioOscuro,
            ),
          ),
        ),
      ],
    );
    final boton = BotonChico(
      texto: 'Verificar',
      onPressed: () => context.push(Rutas.verificarCorreo),
    );
    final apilar =
        MediaQuery.textScalerOf(context).scale(1) >= escalaParaApilar;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: TemaSuperaPaes.primarioSuave,
        borderRadius: BorderRadius.circular(TemaSuperaPaes.radioCampo),
      ),
      child: apilar
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                mensaje,
                const SizedBox(height: 10),
                Padding(padding: const EdgeInsets.only(left: 30), child: boton),
              ],
            )
          : Row(
              children: [
                Expanded(child: mensaje),
                const SizedBox(width: 10),
                boton,
              ],
            ),
    );
  }
}
