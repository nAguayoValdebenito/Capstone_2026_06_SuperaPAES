import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/dominio/entidades/resultado_evaluacion.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_resultados.dart';
import 'package:supera_paes/nucleo/errores.dart';

/// El mini-ensayo de M1 del boceto A30: 15 de 22, en 44 de 48 minutos.
const ResultadoEvaluacion miniEnsayoDePrueba = ResultadoEvaluacion(
  id: 41,
  tipo: 'mini_ensayo',
  tipoNombre: 'Mini-ensayo',
  prueba: 'Matemática M1',
  estado: 'entregada',
  cantidad: 22,
  puntuables: 22,
  correctas: 15,
  incorrectas: 4,
  omitidas: 3,
  porcentaje: 68.2,
  tiempoUsadoSeg: 44 * 60,
  duracionMin: 48,
  ejes: [
    GrupoDeResultado(nombre: 'Números', preguntas: 6, correctas: 5),
    GrupoDeResultado(nombre: 'Álgebra y funciones', preguntas: 8, correctas: 6),
    GrupoDeResultado(nombre: 'Geometría', preguntas: 4, correctas: 2),
  ],
  habilidades: [
    GrupoDeResultado(
      nombre: 'Resolver problemas',
      preguntas: 22,
      correctas: 15,
    ),
  ],
);

/// El ensayo completo del boceto A32: 742 puntos con 46 de 60 que puntúan.
const ResultadoEvaluacion ensayoDePrueba = ResultadoEvaluacion(
  id: 42,
  tipo: 'ensayo',
  tipoNombre: 'Ensayo completo',
  prueba: 'Matemática M1',
  estado: 'entregada',
  cantidad: 65,
  puntuables: 60,
  correctas: 46,
  incorrectas: 10,
  omitidas: 4,
  porcentaje: 76.7,
  tiempoUsadoSeg: 131 * 60,
  duracionMin: 140,
  puntaje: 742,
  tablaConversion: TablaConversion(anioAdmision: 2026, proceso: 'Regular'),
  ejes: [GrupoDeResultado(nombre: 'Números', preguntas: 16, correctas: 14)],
  habilidades: [],
);

PreguntaRevisada _pregunta(
  int orden,
  ResultadoPregunta resultado, {
  int? elegida,
  String eje = 'Números',
}) => PreguntaRevisada(
  orden: orden,
  eje: eje,
  resultado: resultado,
  enunciado: 'Enunciado de la pregunta $orden',
  explicacion: 'Explicación de la pregunta $orden',
  alternativaElegidaId: elegida,
  alternativaCorrectaId: 3,
  alternativas: const [
    AlternativaCorregida(
      id: 1,
      letra: 'A',
      texto: '12 cm²',
      explicacion: 'Se multiplicó el área por la razón.',
    ),
    AlternativaCorregida(id: 2, letra: 'B', texto: '16 cm²'),
    AlternativaCorregida(id: 3, letra: 'C', texto: '36 cm²'),
    AlternativaCorregida(id: 4, letra: 'D', texto: '48 cm²'),
  ],
);

/// Una correcta, una incorrecta (eligió la A) y una omitida, como en A33.
final List<PreguntaRevisada> revisionDePrueba = [
  _pregunta(1, ResultadoPregunta.correcta, elegida: 3),
  _pregunta(2, ResultadoPregunta.incorrecta, elegida: 1, eje: 'Geometría'),
  _pregunta(3, ResultadoPregunta.omitida),
];

/// Resultados sin red. Guarda qué evaluaciones se pidieron; con [error], toda
/// consulta falla.
class RepositorioResultadosFalso implements RepositorioResultados {
  RepositorioResultadosFalso({this.resultado = miniEnsayoDePrueba});

  ResultadoEvaluacion resultado;
  ErrorApi? error;
  final List<int> resultadosPedidos = [];
  final List<int> revisionesPedidas = [];

  @override
  Future<ResultadoEvaluacion> obtenerResultado(int evaluacionId) async {
    resultadosPedidos.add(evaluacionId);
    if (error case final fallo?) throw fallo;
    return resultado;
  }

  @override
  Future<List<PreguntaRevisada>> obtenerRevision(int evaluacionId) async {
    revisionesPedidas.add(evaluacionId);
    if (error case final fallo?) throw fallo;
    return revisionDePrueba;
  }
}
