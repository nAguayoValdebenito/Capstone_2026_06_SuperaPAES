import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/dominio/entidades/evaluacion_con_tiempo.dart';
import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/comunes/boton_principal.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/error_con_reintento.dart';
import 'package:supera_paes/presentacion/evaluaciones/condiciones_evaluacion.dart';
import 'package:supera_paes/presentacion/evaluaciones/empezar_con_tiempo.dart';
import 'package:supera_paes/presentacion/evaluaciones/estado_evaluaciones.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';

/// Antes de empezar el mini-ensayo (A26; HU-40 esc. 1, 2 y 5, CU-10 pasos 3
/// y 4): las condiciones antes de fijar la hora de término. El reloj sigue
/// corriendo (RN-21), las respuestas se cambian hasta entregar, las omitidas
/// cuentan como incorrectas (RN-22), solo contenidos del curso (RN-24 y
/// RN-28) y el uso gratis del mes (RN-05).
class PantallaAntesDeEmpezar extends ConsumerStatefulWidget {
  const PantallaAntesDeEmpezar({super.key});

  @override
  ConsumerState<PantallaAntesDeEmpezar> createState() =>
      _PantallaAntesDeEmpezarState();
}

class _PantallaAntesDeEmpezarState extends ConsumerState<PantallaAntesDeEmpezar>
    with EmpezarConTiempo {
  @override
  Widget build(BuildContext context) {
    final perfil = ref.watch(perfilProvider).value;
    final pruebaId = ref.watch(pruebaDeEvaluacionesProvider);
    final prueba = pruebaId == null
        ? null
        : ref.watch(opcionesPerfilProvider).value?.prueba(pruebaId);
    if (pruebaId == null || perfil == null || prueba == null) {
      return const PantallaFormulario(
        hijos: [
          EnlaceVolver(texto: 'Evaluaciones', destino: Rutas.evaluaciones),
          Encabezado(
            titulo: 'Elige una prueba',
            bajada: 'Vuelve a Evaluaciones y elige qué mini-ensayo rendir.',
          ),
        ],
      );
    }
    final consulta = ref.watch(disponibilidadMiniProvider(pruebaId));
    final mini = consulta.value;
    return PantallaFormulario(
      separacion: 14,
      hijos: [
        const EnlaceVolver(texto: 'Evaluaciones', destino: Rutas.evaluaciones),
        Encabezado(titulo: 'Mini-ensayo', bajada: prueba.nombreEnInicio),
        ...switch (consulta) {
          AsyncData(:final value) => _condiciones(value, perfil, prueba),
          AsyncError(:final error) => [
            ErrorConReintento(
              error: error,
              mensaje: 'No se pudo cargar el mini-ensayo.',
              alReintentar: () =>
                  ref.invalidate(disponibilidadMiniProvider(pruebaId)),
            ),
          ],
          _ => const [Center(child: CircularProgressIndicator())],
        },
      ],
      pie: PieConError(
        error: errorConTiempo,
        boton: BotonPrincipal(
          texto: 'Empezar ahora',
          estado: empezandoConTiempo
              ? EstadoBoton.cargando
              : EstadoBoton.normal,
          onPressed: mini == null || !mini.disponible
              ? null
              : () => empezarConTiempo(
                  () => ref
                      .read(evaluacionConTiempoProvider.notifier)
                      .empezarMiniEnsayo(pruebaId),
                  alRechazar: () =>
                      ref.invalidate(disponibilidadMiniProvider(pruebaId)),
                ),
        ),
      ),
    );
  }

  List<Widget> _condiciones(
    DisponibilidadMiniEnsayo mini,
    PerfilEstudiante perfil,
    PruebaPerfil prueba,
  ) {
    final curso = perfil.curso;
    final cierre = avisoDeCierre(ref);
    final uso = mini.conPlan
        ? 'Está incluido en tu plan.'
        : 'Usarás tu mini-ensayo gratis de ${prueba.nombreCorto} de este mes.';
    return [
      Row(
        children: [
          DatoResumen(valor: '${mini.cantidad}', texto: 'preguntas'),
          DatoResumen(valor: '${mini.duracionMin}', texto: 'minutos'),
          if (mini.ejes > 0)
            DatoResumen(valor: '${mini.ejes}', texto: 'ejes')
          else
            DatoResumen(valor: '${mini.habilidades}', texto: 'habilidades'),
        ],
      ),
      ...condicionesConTiempo,
      // Lectora no depende del curso: sus textos son de cualquier nivel.
      if (curso != null && !curso.esEgresado && prueba.codigo != 'CL')
        CondicionEvaluacion(
          icono: Icons.school_outlined,
          texto: 'Solo contenidos que se enseñan hasta ${curso.nombre}.',
        ),
      if (mini.disponible)
        Aviso(tono: TonoAviso.info, texto: [uso, ?cierre].join(' '))
      else
        const Aviso(
          tono: TonoAviso.aviso,
          texto:
              'Ya usaste tu mini-ensayo gratis de esta prueba este mes. '
              'Puedes esperar al próximo mes o ver los planes.',
        ),
    ];
  }
}
