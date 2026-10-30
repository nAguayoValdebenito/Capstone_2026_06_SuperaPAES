import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';
import 'package:supera_paes/presentacion/resultado/estado_resultado.dart';

/// Resumen de la práctica (A21; HU-30 esc. 5, CU-06 paso 7): aciertos,
/// incorrectas y tiempo; las incorrectas pasan al repaso y la práctica queda
/// en el historial. «Ver la revisión» abre A33 (HU-61).
class PantallaResumenPractica extends ConsumerWidget {
  const PantallaResumenPractica({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final resumen = ref.watch(practicaProvider).resumen;
    return PantallaFormulario(
      hijos: [
        const SizedBox(height: 32),
        if (resumen == null)
          const Encabezado(
            titulo: 'No hay una práctica terminada',
            bajada: 'Cuando termines una práctica, aquí verás tu resumen.',
            centrado: true,
          )
        else
          ..._resumen(resumen),
      ],
      pie: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (resumen != null) ...[
            OutlinedButton(
              onPressed: () => abrirRevision(context, ref, resumen.id),
              child: const Text('Ver la revisión'),
            ),
            const SizedBox(height: 8),
          ],
          FilledButton(
            onPressed: () => context.go(Rutas.practicar),
            child: const Text('Practicar de nuevo'),
          ),
          const SizedBox(height: 8),
          BotonTexto(
            onPressed: () => context.go(Rutas.inicio),
            child: const Text('Volver al inicio'),
          ),
        ],
      ),
    );
  }

  static List<Widget> _resumen(ResumenPractica resumen) {
    final alcance = resumen.alcance.tipo == TipoAlcance.prueba
        ? resumen.prueba
        : '${resumen.prueba} · ${resumen.alcance.nombre}';
    final dificultad = resumen.dificultad == 'Mezcla'
        ? 'Mezcla de dificultad'
        : 'Dificultad ${resumen.dificultad.toLowerCase()}';
    final secundario = TemaSuperaPaes.pequeno.copyWith(
      color: TemaSuperaPaes.textoSecundario,
    );
    return [
      Column(
        children: [
          Semantics(
            header: true,
            child: const Text(
              'Práctica terminada',
              style: TemaSuperaPaes.h1,
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            alcance,
            style: TemaSuperaPaes.cuerpo,
            textAlign: TextAlign.center,
          ),
          Text(
            '$dificultad · ${resumen.cantidad} preguntas',
            style: secundario,
            textAlign: TextAlign.center,
          ),
        ],
      ),
      Tarjeta(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              '${resumen.correctas}/${resumen.cantidad}',
              style: TemaSuperaPaes.display,
              textAlign: TextAlign.center,
            ),
            Text(
              '${resumen.porcentaje.round()} % de acierto',
              style: TemaSuperaPaes.cuerpo,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                DatoResumen(valor: '${resumen.correctas}', texto: 'correctas'),
                DatoResumen(
                  valor: '${resumen.incorrectas}',
                  texto: 'incorrectas',
                ),
                DatoResumen(
                  valor: tiempoDePractica(resumen.tiempoUsadoSeg),
                  texto: 'tiempo',
                ),
              ],
            ),
          ],
        ),
      ),
      Aviso(tono: TonoAviso.info, textoRico: _aviso(resumen)),
    ];
  }

  /// «Las 3 incorrectas pasaron a **Repasar errores**. La práctica quedó en
  /// tu historial.» Las que quedaron sin responder también cuentan.
  static InlineSpan _aviso(ResumenPractica resumen) {
    final falladas = resumen.incorrectas + resumen.omitidas;
    return TextSpan(
      children: [
        if (falladas == 1)
          const TextSpan(text: 'La pregunta incorrecta pasó a ')
        else if (falladas > 1)
          TextSpan(text: 'Las $falladas incorrectas pasaron a '),
        if (falladas > 0) ...[
          const TextSpan(
            text: 'Repasar errores',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          const TextSpan(text: '. '),
        ],
        const TextSpan(text: 'La práctica quedó en tu historial.'),
      ],
    );
  }
}

/// «12 min», o los segundos si fue menos de un minuto.
String tiempoDePractica(int segundos) =>
    segundos < 60 ? '$segundos s' : '${(segundos / 60).round()} min';
