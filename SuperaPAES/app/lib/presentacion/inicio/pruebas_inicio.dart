import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';

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
/// practicarla. Repasar errores (HU-39) y el diagnóstico pendiente (HU-36)
/// llegan con sus historias.
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
              onTap: () => context.go('${Rutas.practicar}?prueba=${prueba.id}'),
            ),
            const SizedBox(height: 14),
          ]
        else
          const Center(child: CircularProgressIndicator()),
      ],
    );
  }
}

/// Tarjeta de una prueba (relleno 16 × 14, radio 14). La prueba a reforzar
/// lleva su etiqueta y el botón «Reforzar»; las demás se tocan enteras.
class _TarjetaPrueba extends StatelessWidget {
  const _TarjetaPrueba({required this.prueba, required this.onTap});

  final PruebaDeInicio prueba;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final forma = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(TemaSuperaPaes.radioBoton),
      side: const BorderSide(color: TemaSuperaPaes.borde),
    );
    return Material(
      color: TemaSuperaPaes.superficie,
      shape: forma,
      child: InkWell(
        customBorder: forma,
        // Con «Reforzar», el botón es la única acción.
        onTap: prueba.reforzar ? null : onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
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
                  ],
                ),
              ),
              const SizedBox(width: 12),
              if (prueba.reforzar)
                BotonChico(texto: 'Reforzar', onPressed: onTap)
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
    );
  }
}
