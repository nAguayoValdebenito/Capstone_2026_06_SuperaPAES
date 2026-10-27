/// Curso del estudiante (contenido.nivel_escolar): de 1° a 4° medio, o
/// egresado (`EG`).
class Curso {
  const Curso({required this.codigo, required this.nombre});

  final String codigo;
  final String nombre;

  static const String egresado = 'EG';

  bool get esEgresado => codigo == egresado;
}

/// Perfil de estudio del estudiante (HU-29, RF-A04, CU-05).
class PerfilEstudiante {
  const PerfilEstudiante({
    required this.completo,
    required this.curso,
    required this.anioEgreso,
    required this.pruebas,
    required this.electivoId,
    required this.pruebaReforzarId,
    required this.areasCarrera,
    required this.debeConfirmarCurso,
  });

  /// Sin curso o sin pruebas, la app muestra la bienvenida (CU-05 paso 1).
  final bool completo;

  /// Curso de hoy, calculado por la API con el año de egreso; cambia en
  /// marzo (RN-24).
  final Curso? curso;
  final int? anioEgreso;
  final List<int> pruebas;

  /// Electivo de Ciencias (Biología, Física o Química), si rinde Ciencias.
  final int? electivoId;
  final int? pruebaReforzarId;
  final List<int> areasCarrera;

  /// Empezó un año escolar y la app pide confirmar el curso (A11).
  final bool debeConfirmarCurso;
}

/// Una opción con id y nombre, como un electivo de Ciencias.
typedef OpcionConNombre = ({int id, String nombre});

/// Prueba que el estudiante puede elegir; solo Ciencias trae electivos.
class PruebaPerfil {
  const PruebaPerfil({
    required this.id,
    required this.codigo,
    required this.nombre,
    required this.electivos,
  });

  final int id;
  final String codigo;
  final String nombre;
  final List<OpcionConNombre> electivos;

  static const String ciencias = 'CIE';

  bool get esCiencias => codigo == ciencias;

  /// Nombre corto de los bocetos (A10 y A37): «Lectora», «M1», «Historia».
  String get nombreCorto => switch (codigo) {
    'CL' => 'Lectora',
    'HCS' => 'Historia',
    ciencias => 'Ciencias',
    _ => codigo,
  };
}

/// Área de carrera con las pruebas y el electivo que sugiere (RN-25).
class AreaCarrera {
  const AreaCarrera({
    required this.id,
    required this.codigo,
    required this.nombre,
    required this.pruebasSugeridas,
    required this.electivoSugeridoId,
  });

  final int id;
  final String codigo;
  final String nombre;
  final List<int> pruebasSugeridas;
  final int? electivoSugeridoId;
}

/// Lo que muestran las pantallas del perfil (A08 a A10).
class OpcionesPerfil {
  const OpcionesPerfil({
    required this.cursos,
    required this.pruebas,
    required this.areasCarrera,
  });

  final List<Curso> cursos;
  final List<PruebaPerfil> pruebas;
  final List<AreaCarrera> areasCarrera;

  PruebaPerfil? prueba(int id) =>
      pruebas.where((prueba) => prueba.id == id).firstOrNull;

  AreaCarrera? area(int id) =>
      areasCarrera.where((area) => area.id == id).firstOrNull;

  /// Nombre de un electivo de Ciencias por su id.
  String? electivo(int id) => [
    for (final prueba in pruebas) ...prueba.electivos,
  ].where((electivo) => electivo.id == id).firstOrNull?.nombre;
}

/// Lo que se guarda: el curso (o egresado con su año) y las elecciones.
class DatosPerfil {
  const DatosPerfil({
    required this.curso,
    required this.pruebas,
    this.anioEgreso,
    this.electivoId,
    this.pruebaReforzarId,
    this.areasCarrera = const [],
  });

  final String curso;
  final int? anioEgreso;
  final List<int> pruebas;
  final int? electivoId;
  final int? pruebaReforzarId;
  final List<int> areasCarrera;
}
