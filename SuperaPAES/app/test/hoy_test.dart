import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/dominio/entidades/evaluacion_abierta.dart';
import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';

import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_evaluaciones_falso.dart';
import 'apoyo/repositorio_perfil_falso.dart';
import 'apoyo/repositorio_practica_falso.dart';

/// El perfil de ejemplo sin prueba a reforzar.
final PerfilEstudiante _sinReforzar = PerfilEstudiante(
  completo: true,
  curso: perfilCompleto.curso,
  anioEgreso: perfilCompleto.anioEgreso,
  pruebas: perfilCompleto.pruebas,
  electivoId: perfilCompleto.electivoId,
  pruebaReforzarId: null,
  areasCarrera: perfilCompleto.areasCarrera,
  debeConfirmarCurso: false,
);

/// Qué hacer hoy en Inicio (A12, plan de mejora visual del 02/11, tanda C).
void main() {
  group('Tarjeta «Hoy»', () {
    testWidgets('con diagnósticos pendientes parte por la prueba a reforzar, '
        'con sus preguntas, y lleva a A16', (tester) async {
      final contenedor = crearContenedor(
        sesion: sesionDeEjemplo,
        evaluaciones: RepositorioEvaluacionesFalso()
          ..diagnosticoDisponible = true,
      );
      await iniciarApp(tester, contenedor, ruta: Rutas.inicio);

      expect(find.text('Hoy: haz el diagnóstico de M1.'), findsOne);
      expect(
        find.textContaining(
          'preguntas, no usa tu cupo. Con él sabremos qué '
          'ejes reforzar primero.',
        ),
        findsOne,
      );

      await tocar(tester, find.text('Empezar'));
      expect(rutaActual(contenedor), Rutas.ofrecerDiagnostico);
    });

    testWidgets('sin diagnóstico pendiente sugiere la prueba a reforzar', (
      tester,
    ) async {
      final contenedor = crearContenedor(sesion: sesionDeEjemplo);
      await iniciarApp(tester, contenedor, ruta: Rutas.inicio);

      expect(find.text('Hoy: refuerza M1.'), findsOne);

      await tocar(tester, find.text('Empezar'));
      expect(rutaActual(contenedor), Rutas.practicar);
      expect(contenedor.read(borradorPracticaProvider).pruebaId, 2);
    });

    testWidgets('sin diagnóstico ni prueba a reforzar, la práctica libre', (
      tester,
    ) async {
      final contenedor = crearContenedor(
        sesion: sesionDeEjemplo,
        perfil: RepositorioPerfilFalso(perfil: _sinReforzar),
      );
      await iniciarApp(tester, contenedor, ruta: Rutas.inicio);

      expect(find.text('Hoy: elige qué practicar.'), findsOne);

      await tocar(tester, find.text('Empezar'));
      expect(rutaActual(contenedor), Rutas.practicar);
    });

    testWidgets(
      'lo que quedó sin terminar va primero, en vez de la sugerencia',
      (tester) async {
        final practica = RepositorioPracticaFalso()
          ..consultaAbierta = const ConsultaEvaluacionAbierta(
            abierta: EvaluacionAbierta(
              id: 5,
              tipo: 'practica',
              tipoNombre: 'Práctica',
              pruebaId: 2,
              prueba: 'Matemática M1',
              alcance: Alcance(TipoAlcance.eje, id: 11, nombre: 'Álgebra'),
              dificultadId: 2,
              cantidad: 10,
              respondidas: 3,
            ),
          );
        await iniciarApp(
          tester,
          crearContenedor(
            sesion: sesionDeEjemplo,
            practica: practica,
            evaluaciones: RepositorioEvaluacionesFalso()
              ..diagnosticoDisponible = true,
          ),
          ruta: Rutas.inicio,
        );

        expect(find.text('Práctica sin terminar'), findsOne);
        expect(find.textContaining('Hoy:'), findsNothing);
      },
    );
  });
}
