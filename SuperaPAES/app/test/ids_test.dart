import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supera_paes/datos/modelos/documento_legal_modelo.dart';
import 'package:supera_paes/datos/modelos/sesion_estudiante_modelo.dart';
import 'package:supera_paes/datos/repositorios/almacen_sesion_seguro.dart';
import 'package:supera_paes/nucleo/ids.dart';

Map<String, dynamic> _sesionConId(Object id) => {
  'tokenAcceso': 'acceso',
  'tokenRenovacion': 'renovacion',
  'estudiante': {
    'id': id,
    'nombre': 'Camila Rojas',
    'correo': 'camila@ejemplo.cl',
    'correoVerificado': false,
  },
};

void main() {
  group('leerId', () {
    test('acepta un entero positivo, como los entrega la API', () {
      expect(leerId(4), 4);
    });

    test('acepta un texto con dígitos, como los entregaba antes', () {
      expect(leerId('4'), 4);
    });

    test('rechaza lo que no es un id', () {
      for (final valor in <Object?>[null, 0, -3, '', 'abc', '4.5', 4.5]) {
        expect(
          () => leerId(valor),
          throwsFormatException,
          reason: 'valor: $valor',
        );
      }
    });
  });

  test('la sesión del ingreso lee el id del estudiante como número', () {
    expect(SesionEstudianteModelo.fromJson(_sesionConId(4)).id, 4);
    expect(SesionEstudianteModelo.fromJson(_sesionConId('4')).id, 4);
  });

  test('el documento legal lee su id como número', () {
    final modelo = DocumentoLegalModelo.fromJson({
      'id': 2,
      'tipo': 'privacidad',
      'nombre': 'Política de privacidad',
      'version': '1.0',
      'texto': '',
      'vigenteDesde': '2026-10-19T03:00:00.000Z',
    });
    expect(modelo.id, 2);
  });

  test('una sesión guardada con el id como texto se sigue leyendo', () async {
    FlutterSecureStorage.setMockInitialValues({
      'sesion_estudiante': jsonEncode(_sesionConId('4')),
    });
    const almacen = AlmacenSesionSeguro();

    final sesion = await almacen.leer();
    expect(sesion?.estudiante.id, 4);

    // Al guardarla de nuevo queda con el id como número.
    await almacen.guardar(sesion!);
    final guardada = await const FlutterSecureStorage().read(
      key: 'sesion_estudiante',
    );
    final estudiante =
        (jsonDecode(guardada!) as Map<String, dynamic>)['estudiante']
            as Map<String, dynamic>;
    expect(estudiante['id'], 4);
  });
}
