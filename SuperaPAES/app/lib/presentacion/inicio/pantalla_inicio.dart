import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/en_construccion.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/inicio/aviso_verificar_correo.dart';
import 'package:supera_paes/presentacion/inicio/estado_inicio.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
import 'package:supera_paes/presentacion/perfil_estudio/hoja_confirmar_curso.dart';

/// Inicio del estudiante. Por ahora muestra el aviso de correo sin verificar
/// y el estado de la API; al empezar el año escolar, pide confirmar el curso
/// (A11).
class PantallaInicio extends ConsumerStatefulWidget {
  const PantallaInicio({super.key});

  @override
  ConsumerState<PantallaInicio> createState() => _PantallaInicioState();
}

class _PantallaInicioState extends ConsumerState<PantallaInicio> {
  /// La hoja de A11 se muestra una vez por apertura de Inicio.
  bool _hojaAbierta = false;

  /// Al volver a la app se lee de nuevo el perfil: si empezó marzo mientras
  /// estaba en segundo plano, A11 aparece sin reiniciarla.
  late final AppLifecycleListener _ciclo;

  @override
  void initState() {
    super.initState();
    _ciclo = AppLifecycleListener(
      onResume: () => ref.invalidate(perfilProvider),
    );
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _revisarCurso(ref.read(perfilProvider).value),
    );
  }

  @override
  void dispose() {
    _ciclo.dispose();
    super.dispose();
  }

  Future<void> _revisarCurso(PerfilEstudiante? perfil) async {
    if (_hojaAbierta || !mounted || perfil == null) return;
    if (!perfil.debeConfirmarCurso) return;
    _hojaAbierta = true;
    await mostrarConfirmarCurso(context, perfil);
    _hojaAbierta = false;
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(perfilProvider, (_, perfil) => _revisarCurso(perfil.value));
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
