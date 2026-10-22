import 'package:flutter/material.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/comunes/en_construccion.dart';

/// Pestaña Perfil (A37, provisional): cuenta, perfil de estudio, planes,
/// invitaciones, datos personales y documentos legales.
class PantallaPerfil extends StatelessWidget {
  const PantallaPerfil({super.key});

  static const _apartados = [
    (
      'Perfil de estudio',
      'Tu curso, las pruebas que rendirás, la prueba que quieres reforzar y '
          'tus áreas de carrera de interés.',
    ),
    (
      'Puntajes PAES',
      'Puntajes reales que quieras declarar (100 a 1.000). Son opcionales y '
          'solo se usan en métricas agregadas con tu permiso.',
    ),
    (
      'Solicitudes sobre mis datos',
      'Pide acceso, rectificación, portabilidad u otros derechos sobre tus '
          'datos personales.',
    ),
    ('Borrar mi cuenta', 'Elimina tu cuenta y tus datos personales.'),
  ];

  @override
  Widget build(BuildContext context) {
    final textos = Theme.of(context).textTheme;
    return EnConstruccion(
      descripcion: 'Administra tu cuenta, tu plan y tus datos personales.',
      hijos: [
        for (final (titulo, detalle) in _apartados) ...[
          const SizedBox(height: 20),
          Text(titulo, style: textos.titleMedium),
          const SizedBox(height: 4),
          Text(detalle, style: textos.bodyMedium),
        ],
      ],
      acciones: const [
        AccionNavegacion('Planes', Rutas.planes),
        AccionNavegacion('Invitar', Rutas.invitaciones),
        AccionNavegacion('Términos y condiciones', Rutas.terminos),
        AccionNavegacion('Política de privacidad', Rutas.privacidad),
        AccionNavegacion(
          'Cerrar sesión (provisional)',
          Rutas.ingreso,
          reemplazar: true,
        ),
      ],
    );
  }
}
