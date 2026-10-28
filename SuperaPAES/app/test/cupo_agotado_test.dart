import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/dominio/entidades/sesion_estudiante.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';

import 'apoyo/app_de_prueba.dart';
import 'apoyo/repositorio_cuentas_falso.dart';
import 'apoyo/repositorio_practica_falso.dart';

/// La sesión de ejemplo con el correo ya verificado.
final _verificada = SesionEstudiante(
  tokenAcceso: sesionDeEjemplo.tokenAcceso,
  tokenRenovacion: sesionDeEjemplo.tokenRenovacion,
  estudiante: Estudiante(
    id: sesionDeEjemplo.estudiante.id,
    nombre: sesionDeEjemplo.estudiante.nombre,
    correo: sesionDeEjemplo.estudiante.correo,
    correoVerificado: true,
  ),
);

void main() {
  group('Cupo agotado (A22)', () {
    testWidgets('explica cuándo se reinicia y cómo seguir hoy, con verificar '
        'el correo si falta (esc. 2)', (tester) async {
      final contenedor = crearContenedor(sesion: sesionDeEjemplo);
      await iniciarApp(tester, contenedor, ruta: Rutas.cupoAgotado);

      expect(find.text('Usaste tus preguntas de hoy'), findsOne);
      expect(
        find.text('Se reinician a las 00:00 (hora de Chile). Para seguir hoy:'),
        findsOne,
      );
      for (final opcion in [
        'Verifica tu correo',
        'Invita a alguien',
        'Suscríbete',
        'No usan tu cupo',
        'Repasar errores',
        'Mini-ensayo',
      ]) {
        expect(find.text(opcion), findsOne, reason: opcion);
      }
      expect(find.text('Pasas de 10 a 20 preguntas diarias.'), findsOne);

      await tocar(tester, find.text('Verifica tu correo'));
      expect(rutaActual(contenedor), Rutas.verificarCorreo);
    });

    testWidgets('con el correo verificado no ofrece verificarlo', (
      tester,
    ) async {
      await iniciarApp(
        tester,
        crearContenedor(sesion: _verificada),
        ruta: Rutas.cupoAgotado,
      );

      expect(find.text('Verifica tu correo'), findsNothing);
      expect(find.text('Invita a alguien'), findsOne);
    });

    for (final (opcion, destino) in [
      ('Invita a alguien', Rutas.invitaciones),
      ('Suscríbete', Rutas.planes),
      ('Repasar errores', Rutas.repaso),
      ('Mini-ensayo', Rutas.evaluaciones),
    ]) {
      testWidgets('«$opcion» abre su pantalla', (tester) async {
        final contenedor = crearContenedor(sesion: _verificada);
        await iniciarApp(tester, contenedor, ruta: Rutas.cupoAgotado);

        await tocar(tester, find.text(opcion));

        expect(rutaActual(contenedor), destino);
      });
    }

    testWidgets('«Inicio» vuelve al inicio', (tester) async {
      final contenedor = crearContenedor(sesion: _verificada);
      await iniciarApp(tester, contenedor, ruta: Rutas.cupoAgotado);

      await tocar(tester, find.text('Inicio').first);

      expect(rutaActual(contenedor), Rutas.inicio);
    });

    testWidgets('sin cupo, empezar una práctica lleva aquí (esc. 1)', (
      tester,
    ) async {
      final repositorio = RepositorioPracticaFalso()
        ..erroresAlIniciar.add(
          const ErrorApi(
            codigo: 'CUPO_AGOTADO',
            mensaje:
                'Ya usaste tus preguntas de hoy y no te quedan preguntas '
                'extra.',
          ),
        );
      final contenedor = crearContenedor(
        sesion: sesionDeEjemplo,
        practica: repositorio,
      );
      await iniciarApp(tester, contenedor, ruta: Rutas.practicar);

      await tocar(tester, find.text('Empezar práctica'));

      expect(rutaActual(contenedor), Rutas.cupoAgotado);
      expect(find.text('Usaste tus preguntas de hoy'), findsOne);
    });
  });
}
