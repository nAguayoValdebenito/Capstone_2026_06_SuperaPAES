import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';

/// El perfil, sus opciones (nombres de las pruebas) y las opciones de
/// práctica de su curso.
typedef DatosDePractica = ({
  PerfilEstudiante perfil,
  OpcionesPerfil nombres,
  OpcionesPractica opciones,
});

/// Arma A13 o A14 cuando llegan el perfil y las opciones. Mientras cargan,
/// un indicador; si fallan, el error y «Reintentar».
class ConDatosPractica extends ConsumerWidget {
  const ConDatosPractica({required this.builder, super.key});

  final Widget Function(DatosDePractica datos) builder;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final perfil = ref.watch(perfilProvider);
    final nombres = ref.watch(opcionesPerfilProvider);
    final opciones = ref.watch(opcionesPracticaProvider);
    final error = perfil.error ?? nombres.error ?? opciones.error;
    if (error != null) {
      return PantallaFormulario(
        hijos: [
          Aviso(
            tono: TonoAviso.error,
            texto: error is ErrorApi
                ? error.mensaje
                : 'No se pudieron cargar las opciones de práctica.',
          ),
          OutlinedButton(
            onPressed: () => ref
              ..invalidate(opcionesPerfilProvider)
              ..invalidate(opcionesPracticaProvider),
            child: const Text('Reintentar'),
          ),
        ],
      );
    }
    if ((perfil.value, nombres.value, opciones.value) case (
      final perfil?,
      final nombres?,
      final opciones?,
    )) {
      return builder((perfil: perfil, nombres: nombres, opciones: opciones));
    }
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}

/// La prueba del borrador si es del perfil; si no, la prueba a reforzar o la
/// primera del perfil.
int? pruebaElegida(BorradorPractica borrador, PerfilEstudiante perfil) {
  if (borrador.pruebaId case final id? when perfil.pruebas.contains(id)) {
    return id;
  }
  return perfil.pruebaReforzarId ?? perfil.pruebas.firstOrNull;
}
