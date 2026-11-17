import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supera_paes/dominio/entidades/solicitud_datos.dart';
import 'package:supera_paes/presentacion/mis_datos/estado_mis_datos.dart';

/// Largo máximo del detalle que acepta la API (plan HU-55, D2).
const int largoMaximoDetalle = 2000;

/// Los derechos de la Ley 21.719 (A40). Se piden al abrir la pantalla.
final FutureProvider<List<TipoDerecho>> tiposDerechoProvider =
    FutureProvider.autoDispose<List<TipoDerecho>>(
      (ref) => ref.watch(repositorioMisDatosProvider).tiposDerecho(),
    );

/// Las solicitudes del estudiante (HU-09 esc. 2). Se vuelven a pedir al
/// enviar una nueva.
final FutureProvider<List<SolicitudDatos>> solicitudesDatosProvider =
    FutureProvider.autoDispose<List<SolicitudDatos>>(
      (ref) => ref.watch(repositorioMisDatosProvider).solicitudes(),
    );
