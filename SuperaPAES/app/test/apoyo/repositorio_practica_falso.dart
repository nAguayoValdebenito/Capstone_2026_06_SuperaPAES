import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_practica.dart';
import 'package:supera_paes/nucleo/errores.dart';

/// Opciones como las de la semilla para 3° medio: las tres dificultades con
/// la mezcla de RN-09 y las pruebas del perfil de ejemplo (Lectora, M1 y
/// Ciencias).
const OpcionesPractica opcionesPracticaDePrueba = OpcionesPractica(
  dificultades: [
    Dificultad(id: 1, codigo: 'facil', nombre: 'Fácil', mezcla: 30),
    Dificultad(id: 2, codigo: 'media', nombre: 'Media', mezcla: 45),
    Dificultad(id: 3, codigo: 'dificil', nombre: 'Difícil', mezcla: 25),
  ],
  pruebas: [
    PruebaPractica(
      id: 1,
      codigo: 'CL',
      ejes: [],
      habilidades: [
        (id: 1, nombre: 'Localizar'),
        (id: 2, nombre: 'Interpretar'),
      ],
    ),
    PruebaPractica(
      id: 2,
      codigo: 'M1',
      ejes: [
        EjePractica(
          id: 10,
          nombre: 'Números',
          contenidos: [
            (id: 100, nombre: 'Conjunto de los números enteros'),
            (id: 101, nombre: 'Potencias y raíces'),
          ],
        ),
        EjePractica(
          id: 11,
          nombre: 'Álgebra y funciones',
          contenidos: [(id: 110, nombre: 'Ecuaciones lineales')],
        ),
      ],
      habilidades: [(id: 20, nombre: 'Resolver problemas')],
    ),
    PruebaPractica(
      id: 5,
      codigo: 'CIE',
      ejes: [
        EjePractica(
          id: 50,
          nombre: 'Biología',
          contenidos: [(id: 500, nombre: 'Célula')],
        ),
      ],
      habilidades: [],
    ),
  ],
);

/// El resumen del boceto A21: 7 de 10, 70 %, 12 minutos.
const ResumenPractica resumenDeEjemplo = ResumenPractica(
  id: 41,
  prueba: 'Matemática M1',
  alcance: Alcance(
    TipoAlcance.contenido,
    id: 101,
    nombre: 'Potencias y raíces',
  ),
  dificultad: 'Mezcla',
  cantidad: 10,
  correctas: 7,
  incorrectas: 3,
  omitidas: 0,
  porcentaje: 70,
  tiempoUsadoSeg: 720,
);

/// Repositorio de la práctica sin red: guarda lo que se intentó iniciar y
/// responde la práctica, salvo mientras queden [erroresAlIniciar].
class RepositorioPracticaFalso implements RepositorioPractica {
  final List<DatosPractica> iniciadas = [];
  final List<String> cursos = [];

  /// Errores que responde iniciar, uno por intento, antes de empezar.
  final List<ErrorApi> erroresAlIniciar = [];

  @override
  Future<OpcionesPractica> opciones(String curso) async {
    cursos.add(curso);
    return opcionesPracticaDePrueba;
  }

  @override
  Future<PracticaIniciada> iniciar(DatosPractica datos) async {
    iniciadas.add(datos);
    if (erroresAlIniciar.isNotEmpty) throw erroresAlIniciar.removeAt(0);
    return PracticaIniciada(
      id: 41,
      pruebaId: datos.pruebaId,
      cantidad: datos.cantidad,
    );
  }

  @override
  Future<ResumenPractica> cerrar(int id) async => resumenDeEjemplo;
}
