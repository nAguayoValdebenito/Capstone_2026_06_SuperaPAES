import 'package:supera_paes/dominio/entidades/progreso.dart';
import 'package:supera_paes/dominio/repositorios/repositorio_progreso.dart';
import 'package:supera_paes/nucleo/errores.dart';

/// El progreso del boceto A35 en M1 (id 2): 68 % con 214 respuestas, un eje
/// a reforzar, seis semanas y un ensayo. Lectora (id 1) va por habilidad;
/// Ciencias (id 5) no tiene respuestas (A36).
final ProgresoEstudiante progresoDeEjemplo = ProgresoEstudiante(
  pruebas: [
    ProgresoPrueba(
      pruebaId: 2,
      codigo: 'M1',
      respondidas: 214,
      acierto: 68,
      aciertoPorDificultad: const {'facil': 82, 'media': 66, 'dificil': 41},
      ejes: const [
        GrupoProgreso(
          id: 1,
          nombre: 'Números',
          respondidas: 80,
          aciertoPonderado: 74,
          aReforzar: false,
        ),
        GrupoProgreso(
          id: 3,
          nombre: 'Geometría',
          respondidas: 40,
          aciertoPonderado: 47,
          aReforzar: true,
        ),
      ],
      habilidades: const [],
      semanas: [
        for (final (i, acierto) in [52.0, 58.0, 55.0, 61.0, 64.0, 68.0].indexed)
          SemanaProgreso(
            lunes: DateTime(2026, 9, 14 + 7 * i),
            respondidas: 30,
            acierto: acierto,
          ),
      ],
      ensayos: [
        EnsayoProgreso(
          id: 9,
          cerradaEn: DateTime(2026, 10, 18, 12),
          puntaje: 742,
        ),
      ],
    ),
    const ProgresoPrueba(
      pruebaId: 1,
      codigo: 'CL',
      respondidas: 12,
      acierto: 50,
      aciertoPorDificultad: {'media': 50},
      ejes: [
        GrupoProgreso(
          id: 7,
          nombre: 'Eje de Lectora',
          respondidas: 12,
          aciertoPonderado: 50,
          aReforzar: false,
        ),
      ],
      habilidades: [
        GrupoProgreso(
          id: 2,
          nombre: 'Interpretar',
          respondidas: 12,
          aciertoPonderado: 50,
          aReforzar: true,
        ),
      ],
      semanas: [],
      ensayos: [],
    ),
  ],
);

/// Repositorio del progreso sin red: responde [progreso] o, si no es
/// `null`, [error]. Cuenta las consultas para comprobar cuándo se relee.
class RepositorioProgresoFalso implements RepositorioProgreso {
  RepositorioProgresoFalso({ProgresoEstudiante? progreso})
    : progreso = progreso ?? progresoDeEjemplo;

  ProgresoEstudiante progreso;
  ErrorApi? error;
  int consultas = 0;

  @override
  Future<ProgresoEstudiante> obtener() async {
    consultas++;
    if (error case final fallo?) throw fallo;
    return progreso;
  }
}
