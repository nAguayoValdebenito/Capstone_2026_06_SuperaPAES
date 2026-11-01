import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/evaluaciones/estado_evaluaciones.dart';
import 'package:supera_paes/presentacion/evaluaciones/tarjetas_evaluaciones.dart';
import 'package:supera_paes/presentacion/inicio/evaluacion_sin_terminar.dart';
import 'package:supera_paes/presentacion/inicio/pruebas_inicio.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';

/// Pestaña Evaluaciones (A25; HU-36, HU-40 y HU-42, CU-10 pasos 1 y 2,
/// alternativo 2.a): diagnóstico, mini-ensayo y ensayo completo de la prueba
/// elegida. Cada uno muestra si está disponible según el plan y los usos y,
/// si no, el motivo y la opción. Arriba, lo que quedó sin terminar.
class PantallaEvaluaciones extends ConsumerWidget {
  const PantallaEvaluaciones({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final perfil = ref.watch(perfilProvider);
    final nombres = ref.watch(opcionesPerfilProvider);
    final error = perfil.error ?? nombres.error;
    final datos = (perfil.value, nombres.value);
    final pruebaId = switch (datos.$1) {
      final guardado? => _pruebaElegida(
        ref.watch(pruebaDeEvaluacionesProvider),
        guardado,
      ),
      null => null,
    };
    return PantallaFormulario(
      separacion: 14,
      alActualizar: () async {
        ref.invalidate(evaluacionAbiertaProvider);
        if (pruebaId != null) {
          ref
            ..invalidate(disponibilidadMiniProvider(pruebaId))
            ..invalidate(disponibilidadDiagnosticoProvider(pruebaId));
        }
      },
      hijos: [
        const Encabezado(
          titulo: 'Evaluaciones',
          bajada: 'Con tiempo, como la PAES real. No usan tu cupo.',
        ),
        if (error != null)
          Aviso(
            tono: TonoAviso.error,
            texto: error is ErrorApi
                ? error.mensaje
                : 'No se pudieron cargar tus pruebas.',
          )
        else if (datos case (final guardado?, final opciones?)) ...[
          _ChipsPrueba(perfil: guardado, nombres: opciones, elegida: pruebaId),
          const EvaluacionSinTerminar(),
          if (pruebaId != null) ...[
            TarjetaDiagnostico(pruebaId: pruebaId),
            TarjetaMiniEnsayo(pruebaId: pruebaId),
            const TarjetaEnsayoCompleto(),
          ] else
            const Aviso(
              tono: TonoAviso.info,
              texto: 'Elige tus pruebas en tu perfil para rendir evaluaciones.',
            ),
        ] else
          const Center(child: CircularProgressIndicator()),
      ],
    );
  }
}

/// La elegida en A25 si sigue en el perfil; si no, la prueba a reforzar o la
/// primera del perfil.
int? _pruebaElegida(int? elegida, PerfilEstudiante perfil) {
  if (elegida != null && perfil.pruebas.contains(elegida)) return elegida;
  return perfil.pruebaReforzarId ?? perfil.pruebas.firstOrNull;
}

/// Las pruebas del perfil, en el orden de Inicio («M1», «Lectora»...).
class _ChipsPrueba extends ConsumerWidget {
  const _ChipsPrueba({
    required this.perfil,
    required this.nombres,
    required this.elegida,
  });

  final PerfilEstudiante perfil;
  final OpcionesPerfil nombres;
  final int? elegida;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GrupoChips(
      chips: [
        for (final (:id, titulo: _, reforzar: _) in pruebasDeInicio(
          perfil,
          nombres,
        ))
          ChipSeleccion(
            texto: nombres.prueba(id)?.nombreCorto ?? '',
            seleccionado: id == elegida,
            onTap: () =>
                ref.read(pruebaDeEvaluacionesProvider.notifier).prueba = id,
          ),
      ],
    );
  }
}
