import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/dominio/entidades/cupo_de_hoy.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/inicio/estado_inicio.dart';

/// «Hola, Camila» y la racha de días practicando (A12; HU-35 esc. 2). La
/// racha aparece cuando llega el cupo, que la trae.
class SaludoInicio extends ConsumerWidget {
  const SaludoInicio({required this.nombre, super.key});

  /// Nombre completo del estudiante; se saluda con el primero.
  final String nombre;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final racha = ref.watch(cupoDeHoyProvider).value?.racha;
    final primerNombre = nombre.trim().split(RegExp(r'\s+')).first;
    // Wrap: con letra grande, la racha baja a otra línea (RNF-12).
    return Wrap(
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 12,
      runSpacing: 8,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Hola,',
              style: TemaSuperaPaes.cuerpo.copyWith(
                color: TemaSuperaPaes.textoSecundario,
              ),
            ),
            Semantics(
              header: true,
              child: Text(primerNombre, style: TemaSuperaPaes.h1),
            ),
          ],
        ),
        if (racha != null) _Racha(dias: racha),
      ],
    );
  }
}

class _Racha extends StatelessWidget {
  const _Racha({required this.dias});

  final int dias;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: TemaSuperaPaes.avisoSuave,
        borderRadius: BorderRadius.circular(TemaSuperaPaes.radioTarjeta),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.local_fire_department_outlined,
            size: 16,
            color: TemaSuperaPaes.aviso,
          ),
          const SizedBox(width: 6),
          // Flexible: con letra muy grande el texto se parte en vez de
          // desbordarse.
          Flexible(
            child: Text(
              'Racha: $dias ${dias == 1 ? 'día' : 'días'}',
              style: TemaSuperaPaes.pequenoFuerte.copyWith(
                color: TemaSuperaPaes.avisoTexto,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// «Tus preguntas de hoy» (A12; HU-35 esc. 1, RN-01, RN-02): las disponibles,
/// las usadas con su barra, el reinicio y las preguntas extra.
class TarjetaCupo extends ConsumerWidget {
  const TarjetaCupo({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cupo = ref.watch(cupoDeHoyProvider);
    return Tarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Tus preguntas de hoy',
            style: TemaSuperaPaes.etiqueta.copyWith(
              color: TemaSuperaPaes.textoSecundario,
            ),
          ),
          const SizedBox(height: 10),
          switch (cupo) {
            AsyncData(value: final CupoDeHoy datos) => _DatosCupo(cupo: datos),
            AsyncError(:final error) => _ErrorCupo(error: error),
            _ => const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: CircularProgressIndicator()),
            ),
          },
        ],
      ),
    );
  }
}

class _DatosCupo extends StatelessWidget {
  const _DatosCupo({required this.cupo});

  final CupoDeHoy cupo;

  @override
  Widget build(BuildContext context) {
    final secundario = TemaSuperaPaes.pequeno.copyWith(
      color: TemaSuperaPaes.textoSecundario,
    );
    final usado = cupo.maximo == 0 ? 0.0 : cupo.usadas / cupo.maximo;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 8,
          crossAxisAlignment: WrapCrossAlignment.end,
          children: [
            Text('${cupo.restantes}', style: TemaSuperaPaes.display),
            Padding(
              // Alinea la bajada con la base del número, como en el boceto.
              padding: const EdgeInsets.only(bottom: 6),
              child: Text(
                'disponibles · ${cupo.usadas} de ${cupo.maximo} usadas',
                style: secundario,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        // Las usadas ya se leen en el texto de arriba.
        ExcludeSemantics(child: _Barra(usado: usado.clamp(0, 1))),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 6,
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text('Se reinicia a las 00:00 (hora de Chile)', style: secundario),
            if (cupo.saldoExtra > 0)
              Etiqueta(texto: 'Extra: ${cupo.saldoExtra}'),
          ],
        ),
      ],
    );
  }
}

/// Barra de las preguntas usadas: fondo `neutroSuave` y avance `primario`.
class _Barra extends StatelessWidget {
  const _Barra({required this.usado});

  /// Fracción usada, de 0 a 1.
  final double usado;

  @override
  Widget build(BuildContext context) {
    final radio = BorderRadius.circular(TemaSuperaPaes.altoBarra / 2);
    return Container(
      height: TemaSuperaPaes.altoBarra,
      alignment: Alignment.centerLeft,
      decoration: BoxDecoration(
        color: TemaSuperaPaes.neutroSuave,
        borderRadius: radio,
      ),
      child: FractionallySizedBox(
        widthFactor: usado,
        heightFactor: 1,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: TemaSuperaPaes.primario,
            borderRadius: radio,
          ),
        ),
      ),
    );
  }
}

class _ErrorCupo extends ConsumerWidget {
  const _ErrorCupo({required this.error});

  final Object error;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Aviso(
          tono: TonoAviso.error,
          texto: error is ErrorApi
              ? (error as ErrorApi).mensaje
              : 'No se pudo cargar tu cupo de hoy.',
        ),
        const SizedBox(height: 10),
        BotonChico(
          texto: 'Reintentar',
          onPressed: () => ref.invalidate(cupoDeHoyProvider),
        ),
      ],
    );
  }
}
