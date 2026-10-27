import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_perfil.dart';
import 'package:supera_paes/nucleo/errores.dart';

/// Opciones como las de la semilla: cinco pruebas, los electivos de Ciencias
/// y cuatro de las áreas de carrera de RN-25.
const OpcionesPerfil opcionesDePrueba = OpcionesPerfil(
  cursos: [
    Curso(codigo: '1M', nombre: '1° medio'),
    Curso(codigo: '2M', nombre: '2° medio'),
    Curso(codigo: '3M', nombre: '3° medio'),
    Curso(codigo: '4M', nombre: '4° medio'),
    Curso(codigo: 'EG', nombre: 'Egresado'),
  ],
  pruebas: [
    PruebaPerfil(
      id: 1,
      codigo: 'CL',
      nombre: 'Competencia Lectora',
      electivos: [],
    ),
    PruebaPerfil(
      id: 2,
      codigo: 'M1',
      nombre: 'Competencia Matemática 1',
      electivos: [],
    ),
    PruebaPerfil(
      id: 3,
      codigo: 'M2',
      nombre: 'Competencia Matemática 2',
      electivos: [],
    ),
    PruebaPerfil(
      id: 4,
      codigo: 'HCS',
      nombre: 'Historia y Ciencias Sociales',
      electivos: [],
    ),
    PruebaPerfil(
      id: 5,
      codigo: 'CIE',
      nombre: 'Ciencias',
      electivos: [
        (id: 4, nombre: 'Biología'),
        (id: 5, nombre: 'Física'),
        (id: 6, nombre: 'Química'),
      ],
    ),
  ],
  areasCarrera: [
    AreaCarrera(
      id: 1,
      codigo: 'salud',
      nombre: 'Salud',
      pruebasSugeridas: [1, 2, 5],
      electivoSugeridoId: 4,
    ),
    AreaCarrera(
      id: 3,
      codigo: 'ciencias_naturales',
      nombre: 'Ciencias naturales',
      pruebasSugeridas: [1, 2, 3, 5],
      electivoSugeridoId: null,
    ),
    AreaCarrera(
      id: 6,
      codigo: 'derecho',
      nombre: 'Derecho y ciencia política',
      pruebasSugeridas: [1, 2, 4],
      electivoSugeridoId: null,
    ),
    AreaCarrera(
      id: 8,
      codigo: 'educacion',
      nombre: 'Educación',
      pruebasSugeridas: [1, 2, 4],
      electivoSugeridoId: null,
    ),
  ],
);

/// Un perfil completo de 3° medio: Lectora, M1 y Ciencias con Biología.
const PerfilEstudiante perfilCompleto = PerfilEstudiante(
  completo: true,
  curso: Curso(codigo: '3M', nombre: '3° medio'),
  anioEgreso: 2027,
  pruebas: [1, 2, 5],
  electivoId: 4,
  pruebaReforzarId: 2,
  areasCarrera: [1],
  debeConfirmarCurso: false,
);

/// Un perfil recién creado, sin completar (CU-05 paso 1).
const PerfilEstudiante perfilVacio = PerfilEstudiante(
  completo: false,
  curso: null,
  anioEgreso: null,
  pruebas: [],
  electivoId: null,
  pruebaReforzarId: null,
  areasCarrera: [],
  debeConfirmarCurso: false,
);

/// Repositorio del perfil sin red: guarda lo que recibe y responde el perfil
/// que se arma con eso.
class RepositorioPerfilFalso implements RepositorioPerfil {
  RepositorioPerfilFalso({this.perfil = perfilCompleto});

  PerfilEstudiante perfil;
  final List<DatosPerfil> guardados = [];
  final List<(String, int?)> confirmaciones = [];

  /// Si no es `null`, guardar responde este error.
  ErrorApi? errorAlGuardar;

  @override
  Future<OpcionesPerfil> opciones() async => opcionesDePrueba;

  @override
  Future<PerfilEstudiante> obtener() async => perfil;

  @override
  Future<PerfilEstudiante> guardar(DatosPerfil datos) async {
    if (errorAlGuardar case final error?) throw error;
    guardados.add(datos);
    return perfil = PerfilEstudiante(
      completo: true,
      curso: _curso(datos.curso),
      anioEgreso: datos.anioEgreso ?? 2027,
      pruebas: datos.pruebas,
      electivoId: datos.electivoId,
      pruebaReforzarId: datos.pruebaReforzarId,
      areasCarrera: datos.areasCarrera,
      debeConfirmarCurso: false,
    );
  }

  @override
  Future<PerfilEstudiante> confirmarCurso(
    String curso, {
    int? anioEgreso,
  }) async {
    confirmaciones.add((curso, anioEgreso));
    return perfil = PerfilEstudiante(
      completo: true,
      curso: _curso(curso),
      anioEgreso: anioEgreso ?? perfil.anioEgreso,
      pruebas: perfil.pruebas,
      electivoId: perfil.electivoId,
      pruebaReforzarId: perfil.pruebaReforzarId,
      areasCarrera: perfil.areasCarrera,
      debeConfirmarCurso: false,
    );
  }

  static Curso _curso(String codigo) =>
      opcionesDePrueba.cursos.firstWhere((curso) => curso.codigo == codigo);
}
