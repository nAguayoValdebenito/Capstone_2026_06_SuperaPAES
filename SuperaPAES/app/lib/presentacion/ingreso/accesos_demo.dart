import 'package:flutter/material.dart';

import 'package:supera_paes/nucleo/tema.dart';

/// Cuenta de prueba de la base local de demostración.
class AccesoDemo {
  const AccesoDemo(this.etiqueta, this.correo);

  final String etiqueta;
  final String correo;
}

/// Solo en desarrollo: la pantalla de ingreso lo usa bajo `kDebugMode`, así
/// que la versión de publicación no lleva estas cuentas.
const String claveDemo = 'clave-para-probar-local';

const List<AccesoDemo> accesosDemo = [
  AccesoDemo('Estudiante con avance', 'demo@ejemplo.cl'),
  AccesoDemo('Estudiante con plan', 'plan@ejemplo.cl'),
];

/// Botones para entrar a la demostración con un toque.
class AccesosDemo extends StatelessWidget {
  const AccesosDemo({required this.onElegir, super.key});

  /// Null mientras se envía el ingreso.
  final ValueChanged<AccesoDemo>? onElegir;

  @override
  Widget build(BuildContext context) {
    final elegir = onElegir;
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Entrar a la demostración como:',
            textAlign: TextAlign.center,
            style: TemaSuperaPaes.cuerpo.copyWith(
              color: TemaSuperaPaes.textoSecundario,
            ),
          ),
          for (final acceso in accesosDemo)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: OutlinedButton(
                onPressed: elegir == null ? null : () => elegir(acceso),
                child: Text(acceso.etiqueta),
              ),
            ),
        ],
      ),
    );
  }
}
