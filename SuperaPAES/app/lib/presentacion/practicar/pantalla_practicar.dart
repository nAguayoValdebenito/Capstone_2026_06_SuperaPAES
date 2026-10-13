import 'package:flutter/material.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/comunes/en_construccion.dart';

/// Pantalla Elegir práctica (provisional).
class PantallaElegirPractica extends StatelessWidget {
  const PantallaElegirPractica({super.key});

  @override
  Widget build(BuildContext context) {
    return const EnConstruccion(
      descripcion: 'Elige qué practicar: una prueba, un eje o un contenido.',
      acciones: [
        AccionNavegacion('Empezar (provisional)', Rutas.pregunta),
        AccionNavegacion('Mini-ensayos y ensayo', Rutas.ensayos),
        AccionNavegacion('Repaso de errores', Rutas.repaso),
      ],
    );
  }
}
