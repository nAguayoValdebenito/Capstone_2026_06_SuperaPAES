import 'package:flutter/material.dart';

import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';

/// Abre la hoja que sube desde abajo (A18, A29, A41) sobre la barra
/// inferior y devuelve lo que la hoja entregue al cerrarse; `null` si se
/// cierra sin elegir.
Future<T?> mostrarHoja<T>(BuildContext context, Widget hoja) =>
    showModalBottomSheet<T>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: TemaSuperaPaes.superficie,
      barrierColor: TemaSuperaPaes.texto.withValues(alpha: 0.5),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(TemaSuperaPaes.radioHoja),
        ),
      ),
      builder: (contexto) => hoja,
    );

/// Como [mostrarHoja]: `true` si el estudiante confirma; cerrarla o
/// «cancelar» es `false`.
Future<bool> confirmarEnHoja(BuildContext context, Widget hoja) async =>
    await mostrarHoja<bool>(context, hoja) ?? false;

/// Hoja con un título, su contenido, el botón que confirma y el que vuelve
/// atrás.
class HojaConfirmacion extends StatelessWidget {
  const HojaConfirmacion({
    required this.titulo,
    required this.contenido,
    required this.confirmar,
    required this.cancelar,
    super.key,
  });

  final String titulo;
  final Widget contenido;
  final String confirmar;
  final String cancelar;

  @override
  Widget build(BuildContext context) {
    // Con letra grande, la hoja se desplaza en vez de cortarse (RNF-12).
    return SafeArea(
      child: SingleChildScrollView(
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
              child: Text(titulo, style: TemaSuperaPaes.h2),
            ),
            const SizedBox(height: 8),
            contenido,
            const SizedBox(height: 20),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: Text(confirmar),
            ),
            const SizedBox(height: 8),
            BotonTexto(
              onPressed: () => Navigator.of(context).pop(false),
              child: Text(cancelar),
            ),
          ],
        ),
      ),
    );
  }
}
