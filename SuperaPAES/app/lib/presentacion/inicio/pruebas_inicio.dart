import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/evaluacion_con_tiempo.dart';
import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/sello_prueba.dart';
import 'package:supera_paes/presentacion/evaluaciones/estado_evaluaciones.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';

/// Una prueba del perfil como la muestra Inicio.
typedef PruebaDeInicio = ({int id, String titulo, bool reforzar});

/// Las pruebas del perfil en el orden de A12: la prueba a reforzar primero y
/// las demás como se guardaron. Ciencias lleva su electivo («Ciencias ·
/// Biología»).
List<PruebaDeInicio> pruebasDeInicio(
  PerfilEstudiante perfil,
  OpcionesPerfil opciones,
) {
  final reforzar = perfil.pruebaReforzarId;
  final ids = [
    ?reforzar,
    for (final id in perfil.pruebas)
      if (id != reforzar) id,
  ];
  return [
    for (final id in ids)
      if (opciones.prueba(id) case final prueba?)
        (
          id: id,
          titulo: switch (perfil.electivoId) {
            final electivo? when prueba.esCiencias => [
              prueba.nombreEnInicio,
              ?opciones.electivo(electivo),
            ].join(' · '),
            _ => prueba.nombreEnInicio,
          },
          reforzar: id == reforzar,
        ),
  ];
}

/// «Tus pruebas» de A12 (HU-35 esc. 3): cada prueba del perfil lleva a
/// practicarla (A13 con esa prueba elegida) y, si no rindió su diagnóstico
/// este año escolar, lo ofrece (A16, HU-36). Repasar errores llega con la
/// HU-39.
class PruebasInicio extends ConsumerWidget {
  const PruebasInicio({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final perfil = ref.watch(perfilProvider);
    final opciones = ref.watch(opcionesPerfilProvider);
    final error = perfil.error ?? opciones.error;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: const Text('Tus pruebas', style: TemaSuperaPaes.h2),
        ),
        const SizedBox(height: 14),
        if (error != null)
          Aviso(
            tono: TonoAviso.error,
            texto: error is ErrorApi
                ? error.mensaje
                : 'No se pudieron cargar tus pruebas.',
          )
        else if (perfil.value case final guardado? when opciones.hasValue)
          for (final prueba in pruebasDeInicio(
            guardado,
            opciones.requireValue,
          )) ...[
            _TarjetaPrueba(
              prueba: prueba,
              codigo: opciones.requireValue.prueba(prueba.id)?.codigo ?? '',
              diagnostico: switch (ref
                  .watch(disponibilidadDiagnosticoProvider(prueba.id))
                  .value) {
                final DisponibilidadDiagnostico d when d.disponible => d,
                _ => null,
              },
              onTap: () {
                ref
                    .read(borradorPracticaProvider.notifier)
                    .elegirPrueba(prueba.id);
                context.go(Rutas.practicar);
              },
            ),
            const SizedBox(height: 14),
          ]
        else
          const Center(child: CircularProgressIndicator()),
      ],
    );
  }
}

/// Tarjeta de una prueba (relleno 16 × 14, radio 14) con el sello de la
/// prueba y la sombra suave de lo que se toca. La prueba a reforzar
/// lleva su etiqueta y el botón «Reforzar»; con el diagnóstico pendiente,
/// «Diagnóstico pendiente este año» y el botón «Diagnóstico»; las demás se
/// tocan enteras.
class _TarjetaPrueba extends ConsumerWidget {
  const _TarjetaPrueba({
    required this.prueba,
    required this.codigo,
    required this.onTap,
    this.diagnostico,
  });

  final PruebaDeInicio prueba;

  /// Código de la prueba (`CL`, `M1`...), para su sello.
  final String codigo;
  final VoidCallback onTap;

  /// El diagnóstico pendiente de la prueba; `null` si ya lo rindió.
  final DisponibilidadDiagnostico? diagnostico;

  void _ofrecerDiagnostico(
    BuildContext context,
    WidgetRef ref,
    DisponibilidadDiagnostico diagnostico,
  ) {
    ref.read(ofertaDiagnosticoProvider.notifier).ofrecer(diagnostico);
    unawaited(context.push(Rutas.ofrecerDiagnostico));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final diagnostico = this.diagnostico;
    final forma = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(TemaSuperaPaes.radioBoton),
    );
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(TemaSuperaPaes.radioBoton),
        boxShadow: TemaSuperaPaes.sombraSuave,
      ),
      child: Material(
        color: TemaSuperaPaes.superficie,
        shape: forma,
        child: InkWell(
          customBorder: forma,
          // Con un botón, el botón es la única acción.
          onTap: prueba.reforzar || diagnostico != null ? null : onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                SelloPrueba(codigo: codigo),
                const SizedBox(width: TemaSuperaPaes.espacio12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(prueba.titulo, style: TemaSuperaPaes.cuerpoFuerte),
                      if (prueba.reforzar) ...[
                        const SizedBox(height: 4),
                        const Etiqueta(
                          texto: 'Tu prueba a reforzar',
                          tono: TonoEtiqueta.aviso,
                        ),
                      ],
                      if (diagnostico != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          'Diagnóstico pendiente este año',
                          style: TemaSuperaPaes.pequeno.copyWith(
                            color: TemaSuperaPaes.textoSecundario,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                if (prueba.reforzar)
                  BotonChico(texto: 'Reforzar', onPressed: onTap)
                else if (diagnostico != null)
                  BotonChico(
                    texto: 'Diagnóstico',
                    onPressed: () =>
                        _ofrecerDiagnostico(context, ref, diagnostico),
                  )
                else
                  const Icon(
                    Icons.chevron_right,
                    size: 18,
                    color: TemaSuperaPaes.textoSecundario,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
