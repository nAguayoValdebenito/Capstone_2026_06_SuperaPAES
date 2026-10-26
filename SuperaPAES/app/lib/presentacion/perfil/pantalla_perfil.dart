import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/comunes/en_construccion.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';

/// Pestaña Perfil (A37, provisional): cuenta, perfil de estudio, planes,
/// invitaciones, datos personales y documentos legales. Cerrar sesión ya
/// funciona (HU-02 esc. 3).
class PantallaPerfil extends ConsumerWidget {
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
  Widget build(BuildContext context, WidgetRef ref) {
    final textos = Theme.of(context).textTheme;
    final estudiante = ref.watch(sesionProvider).value?.estudiante;
    return EnConstruccion(
      descripcion: 'Administra tu cuenta, tu plan y tus datos personales.',
      hijos: [
        if (estudiante != null) ...[
          const SizedBox(height: 20),
          Text('Cuenta', style: textos.titleMedium),
          const SizedBox(height: 4),
          Text(estudiante.nombre, style: textos.bodyMedium),
          Text(estudiante.correo, style: textos.bodyMedium),
        ],
        for (final (titulo, detalle) in _apartados) ...[
          const SizedBox(height: 20),
          Text(titulo, style: textos.titleMedium),
          const SizedBox(height: 4),
          Text(detalle, style: textos.bodyMedium),
        ],
        const SizedBox(height: 24),
        const _BotonCerrarSesion(),
      ],
      acciones: const [
        AccionNavegacion('Planes', Rutas.planes),
        AccionNavegacion('Invitar', Rutas.invitaciones),
        AccionNavegacion('Términos y condiciones', Rutas.terminos),
        AccionNavegacion('Política de privacidad', Rutas.privacidad),
      ],
    );
  }
}

/// Cierra la sesión en la API y en el teléfono. Sin sesión, el enrutador
/// lleva a Iniciar sesión.
class _BotonCerrarSesion extends ConsumerStatefulWidget {
  const _BotonCerrarSesion();

  @override
  ConsumerState<_BotonCerrarSesion> createState() => _BotonCerrarSesionState();
}

class _BotonCerrarSesionState extends ConsumerState<_BotonCerrarSesion> {
  bool _cerrando = false;

  Future<void> _cerrar() async {
    setState(() => _cerrando = true);
    await ref.read(sesionProvider.notifier).cerrar();
    if (mounted) setState(() => _cerrando = false);
  }

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: _cerrando ? null : _cerrar,
      icon: const Icon(Icons.logout),
      label: const Text('Cerrar sesión'),
    );
  }
}
