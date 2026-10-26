import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/datos/fuentes/fuente_cuentas_remota.dart';
import 'package:supera_paes/datos/repositorios/repositorio_cuentas_api.dart';
import 'package:supera_paes/dominio/entidades/documento_legal.dart';
import 'package:supera_paes/dominio/entidades/sesion_estudiante.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_cuentas.dart';
import 'package:supera_paes/nucleo/cliente_http.dart';

final repositorioCuentasProvider = Provider<RepositorioCuentas>(
  (ref) => RepositorioCuentasApi(
    FuenteCuentasRemota(ref.watch(clienteHttpProvider)),
  ),
);

/// Versiones vigentes de los términos y la política de privacidad. Las usan
/// Crear cuenta (A01), Términos y condiciones (A02) y Política de privacidad
/// (A02b).
final documentosVigentesProvider = FutureProvider<List<DocumentoLegal>>(
  (ref) => ref.watch(repositorioCuentasProvider).documentosVigentes(),
);

/// Sesión abierta del estudiante, o `null` si no hay. Por ahora vive solo en
/// memoria: el almacenamiento seguro llega con el inicio de sesión
/// (HU-02.2).
class EstadoSesion extends Notifier<SesionEstudiante?> {
  @override
  SesionEstudiante? build() => null;

  // ignore: use_setters_to_change_properties, la sesión se abre, no se asigna.
  void abrir(SesionEstudiante sesion) => state = sesion;

  void cerrar() => state = null;
}

final sesionProvider = NotifierProvider<EstadoSesion, SesionEstudiante?>(
  EstadoSesion.new,
);
