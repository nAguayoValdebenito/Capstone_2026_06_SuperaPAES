import 'dart:math' as math;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supera_paes/dominio/entidades/cupo_de_hoy.dart';
import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/dominio/entidades/suscripcion_vigente.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/inicio/estado_inicio.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
import 'package:supera_paes/presentacion/planes/estado_planes.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';

/// Proyección para presentar F3. No concede acceso: la cobertura y el cupo
/// vienen del servidor, que vuelve a comprobarlos al empezar y responder.
class EstadoUsuario {
  const EstadoUsuario({
    required this.cupo,
    required this.perfil,
    required this.verificado,
    required this.suscripcion,
  });

  final CupoDeHoy cupo;
  final PerfilEstudiante perfil;
  final bool verificado;
  final SuscripcionVigente? suscripcion;

  bool cubre(int prueba) => suscripcion?.cubre(prueba) ?? false;
  int get cupoRestante => math.max(0, cupo.restantes);
  int get bonos => math.max(0, cupo.saldoExtra);
  bool get todasIncluidas =>
      suscripcion?.coberturaVigente == true && suscripcion?.alcance == 'todas';
  bool get enMora =>
      suscripcion?.coberturaVigente == true && suscripcion?.enMora == true;

  /// `null` significa sin límite; cero sigue siendo cero.
  int? disponibles(int prueba) => cubre(prueba) ? null : cupoRestante + bonos;
  int maximoCantidad(int prueba) => math.min(
    BorradorPractica.cantidadMaxima,
    disponibles(prueba) ?? BorradorPractica.cantidadMaxima,
  );
  int cantidadSugerida(int prueba) =>
      math.min(BorradorPractica.cantidadSugerida, maximoCantidad(prueba));
  int cantidadPara(int prueba, int cantidad) {
    final maximo = maximoCantidad(prueba);
    return cantidad.clamp(
      math.min(BorradorPractica.cantidadMinima, maximo),
      maximo,
    );
  }

  bool puedePracticar(int prueba) =>
      maximoCantidad(prueba) >= BorradorPractica.cantidadMinima;
}

final estadoUsuarioProvider = Provider<AsyncValue<EstadoUsuario?>>((ref) {
  final estudiante = ref.watch(sesionProvider).value?.estudiante;
  if (estudiante == null) return const AsyncData(null);
  final cupo = ref.watch(cupoDeHoyProvider);
  final perfil = ref.watch(perfilProvider);
  final suscripcion = ref.watch(suscripcionActualProvider);
  for (final dato in <AsyncValue<Object?>>[cupo, perfil, suscripcion]) {
    if (dato.hasError) return AsyncError(dato.error!, dato.stackTrace!);
  }
  if (cupo.value == null || perfil.value == null || !suscripcion.hasValue) {
    return const AsyncLoading();
  }
  return AsyncData(
    EstadoUsuario(
      cupo: cupo.requireValue!,
      perfil: perfil.requireValue!,
      verificado: estudiante.correoVerificado,
      suscripcion: suscripcion.value,
    ),
  );
});
