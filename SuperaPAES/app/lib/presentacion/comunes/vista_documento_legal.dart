import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/dominio/entidades/documento_legal.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/comunes/pantalla_base.dart';
import 'package:supera_paes/presentacion/comunes/texto_documento.dart';

/// Versión vigente de un documento legal (A02 y A02b, RN-30). El texto ya
/// trae su versión y su fecha de vigencia bajo el título.
class VistaDocumentoLegal extends ConsumerWidget {
  const VistaDocumentoLegal({required this.tipo, super.key});

  final TipoDocumentoLegal tipo;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final documentos = ref.watch(documentosVigentesProvider);
    final colorError = Theme.of(context).colorScheme.error;
    return PantallaBase(
      hijos: [
        documentos.when(
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(vertical: 32),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (error, _) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                error is ErrorApi
                    ? error.mensaje
                    : 'No se pudo cargar el documento.',
                style: TextStyle(color: colorError),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: () => ref.invalidate(documentosVigentesProvider),
                child: const Text('Reintentar'),
              ),
            ],
          ),
          data: (lista) {
            final documento = lista.where((d) => d.tipo == tipo).firstOrNull;
            if (documento == null) {
              return Text(
                'Este documento no está disponible por ahora.',
                style: TextStyle(color: colorError),
              );
            }
            return TextoDocumento(documento.texto);
          },
        ),
      ],
    );
  }
}
