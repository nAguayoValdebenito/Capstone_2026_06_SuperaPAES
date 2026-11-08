import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supera_paes/dominio/entidades/documento_legal.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/mis_datos/estado_mis_datos.dart';

/// A07b informa cambios menores; no acepta documentos por el estudiante ni
/// resuelve aquí la aceptación de una versión mayor (RN-27 y RN-30).
final cambiosMenoresProvider = FutureProvider<List<DocumentoLegal>>((
  ref,
) async {
  final id = ref.watch(sesionProvider.select((s) => s.value?.estudiante.id));
  if (id == null) return const [];
  final vigentes = await ref.watch(documentosVigentesProvider.future);
  final cuenta = await ref
      .watch(repositorioMisDatosProvider)
      .estadoDeLaCuenta();
  return [
    for (final documento in vigentes)
      if (cuenta.documentosAceptados.any(
        (aceptado) =>
            aceptado.tipo == documento.tipo &&
            esCambioMenor(aceptado.version, documento.version),
      ))
        documento,
  ];
});

bool esCambioMenor(String anterior, String vigente) {
  final antes = anterior.split('.').map(int.tryParse).toList();
  final ahora = vigente.split('.').map(int.tryParse).toList();
  return antes.length == 2 &&
      ahora.length == 2 &&
      antes.every((v) => v != null) &&
      ahora.every((v) => v != null) &&
      antes[0] == ahora[0] &&
      ahora[1]! > antes[1]!;
}

class AvisoCambioMenor extends ConsumerStatefulWidget {
  const AvisoCambioMenor({super.key});
  @override
  ConsumerState<AvisoCambioMenor> createState() => _AvisoCambioMenorState();
}

class _AvisoCambioMenorState extends ConsumerState<AvisoCambioMenor> {
  final _vistos = <String>{};
  @override
  Widget build(BuildContext context) {
    // Un cambio de cuenta no hereda el descarte visual de la anterior.
    final id = ref.watch(sesionProvider).value?.estudiante.id;
    final cambios = ref.watch(cambiosMenoresProvider).value ?? const [];
    final pendiente = cambios
        .where((d) => !_vistos.contains('$id-${d.id}'))
        .firstOrNull;
    if (pendiente == null) return const SizedBox.shrink();
    return Semantics(
      liveRegion: true,
      child: Column(
        children: [
          Aviso(
            tono: TonoAviso.info,
            texto:
                'Actualizamos ${pendiente.nombre} a la versión '
                '${pendiente.version} con cambios menores.',
          ),
          Wrap(
            children: [
              TextButton(
                onPressed: () => context.push(
                  pendiente.tipo == TipoDocumentoLegal.terminos
                      ? Rutas.terminos
                      : Rutas.privacidad,
                ),
                child: const Text('Ver cambios'),
              ),
              TextButton(
                onPressed: () =>
                    setState(() => _vistos.add('$id-${pendiente.id}')),
                child: const Text('Entendido'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
