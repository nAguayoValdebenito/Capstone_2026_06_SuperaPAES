import 'package:supera_paes/dominio/entidades/puntajes_paes.dart';
import 'package:supera_paes/nucleo/ids.dart';

/// Lee el JSON de /api/v1/app/cuentas/puntajes (docs/contratos/HU-41.md).
abstract final class PuntajesModelo {
  static PuntajesPaes puntajes(Map<String, dynamic> json) {
    final permiso = json['permiso']! as Map<String, dynamic>;
    final documento = permiso['documento']! as Map<String, dynamic>;
    return PuntajesPaes(
      permiso: PermisoPuntajes(
        documentoId: leerId(documento['id']),
        version: documento['version'] as String,
        texto: documento['texto'] as String,
        otorgado: permiso['otorgado'] == true,
      ),
      puntajes: [
        for (final valor in json['puntajes'] as List<Object?>)
          if (valor case final Map<String, dynamic> puntaje)
            PuntajePaes(
              id: leerId(puntaje['id']),
              pruebaId: leerId(puntaje['pruebaId']),
              anioAdmision: puntaje['anioAdmision'] as int,
              puntaje: puntaje['puntaje'] as int,
            ),
      ],
    );
  }
}
