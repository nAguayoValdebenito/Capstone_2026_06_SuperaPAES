import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/inicio/estado_inicio.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';

/// «✕ Terminar» y las preguntas que quedan hoy (cupo y extra), arriba de la
/// pregunta (A17) y de su corrección (A19).
class CabeceraPractica extends ConsumerWidget {
  const CabeceraPractica({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cupo = ref.watch(cupoDeHoyProvider).value;
    // Wrap: con letra grande, las preguntas que quedan bajan a otra línea.
    return Wrap(
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.center,
      runSpacing: 8,
      children: [
        TextButton.icon(
          style: TextButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 4),
            minimumSize: Size.zero,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          onPressed: () => terminarPractica(context, ref),
          icon: const Icon(Icons.close, size: 20),
          label: const Text('Terminar'),
        ),
        if (cupo != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: TemaSuperaPaes.primarioSuave,
              borderRadius: BorderRadius.circular(TemaSuperaPaes.radioTarjeta),
            ),
            child: Text.rich(
              TextSpan(
                children: [
                  const TextSpan(text: 'Hoy te quedan '),
                  TextSpan(
                    text: '${cupo.restantes + cupo.saldoExtra}',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ],
              ),
              style: TemaSuperaPaes.pequeno.copyWith(
                color: TemaSuperaPaes.primarioOscuro,
              ),
            ),
          ),
      ],
    );
  }
}

/// «M2 · Logaritmos · Mezcla», «Pregunta 4 de 10» y la barra del avance.
/// Con [respondida], la barra cuenta también esta pregunta (A19).
class AvancePractica extends ConsumerWidget {
  const AvancePractica({
    required this.pregunta,
    super.key,
    this.respondida = false,
  });

  final PreguntaDePractica pregunta;
  final bool respondida;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final datos = ref.watch(practicaProvider).datos;
    final nombres = ref.watch(opcionesPerfilProvider).value;
    final dificultades =
        ref.watch(opcionesPracticaProvider).value?.dificultades ?? const [];
    final secundario = TemaSuperaPaes.pequeno.copyWith(
      color: TemaSuperaPaes.textoSecundario,
    );
    final descripcion = datos == null
        ? ''
        : [
            ?nombres?.prueba(datos.pruebaId)?.nombreCorto,
            ?datos.alcance.nombre,
            [
                  for (final d in dificultades)
                    if (d.id == datos.dificultadId) d.nombre,
                ].firstOrNull ??
                'Mezcla',
          ].join(' · ');
    final hechas = (pregunta.orden - (respondida ? 0 : 1)) / pregunta.total;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          alignment: WrapAlignment.spaceBetween,
          spacing: 8,
          children: [
            Text(descripcion, style: secundario),
            Text(
              'Pregunta ${pregunta.orden} de ${pregunta.total}',
              style: secundario,
            ),
          ],
        ),
        const SizedBox(height: 8),
        ExcludeSemantics(
          child: Container(
            height: TemaSuperaPaes.altoAvance,
            alignment: Alignment.centerLeft,
            decoration: BoxDecoration(
              color: TemaSuperaPaes.neutroSuave,
              borderRadius: BorderRadius.circular(TemaSuperaPaes.altoAvance),
            ),
            child: FractionallySizedBox(
              widthFactor: hechas.clamp(0, 1),
              heightFactor: 1,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: TemaSuperaPaes.primario,
                  borderRadius: BorderRadius.circular(
                    TemaSuperaPaes.altoAvance,
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Cierra la práctica y abre su resumen (A21). Con `preguntar`, antes avisa
/// que las preguntas sin responder quedan como omitidas.
Future<void> terminarPractica(
  BuildContext context,
  WidgetRef ref, {
  bool preguntar = true,
}) async {
  if (preguntar) {
    final terminar = await showDialog<bool>(
      context: context,
      builder: (contexto) => AlertDialog(
        title: const Text('¿Terminar la práctica?'),
        content: const Text(
          'Las preguntas que no respondiste quedan sin responder en tu '
          'resumen.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(contexto).pop(false),
            child: const Text('Seguir practicando'),
          ),
          TextButton(
            onPressed: () => Navigator.of(contexto).pop(true),
            child: const Text('Terminar'),
          ),
        ],
      ),
    );
    if (terminar != true) return;
  }
  try {
    await ref.read(practicaProvider.notifier).cerrar();
    if (context.mounted) context.go(Rutas.resumenPractica);
  } on ErrorApi catch (error) {
    if (context.mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.mensaje)));
    }
  }
}
