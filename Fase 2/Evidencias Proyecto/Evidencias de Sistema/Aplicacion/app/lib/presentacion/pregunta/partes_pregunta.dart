import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/animados.dart';
import 'package:supera_paes/presentacion/comunes/estado_usuario.dart';
import 'package:supera_paes/presentacion/comunes/hoja_confirmacion.dart';
import 'package:supera_paes/presentacion/comunes/sello_prueba.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';

/// «✕ Terminar» y las preguntas que quedan hoy (cupo y extra), arriba de la
/// pregunta (A17) y de su corrección (A19).
class CabeceraPractica extends ConsumerWidget {
  const CabeceraPractica({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // El repaso no usa cupo (RN-04): no se muestra lo que queda hoy.
    final esRepaso = ref.watch(practicaProvider).esRepaso;
    final cupo = esRepaso ? null : ref.watch(estadoUsuarioProvider).value;
    final prueba = ref.watch(practicaProvider).enCurso?.pruebaId;
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
            tapTargetSize: MaterialTapTargetSize.padded,
          ),
          onPressed: () => terminarPractica(context, ref),
          icon: const Icon(Icons.close, size: 20),
          label: const Text('Terminar'),
        ),
        if (cupo != null && prueba != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: TemaSuperaPaes.primarioSuave,
              borderRadius: BorderRadius.circular(TemaSuperaPaes.radioTarjeta),
            ),
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: cupo.cubre(prueba)
                        ? 'Incluida en tu plan · '
                        : 'Hoy te quedan ',
                  ),
                  TextSpan(
                    text: cupo.cubre(prueba)
                        ? 'sin límite'
                        : '${cupo.disponibles(prueba)}',
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
    final practica = ref.watch(practicaProvider);
    final datos = practica.datos;
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
            if (practica.esRepaso)
              'Repaso'
            else
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
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (datos != null) ...[
                  SelloPrueba(
                    Prueba.deCodigo(
                      nombres?.prueba(datos.pruebaId)?.codigo ?? '',
                    ),
                    tamano: TemaSuperaPaes.selloCabeceraPractica,
                  ),
                  const SizedBox(width: 8),
                ],
                Flexible(child: Text(descripcion, style: secundario)),
              ],
            ),
            Text(
              'Pregunta ${pregunta.orden} de ${pregunta.total}',
              style: secundario,
            ),
          ],
        ),
        const SizedBox(height: 8),
        BarraAnimada(valor: hechas.clamp(0, 1)),
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
  final esRepaso = ref.read(practicaProvider).esRepaso;
  if (preguntar) {
    final terminar = await confirmarEnHoja(
      context,
      HojaConfirmacion(
        titulo: esRepaso ? '¿Terminar el repaso?' : '¿Terminar la práctica?',
        contenido: const Text(
          'Las preguntas que no respondiste quedan sin responder en tu '
          'resumen.',
        ),
        confirmar: 'Terminar',
        cancelar: esRepaso ? 'Seguir repasando' : 'Seguir practicando',
        confirmarEsPrincipal: false,
      ),
    );
    if (!terminar) return;
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
