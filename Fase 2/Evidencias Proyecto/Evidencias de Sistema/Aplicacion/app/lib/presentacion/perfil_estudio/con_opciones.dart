import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';

/// Arma un paso del perfil cuando llegan las opciones (cursos, pruebas y
/// áreas). Mientras cargan, un indicador; si fallan, el error y «Reintentar».
class ConOpciones extends ConsumerWidget {
  const ConOpciones({required this.builder, super.key});

  final Widget Function(OpcionesPerfil opciones) builder;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ref
        .watch(opcionesPerfilProvider)
        .when(
          data: builder,
          loading: () =>
              const Scaffold(body: Center(child: CircularProgressIndicator())),
          error: (error, _) => PantallaFormulario(
            hijos: [
              Aviso(
                tono: TonoAviso.error,
                texto: error is ErrorApi
                    ? error.mensaje
                    : 'No se pudieron cargar las opciones del perfil.',
              ),
              OutlinedButton(
                onPressed: () => ref.invalidate(opcionesPerfilProvider),
                child: const Text('Reintentar'),
              ),
            ],
          ),
        );
  }
}
