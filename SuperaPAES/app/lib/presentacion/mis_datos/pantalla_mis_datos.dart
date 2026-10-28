import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/en_construccion.dart';
import 'package:supera_paes/presentacion/puntajes/estado_puntajes.dart';

/// Mis datos y privacidad (A39, provisional), desde Perfil: puntajes PAES
/// declarados (HU-41, ya abre A41), descarga de datos (HU-07), solicitudes
/// de derechos (HU-09) y borrado de la cuenta (HU-08).
class PantallaMisDatos extends ConsumerWidget {
  const PantallaMisDatos({super.key});

  static const _apartados = [
    (
      'Solicitudes sobre mis datos',
      'Pide acceso, rectificación, portabilidad u otros derechos sobre tus '
          'datos personales.',
    ),
    ('Borrar mi cuenta', 'Elimina tu cuenta y tus datos personales.'),
  ];

  static String _cargados(int cantidad) =>
      cantidad == 1 ? '1 puntaje cargado' : '$cantidad puntajes cargados';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final textos = Theme.of(context).textTheme;
    final puntajes = ref.watch(puntajesProvider).value;
    // «Permiso activo · 0 puntajes cargados», como en A39.
    final resumen = switch (puntajes) {
      null => 'Opcionales, con tu permiso.',
      final datos when !datos.permiso.otorgado => 'Sin permiso · opcional',
      final datos => 'Permiso activo · ${_cargados(datos.puntajes.length)}',
    };
    return EnConstruccion(
      descripcion: 'Tus datos personales y tus derechos sobre ellos.',
      hijos: [
        const SizedBox(height: 20),
        Tarjeta(
          child: ListaDeFilas(
            filas: [
              FilaNavegacion(
                texto: 'Puntajes PAES',
                detalle: resumen,
                onTap: () => context.push(Rutas.puntajes),
              ),
            ],
          ),
        ),
        for (final (titulo, detalle) in _apartados) ...[
          const SizedBox(height: 20),
          Text(titulo, style: textos.titleMedium),
          const SizedBox(height: 4),
          Text(detalle, style: textos.bodyMedium),
        ],
      ],
    );
  }
}
