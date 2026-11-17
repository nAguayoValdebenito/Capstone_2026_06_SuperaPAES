import 'package:clock/clock.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/dominio/entidades/sesion_estudiante.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/rutas_navegacion.dart';
import 'package:supera_paes/presentacion/cupo_agotado/pantalla_cupo_agotado.dart';

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
  group('Tiempo para volver (A22)', () {
    final ahora = DateTime.utc(2026, 11, 3, 20, 48);
    String regreso(Duration falta) => textoDeRegreso(ahora.add(falta), ahora);

    test('dice las horas y los minutos que faltan', () {
      expect(
        regreso(const Duration(hours: 6, minutes: 12)),
        'Vuelve en 6 h 12 min, o sigue ahora con lo que no usa cupo.',
      );
      expect(regreso(const Duration(hours: 2)), startsWith('Vuelve en 2 h,'));
      expect(
        regreso(const Duration(minutes: 5)),
        startsWith('Vuelve en 5 min,'),
      );
    });

    test('redondea hacia arriba: nunca dice 0 min', () {
      expect(
        regreso(const Duration(seconds: 20)),
        startsWith('Vuelve en 1 min,'),
      );
      expect(
        regreso(const Duration(minutes: 59, seconds: 30)),
        startsWith('Vuelve en 1 h,'),
      );
    });

    test('sin la hora de la API, dice la hora fija del reinicio', () {
      expect(
        textoDeRegreso(null, ahora),
        'Vuelve a las 00:00 (hora de Chile), o sigue ahora con lo que no usa '
        'cupo.',
      );
    });

    test('si ya pasó el reinicio, lo dice', () {
      expect(
        regreso(const Duration(seconds: -1)),
        'Tu cupo ya se reinició. Vuelve a Inicio para seguir practicando.',
      );
    });
  });

  group('Cupo agotado (A22)', () {
    testWidgets('cuenta el tiempo con la hora de la API y se actualiza sola', (
      tester,
    ) async {
      var ahora = DateTime.utc(2026, 10, 28, 20, 48);
      await withClock(Clock(() => ahora), () async {
        await iniciarApp(
          tester,
          crearContenedor(sesion: sesionDeEjemplo),
          ruta: Rutas.cupoAgotado,
        );
        expect(
          find.text(
            'Vuelve en 6 h 12 min, o sigue ahora con lo que no usa cupo.',
          ),
          findsOne,
        );

        ahora = ahora.add(const Duration(minutes: 2));
        await tester.pump(const Duration(seconds: 30));

        expect(find.textContaining('Vuelve en 6 h 10 min'), findsOne);
      });
    });

    testWidgets('explica cuándo se reinicia y cómo seguir hoy, con verificar '
        'el correo si falta (esc. 2)', (tester) async {
      final contenedor = crearContenedor(sesion: sesionDeEjemplo);
      await iniciarApp(tester, contenedor, ruta: Rutas.cupoAgotado);

      expect(find.text('Por hoy completaste tu cupo'), findsOne);
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
      ('Suscríbete', rutaPlanesEnRama(Rutas.inicio)),
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
      expect(find.text('Por hoy completaste tu cupo'), findsOne);
    });
  });
}
