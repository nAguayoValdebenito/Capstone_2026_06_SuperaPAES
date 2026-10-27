import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/en_construccion.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/inicio/aviso_verificar_correo.dart';
import 'package:supera_paes/presentacion/inicio/estado_inicio.dart';

/// Inicio del estudiante. Por ahora muestra el aviso de correo sin verificar
/// y el estado de la API.
class PantallaInicio extends ConsumerWidget {
  const PantallaInicio({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final salud = ref.watch(estadoSaludProvider);

    final sinVerificar =
        ref.watch(sesionProvider).value?.estudiante.correoVerificado == false;

    return EnConstruccion(
      encabezado: sinVerificar ? const AvisoVerificarCorreo() : null,
      descripcion:
          'Aquí verás tu resumen de práctica, tu racha y tu cupo del día.',
      acciones: const [
        AccionNavegacion('Invitaciones', Rutas.invitaciones),
        AccionNavegacion('Cupo agotado', Rutas.cupoAgotado),
      ],
      hijos: [
        const SizedBox(height: 24),
        Text(
          'Estado del sistema',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 8),
        salud.when(
          loading: () => const Text('Consultando la API…'),
          data: (estado) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('API: ${estado.estado}'),
              Text('Base de datos: ${estado.baseDeDatos}'),
            ],
          ),
          error: (error, _) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                error is ErrorApi
                    ? error.mensaje
                    : 'No se pudo consultar la API.',
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: () => ref.invalidate(estadoSaludProvider),
                child: const Text('Reintentar'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
