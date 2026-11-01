import 'dart:async';

import 'package:clock/clock.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/evaluacion_con_tiempo.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/evaluaciones/estado_evaluaciones.dart';

/// Diagnóstico de A25 (HU-36): una vez por año escolar, solo con lo que ya
/// vio. «Rendir diagnóstico» lo ofrece en A16.
class TarjetaDiagnostico extends ConsumerWidget {
  const TarjetaDiagnostico({required this.pruebaId, super.key});

  final int pruebaId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final consulta = ref.watch(disponibilidadDiagnosticoProvider(pruebaId));
    return TarjetaEvaluacion(
      titulo: 'Diagnóstico',
      etiqueta: switch (consulta.value?.disponible) {
        true => const Etiqueta(texto: 'Disponible'),
        false => const Etiqueta(texto: 'Rendido', tono: TonoEtiqueta.exito),
        null => null,
      },
      hijos: switch (consulta) {
        AsyncData(:final value) => [
          _Detalle(
            '${value.cantidad} preguntas · ${value.duracionMin} min · solo '
            'con lo que ya viste',
          ),
          if (value.disponible) ...[
            const _Detalle(
              'Una vez por año escolar. Marca lo que tu práctica va a '
              'reforzar.',
            ),
            FilledButton(
              onPressed: () {
                ref.read(ofertaDiagnosticoProvider.notifier).ofrecer(value);
                unawaited(context.push(Rutas.ofrecerDiagnostico));
              },
              child: const Text('Rendir diagnóstico'),
            ),
          ] else
            _Detalle(
              'Ya lo rendiste este año escolar. El próximo, desde marzo de '
              '${value.anioEscolar + 1}.',
            ),
        ],
        AsyncError(:final error) => [
          _NoCargo(
            error: error,
            alReintentar: () =>
                ref.invalidate(disponibilidadDiagnosticoProvider(pruebaId)),
          ),
        ],
        _ => const [_Cargando()],
      },
    );
  }
}

/// Mini-ensayo de A25 (HU-40, RF-A14): un tercio de la prueba, gratis una
/// vez al mes por prueba o sin límite con el plan (RN-04 y RN-05).
class TarjetaMiniEnsayo extends ConsumerWidget {
  const TarjetaMiniEnsayo({required this.pruebaId, super.key});

  final int pruebaId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final consulta = ref.watch(disponibilidadMiniProvider(pruebaId));
    final mini = consulta.value;
    return TarjetaEvaluacion(
      titulo: 'Mini-ensayo',
      etiqueta: switch (mini) {
        null => null,
        DisponibilidadMiniEnsayo(conPlan: true) => const Etiqueta(
          texto: 'Incluido en tu plan',
        ),
        DisponibilidadMiniEnsayo(disponible: true, :final gratisRestantes) =>
          Etiqueta(texto: '$gratisRestantes gratis este mes'),
        _ => const Etiqueta(texto: 'Usado este mes', tono: TonoEtiqueta.aviso),
      },
      hijos: switch (consulta) {
        AsyncData(:final value) => [
          _Detalle(
            '${value.cantidad} preguntas · ${value.duracionMin} min · un '
            'tercio de la prueba oficial',
          ),
          if (value.disponible)
            FilledButton(
              onPressed: () {
                // A26 muestra el mini-ensayo de esta prueba.
                ref.read(pruebaDeEvaluacionesProvider.notifier).prueba =
                    pruebaId;
                unawaited(context.push(Rutas.antesDeEmpezar));
              },
              child: const Text('Rendir mini-ensayo'),
            )
          else ...[
            _Detalle(
              'Ya usaste tu mini-ensayo gratis de este mes. El próximo, '
              'desde el ${proximoMes(clock.now())}.',
            ),
            OutlinedButton(
              onPressed: () => context.push(Rutas.planes),
              child: const Text('Ver planes'),
            ),
          ],
        ],
        AsyncError(:final error) => [
          _NoCargo(
            error: error,
            alReintentar: () =>
                ref.invalidate(disponibilidadMiniProvider(pruebaId)),
          ),
        ],
        _ => const [_Cargando()],
      },
    );
  }
}

/// Ensayo completo de A25 (HU-42): solo con el plan Todas las pruebas.
class TarjetaEnsayoCompleto extends StatelessWidget {
  const TarjetaEnsayoCompleto({super.key});

  @override
  Widget build(BuildContext context) {
    return TarjetaEvaluacion(
      titulo: 'Ensayo completo',
      etiqueta: const Etiqueta(texto: 'Todas las pruebas'),
      hijos: [
        const _Detalle(
          'La prueba entera, con el tiempo y el formato oficial, y tu puntaje '
          'estimado de 100 a 1.000.',
        ),
        OutlinedButton(
          onPressed: () => context.push(Rutas.planes),
          child: const Text('Ver planes'),
        ),
      ],
    );
  }
}

/// «1 de diciembre»: cuándo vuelve el uso gratis del mes (RN-05).
String proximoMes(DateTime hoy) {
  const meses = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  return '1 de ${meses[hoy.month % 12]}';
}

/// Tarjeta de un tipo de evaluación: su nombre con la etiqueta de la
/// disponibilidad a la derecha (baja de línea con letra grande) y debajo
/// el detalle y la acción.
class TarjetaEvaluacion extends StatelessWidget {
  const TarjetaEvaluacion({
    required this.titulo,
    required this.hijos,
    super.key,
    this.etiqueta,
  });

  final String titulo;
  final Widget? etiqueta;
  final List<Widget> hijos;

  @override
  Widget build(BuildContext context) {
    return Tarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 8,
            runSpacing: 4,
            children: [
              Semantics(
                header: true,
                child: Text(titulo, style: TemaSuperaPaes.h2),
              ),
              ?etiqueta,
            ],
          ),
          for (final hijo in hijos) ...[const SizedBox(height: 10), hijo],
        ],
      ),
    );
  }
}

class _Detalle extends StatelessWidget {
  const _Detalle(this.texto);

  final String texto;

  @override
  Widget build(BuildContext context) => Text(
    texto,
    style: TemaSuperaPaes.pequeno.copyWith(
      color: TemaSuperaPaes.textoSecundario,
    ),
  );
}

class _Cargando extends StatelessWidget {
  const _Cargando();

  @override
  Widget build(BuildContext context) => const Align(
    alignment: Alignment.centerLeft,
    child: SizedBox.square(
      dimension: 20,
      child: CircularProgressIndicator(strokeWidth: 2),
    ),
  );
}

/// El mensaje de la API (como «Elige tu electivo...») y «Reintentar».
class _NoCargo extends StatelessWidget {
  const _NoCargo({required this.error, required this.alReintentar});

  final Object error;
  final VoidCallback alReintentar;

  @override
  Widget build(BuildContext context) {
    final texto = switch (error) {
      ErrorApi(:final problemas) when problemas.isNotEmpty =>
        problemas.first.mensaje,
      final ErrorApi api => api.mensaje,
      _ => 'No se pudo cargar.',
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Detalle(texto),
        const SizedBox(height: 8),
        OutlinedButton(
          onPressed: alReintentar,
          child: const Text('Reintentar'),
        ),
      ],
    );
  }
}
