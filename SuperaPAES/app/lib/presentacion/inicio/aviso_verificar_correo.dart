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

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: TemaSuperaPaes.primarioSuave,
        borderRadius: BorderRadius.circular(TemaSuperaPaes.radioCampo),
      ),
      child: Row(
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
          const SizedBox(width: 10),
          BotonChico(
            texto: 'Verificar',
            onPressed: () => context.push(Rutas.verificarCorreo),
          ),
        ],
      ),
    );
  }
}
