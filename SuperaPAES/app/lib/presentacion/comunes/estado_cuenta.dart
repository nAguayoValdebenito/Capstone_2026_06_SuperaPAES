import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/datos/fuentes/fuente_cuentas_remota.dart';
import 'package:supera_paes/datos/fuentes/fuente_verificacion_remota.dart';
import 'package:supera_paes/datos/repositorios/almacen_sesion_seguro.dart';
import 'package:supera_paes/datos/repositorios/repositorio_cuentas_api.dart';
import 'package:supera_paes/datos/repositorios/repositorio_verificacion_api.dart';
import 'package:supera_paes/dominio/entidades/documento_legal.dart';
import 'package:supera_paes/dominio/entidades/sesion_estudiante.dart';
import 'package:supera_paes/dominio/repositorios/almacen_sesion.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_cuentas.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_verificacion.dart';
import 'package:supera_paes/nucleo/cliente_http.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/interceptor_sesion.dart';

/// Las rutas de cuentas que usa la app son públicas: van con el cliente sin
/// sesión, así renovar y cerrar nunca pasan por el interceptor.
final repositorioCuentasProvider = Provider<RepositorioCuentas>(
  (ref) => RepositorioCuentasApi(
    FuenteCuentasRemota(ref.watch(clienteHttpProvider)),
  ),
);

final almacenSesionProvider = Provider<AlmacenSesion>(
  (ref) => const AlmacenSesionSeguro(),
);

/// Versiones vigentes de los términos y la política de privacidad. Las usan
/// Crear cuenta (A01), Términos y condiciones (A02) y Política de privacidad
/// (A02b).
final documentosVigentesProvider = FutureProvider<List<DocumentoLegal>>(
  (ref) => ref.watch(repositorioCuentasProvider).documentosVigentes(),
);

/// Sesión del estudiante (HU-02): se lee del almacén cifrado al abrir la app
/// y vale `null` si no hay. Mientras se lee, está cargando.
class EstadoSesion extends AsyncNotifier<SesionEstudiante?> {
  AlmacenSesion get _almacen => ref.read(almacenSesionProvider);
  RepositorioCuentas get _cuentas => ref.read(repositorioCuentasProvider);

  @override
  Future<SesionEstudiante?> build() => _almacen.leer();

  /// Abre la sesión que devolvió el registro o el ingreso y la guarda.
  Future<void> abrir(SesionEstudiante sesion) async {
    await _almacen.guardar(sesion);
    state = AsyncData(sesion);
  }

  /// Cambia los tokens por unos nuevos; `true` si lo logra. Si la API
  /// rechaza la sesión (venció o se cerró), la cierra en el teléfono. Sin
  /// conexión la conserva, para reintentar después.
  Future<bool> renovar() async {
    final actual = state.value;
    if (actual == null) return false;
    try {
      final tokens = await _cuentas.renovar(actual.tokenRenovacion);
      // Lo más reciente del estudiante: pudo cambiar mientras se renovaba
      // (por ejemplo, el correo quedó verificado).
      final renovada = (state.value ?? actual).conTokens(tokens);
      await _almacen.guardar(renovada);
      state = AsyncData(renovada);
      return true;
    } on ErrorApi catch (error) {
      if (error.estadoHttp == 401) await _olvidar();
      return false;
    }
  }

  /// El correo quedó verificado (HU-05): con el código, o porque la API
  /// respondió que ya lo estaba. Se guarda para no esperar al próximo
  /// ingreso. Sin sesión, o si ya estaba verificado, no hace nada.
  Future<void> marcarCorreoVerificado() async {
    final actual = state.value;
    if (actual == null || actual.estudiante.correoVerificado) return;
    await abrir(actual.conCorreoVerificado());
  }

  /// Cierra la sesión en la API y en el teléfono. Si la API no responde, la
  /// borra igual del teléfono.
  Future<void> cerrar() async {
    final actual = state.value;
    if (actual != null) {
      try {
        await _cuentas.cerrar(actual.tokenRenovacion);
      } on ErrorApi {
        // Sin conexión: el token de renovación vence solo en 30 días.
      }
    }
    await _olvidar();
  }

  /// La cuenta se borró (HU-08): la API ya cerró la sesión, así que solo se
  /// olvida en el teléfono.
  Future<void> olvidarCuentaBorrada() => _olvidar();

  Future<void> _olvidar() async {
    await _almacen.borrar();
    state = const AsyncData(null);
  }
}

final sesionProvider = AsyncNotifierProvider<EstadoSesion, SesionEstudiante?>(
  EstadoSesion.new,
);

/// Cliente HTTP para las rutas que exigen sesión: agrega el token de acceso
/// y renueva la sesión cuando vence.
final clienteHttpConSesionProvider = Provider<Dio>((ref) {
  final base = ref.watch(clienteHttpProvider);
  final dio = Dio(base.options)
    ..interceptors.add(
      InterceptorSesion(
        tokenAcceso: () => ref.read(sesionProvider).value?.tokenAcceso,
        renovar: () => ref.read(sesionProvider.notifier).renovar(),
        reintentar: base.fetch,
      ),
    );
  ref.onDispose(dio.close);
  return dio;
});

/// Verificación del correo (HU-05): sus rutas exigen sesión, así que van con
/// el cliente que agrega el token y lo renueva.
final repositorioVerificacionProvider = Provider<RepositorioVerificacion>(
  (ref) => RepositorioVerificacionApi(
    FuenteVerificacionRemota(ref.watch(clienteHttpConSesionProvider)),
  ),
);

/// Nombre del dispositivo que se guarda en la sesión.
String? nombreDispositivo() => switch (defaultTargetPlatform) {
  TargetPlatform.android => 'Android',
  TargetPlatform.iOS => 'iPhone',
  _ => null,
};
