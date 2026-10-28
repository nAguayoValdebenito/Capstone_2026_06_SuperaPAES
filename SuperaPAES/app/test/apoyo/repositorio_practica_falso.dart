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
  RepositorioPracticaFalso({this.texto});

  final List<DatosPractica> iniciadas = [];
  final List<String> cursos = [];

  /// Errores que responde iniciar, uno por intento, antes de empezar.
  final List<ErrorApi> erroresAlIniciar = [];

  /// Si no es `null`, cada pregunta trae este texto de lectura (A20).
  final TextoDeLectura? texto;

  /// Si no es `null`, pedir la siguiente pregunta responde este error.
  ErrorApi? errorAlSiguiente;

  /// Si no es `null`, responder responde este error.
  ErrorApi? errorAlResponder;

  /// Respuestas enviadas: (ítem, alternativa).
  final List<(int, int)> respuestas = [];
  int pedidas = 0;
  int _cantidad = 10;

  /// La pregunta del boceto A17; la C (32) es la correcta.
  PreguntaDePractica preguntaNumero(int orden) => PreguntaDePractica(
    itemId: 1000 + orden,
    orden: orden,
    total: _cantidad,
    enunciado: 'Si log2(x) = 5, ¿cuál es el valor de x?',
    texto: texto,
    alternativas: [
      for (final (i, (letra, valor)) in const [
        ('A', '10'),
        ('B', '25'),
        ('C', '32'),
        ('D', '7'),
      ].indexed)
        AlternativaVisible(id: orden * 10 + i, letra: letra, texto: valor),
    ],
  );

  @override
  Future<PreguntaDePractica> siguiente(int practicaId) async {
    pedidas++;
    if (errorAlSiguiente case final error?) throw error;
    if (respuestas.length >= _cantidad) {
      throw const ErrorApi(
        codigo: 'PRACTICA_COMPLETA',
        mensaje: 'Ya respondiste todas las preguntas.',
      );
    }
    // Mientras no se responda, la misma pregunta (como el servidor).
    return preguntaNumero(respuestas.length + 1);
  }

  @override
  Future<Correccion> responder(
    int practicaId,
    int itemId,
    int alternativaId,
  ) async {
    if (errorAlResponder case final error?) throw error;
    respuestas.add((itemId, alternativaId));
    final correcta = (itemId - 1000) * 10 + 2;
    return Correccion(
      esCorrecta: alternativaId == correcta,
      alternativaElegidaId: alternativaId,
      alternativaCorrectaId: correcta,
      explicacion: 'Si log2(x) = 5, entonces x = 2⁵ = 32.',
    );
  }

  @override
  Future<OpcionesPractica> opciones(String curso) async {
    cursos.add(curso);
    return opcionesPracticaDePrueba;
  }

  @override
  Future<PracticaIniciada> iniciar(DatosPractica datos) async {
    iniciadas.add(datos);
    if (erroresAlIniciar.isNotEmpty) throw erroresAlIniciar.removeAt(0);
    _cantidad = datos.cantidad;
    respuestas.clear();
    return PracticaIniciada(
      id: 41,
      pruebaId: datos.pruebaId,
      cantidad: datos.cantidad,
    );
  }

  @override
  Future<ResumenPractica> cerrar(int id) async => resumenDeEjemplo;
}
