import 'package:supera_paes/dominio/entidades/puntajes_paes.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_puntajes.dart';
import 'package:supera_paes/nucleo/errores.dart';

const String textoPermisoDePrueba =
    '# Permiso para usar los puntajes PAES\n\n'
    'Versión 1.0\n\n'
    'Autorizo a Supera PAES a guardar los puntajes PAES que declaro.';

/// Sin el permiso y sin puntajes, como un estudiante nuevo.
const PuntajesPaes sinPermisoDePrueba = PuntajesPaes(
  permiso: PermisoPuntajes(
    documentoId: 3,
    version: '1.0',
    texto: textoPermisoDePrueba,
    otorgado: false,
  ),
  puntajes: [],
);

/// Repositorio de los puntajes sin red, que se comporta como el servidor:
/// sin el permiso no guarda (SIN_PERMISO), uno por prueba y año, y retirar
/// el permiso borra los puntajes (RN-16). Con [error], toda operación falla.
class RepositorioPuntajesFalso implements RepositorioPuntajes {
  RepositorioPuntajesFalso({PuntajesPaes estado = sinPermisoDePrueba})
    : _otorgado = estado.permiso.otorgado,
      _puntajes = [...estado.puntajes];

  bool _otorgado;
  final List<PuntajePaes> _puntajes;
  int _siguienteId = 100;
  ErrorApi? error;

  /// Los permisos dados, con el id del documento que se envió.
  final List<int> permisosDados = [];

  PuntajesPaes get _estado => PuntajesPaes(
    permiso: PermisoPuntajes(
      documentoId: sinPermisoDePrueba.permiso.documentoId,
      version: '1.0',
      texto: textoPermisoDePrueba,
      otorgado: _otorgado,
    ),
    puntajes: [..._puntajes]
      ..sort((a, b) => b.anioAdmision.compareTo(a.anioAdmision)),
  );

  Future<PuntajesPaes> _responder([void Function()? cambio]) async {
    if (error case final fallo?) throw fallo;
    cambio?.call();
    return _estado;
  }

  @override
  Future<PuntajesPaes> obtener() => _responder();

  @override
  Future<PuntajesPaes> otorgarPermiso(int documentoId) => _responder(() {
    permisosDados.add(documentoId);
    _otorgado = true;
  });

  @override
  Future<PuntajesPaes> retirarPermiso() => _responder(() {
    _otorgado = false;
    _puntajes.clear();
  });

  @override
  Future<PuntajesPaes> guardar(DatosPuntaje datos) => _responder(() {
    if (!_otorgado) {
      throw const ErrorApi(
        codigo: 'SIN_PERMISO',
        mensaje:
            'Para cargar tus puntajes, primero da el permiso para usarlos.',
      );
    }
    _puntajes
      ..removeWhere(
        (p) =>
            p.pruebaId == datos.pruebaId &&
            p.anioAdmision == datos.anioAdmision,
      )
      ..add(
        PuntajePaes(
          id: _siguienteId++,
          pruebaId: datos.pruebaId,
          anioAdmision: datos.anioAdmision,
          puntaje: datos.puntaje,
        ),
      );
  });

  @override
  Future<PuntajesPaes> borrar(int puntajeId) =>
      _responder(() => _puntajes.removeWhere((p) => p.id == puntajeId));
}
