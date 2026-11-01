import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/dominio/entidades/evaluacion_con_tiempo.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/error_con_reintento.dart';
import 'package:supera_paes/presentacion/evaluaciones/condiciones_evaluacion.dart';
import 'package:supera_paes/presentacion/evaluaciones/empezar_con_tiempo.dart';
import 'package:supera_paes/presentacion/evaluaciones/estado_evaluaciones.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';

/// Antes de empezar el ensayo completo (A26 del ensayo; HU-42 esc. 1 y 3,
/// CU-10c, RF-A19, RN-04, RN-21 a RN-23): las condiciones de A26, más el
/// temario completo en formato oficial, las preguntas que no puntúan y el
/// puntaje estimado al entregar. Solo con el plan Todas las pruebas.
class PantallaAntesDelEnsayo extends ConsumerStatefulWidget {
  const PantallaAntesDelEnsayo({super.key});

  @override
  ConsumerState<PantallaAntesDelEnsayo> createState() =>
      _PantallaAntesDelEnsayoState();
}

class _PantallaAntesDelEnsayoState extends ConsumerState<PantallaAntesDelEnsayo>
    with EmpezarConTiempo {
  @override
  Widget build(BuildContext context) {
    final pruebaId = ref.watch(pruebaDeEvaluacionesProvider);
    final prueba = pruebaId == null
        ? null
        : ref.watch(opcionesPerfilProvider).value?.prueba(pruebaId);
    if (pruebaId == null || prueba == null) {
      return const PantallaFormulario(
        hijos: [
          EnlaceVolver(texto: 'Evaluaciones', destino: Rutas.evaluaciones),
          Encabezado(
            titulo: 'Elige una prueba',
            bajada: 'Vuelve a Evaluaciones y elige qué ensayo rendir.',
          ),
        ],
      );
    }
    final consulta = ref.watch(disponibilidadEnsayoProvider(pruebaId));
    final ensayo = consulta.value;
    return PantallaFormulario(
      separacion: 14,
      hijos: [
        const EnlaceVolver(texto: 'Evaluaciones', destino: Rutas.evaluaciones),
        Encabezado(titulo: 'Ensayo completo', bajada: prueba.nombreEnInicio),
        ...switch (consulta) {
          AsyncData(:final value) => _condiciones(value),
          AsyncError(:final error) => [
            ErrorConReintento(
              error: error,
              mensaje: 'No se pudo cargar el ensayo.',
              alReintentar: () =>
                  ref.invalidate(disponibilidadEnsayoProvider(pruebaId)),
            ),
          ],
          _ => const [Center(child: CircularProgressIndicator())],
        },
      ],
      pie: PieConError(
        error: errorConTiempo,
        boton: FilledButton(
          onPressed: ensayo == null || !ensayo.disponible || empezandoConTiempo
              ? null
              : () => empezarConTiempo(
                  () => ref
                      .read(evaluacionConTiempoProvider.notifier)
                      .empezarEnsayo(pruebaId),
                  alRechazar: () =>
                      ref.invalidate(disponibilidadEnsayoProvider(pruebaId)),
                ),
          child: empezandoConTiempo
              ? const CargandoEnBoton()
              : const Text('Empezar ahora'),
        ),
      ),
    );
  }

  List<Widget> _condiciones(DisponibilidadEnsayo ensayo) {
    final cierre = avisoDeCierre(ref);
    final sinPuntaje = ensayo.sinPuntaje;
    return [
      Row(
        children: [
          DatoResumen(valor: '${ensayo.cantidad}', texto: 'preguntas'),
          DatoResumen(valor: '${ensayo.duracionMin}', texto: 'minutos'),
          DatoResumen(valor: '$sinPuntaje', texto: 'no puntúan'),
        ],
      ),
      ...condicionesConTiempo,
      CondicionEvaluacion(
        icono: Icons.menu_book_outlined,
        texto: switch (ensayo.textos) {
          final textos? when textos > 0 =>
            'Todo el temario, con el formato oficial: $textos textos '
                'completos con sus preguntas en orden.',
          _ => 'Todo el temario de la prueba, con el formato oficial.',
        },
      ),
      if (sinPuntaje > 0)
        CondicionEvaluacion(
          icono: Icons.help_outline,
          texto:
              '$sinPuntaje preguntas no puntúan, como en la PAES. Sabrás '
              'cuáles al revisar.',
        ),
      const CondicionEvaluacion(
        icono: Icons.emoji_events_outlined,
        texto:
            'Al entregar verás tu puntaje estimado de 100 a 1.000, con la '
            'tabla de conversión del DEMRE más reciente.',
      ),
      if (ensayo.disponible)
        Aviso(
          tono: TonoAviso.info,
          texto: [
            'Está incluido en tu plan Todas las pruebas.',
            ?cierre,
          ].join(' '),
        )
      else
        Aviso(
          tono: TonoAviso.aviso,
          texto: ensayo.faltaElPlan
              ? 'El ensayo completo es parte del plan Todas las pruebas.'
              : 'Elige tu electivo de Ciencias en tu perfil para rendirlo.',
        ),
    ];
  }
}
