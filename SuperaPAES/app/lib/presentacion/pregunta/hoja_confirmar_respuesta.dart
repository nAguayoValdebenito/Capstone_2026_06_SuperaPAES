import 'package:flutter/material.dart';

import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';

/// A18 · Confirmar respuesta (HU-32 esc. 4, CU-07 paso 2, RN-07): en la
/// práctica la corrección es inmediata, así que la respuesta no se puede
/// cambiar después. Devuelve `true` si el estudiante confirma; cerrar la
/// hoja o «Cambiar alternativa» vuelve a la pregunta con su elección.
Future<bool> confirmarRespuesta(BuildContext context, String letra) async {
  final confirmo = await showModalBottomSheet<bool>(
    context: context,
    // Sobre la barra inferior; la pregunta se sigue viendo detrás.
    useRootNavigator: true,
    isScrollControlled: true,
    backgroundColor: TemaSuperaPaes.superficie,
    barrierColor: TemaSuperaPaes.texto.withValues(alpha: 0.5),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(
        top: Radius.circular(TemaSuperaPaes.radioHoja),
      ),
    ),
    builder: (contexto) => HojaConfirmarRespuesta(letra: letra),
  );
  return confirmo ?? false;
}

class HojaConfirmarRespuesta extends StatelessWidget {
  const HojaConfirmarRespuesta({required this.letra, super.key});

  final String letra;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          TemaSuperaPaes.margenPantalla,
          24,
          TemaSuperaPaes.margenPantalla,
          TemaSuperaPaes.margenPantalla,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Semantics(
              header: true,
              child: Text(
                '¿Confirmas la alternativa $letra?',
                style: TemaSuperaPaes.h2,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'En la práctica la corrección es inmediata, así que después no '
              'podrás cambiarla.',
              style: TemaSuperaPaes.cuerpo.copyWith(
                color: TemaSuperaPaes.textoSecundario,
              ),
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Confirmar'),
            ),
            const SizedBox(height: 8),
            BotonTexto(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Cambiar alternativa'),
            ),
          ],
        ),
      ),
    );
  }
}
