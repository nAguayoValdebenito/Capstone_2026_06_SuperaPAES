import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/estado_usuario.dart';
import 'package:supera_paes/presentacion/comunes/estados.dart';
import 'package:supera_paes/presentacion/inicio/estado_inicio.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
import 'package:supera_paes/presentacion/planes/estado_planes.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';

/// El perfil, sus opciones (nombres de las pruebas) y las opciones de
/// práctica de su curso.
typedef DatosDePractica = ({
  EstadoUsuario estado,
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
    final estado = ref.watch(estadoUsuarioProvider);
    final error =
        perfil.error ?? nombres.error ?? opciones.error ?? estado.error;
    if (error != null) {
      return PantallaFormulario(
        hijos: [
          EstadoError(
            error: error,
            mensaje: 'No se pudieron cargar las opciones de práctica.',
            alReintentar: () => ref
              ..invalidate(perfilProvider)
              ..invalidate(cupoDeHoyProvider)
              ..invalidate(suscripcionActualProvider)
              ..invalidate(opcionesPerfilProvider)
              ..invalidate(opcionesPracticaProvider),
          ),
          const EsqueletoPractica(quieto: true),
        ],
      );
    }
    if ((perfil.value, nombres.value, opciones.value, estado.value) case (
      final perfil?,
      final nombres?,
      final opciones?,
      final estado?,
    )) {
      return builder((
        perfil: perfil,
        nombres: nombres,
        opciones: opciones,
        estado: estado,
      ));
    }
    return const PantallaFormulario(hijos: [EsqueletoPractica()]);
  }
}

class EsqueletoPractica extends StatelessWidget {
  const EsqueletoPractica({super.key, this.quieto = false});
  final bool quieto;
  @override
  Widget build(BuildContext context) => GrupoEsqueleto(
    quieto: quieto,
    child: const Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Bloque(ancho: 220, alto: 28),
        SizedBox(height: TemaSuperaPaes.espacio16),
        EsqueletoTarjeta(),
        SizedBox(height: TemaSuperaPaes.espacio16),
        EsqueletoTarjeta(lineas: 3),
        SizedBox(height: TemaSuperaPaes.espacio16),
        Bloque(alto: TemaSuperaPaes.altoBoton),
      ],
    ),
  );
}

/// La prueba del borrador si es del perfil; si no, la prueba a reforzar o la
/// primera del perfil.
int? pruebaElegida(BorradorPractica borrador, PerfilEstudiante perfil) {
  if (borrador.pruebaId case final id? when perfil.pruebas.contains(id)) {
    return id;
  }
  return perfil.pruebaReforzarId ?? perfil.pruebas.firstOrNull;
}
