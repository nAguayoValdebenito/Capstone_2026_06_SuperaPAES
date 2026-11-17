import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/dominio/entidades/progreso.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/error_con_reintento.dart';
import 'package:supera_paes/presentacion/comunes/estados.dart';
import 'package:supera_paes/presentacion/comunes/sello_prueba.dart';
import 'package:supera_paes/presentacion/inicio/pruebas_inicio.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';
import 'package:supera_paes/presentacion/progreso/estado_progreso.dart';
import 'package:supera_paes/presentacion/progreso/tarjetas_progreso.dart';
import 'package:supera_paes/presentacion/puntajes/estado_puntajes.dart';

/// Pestaña Progreso (A35 y A36; HU-38.3, RF-A10, CU-08): por cada prueba del
/// perfil, el acierto con su detalle por dificultad, los ejes (en Lectora,
/// las habilidades) con su nivel, el avance semana a semana y los ensayos
/// completos. Abajo, el Historial y el puntaje PAES real. Es el mismo con
/// cualquier plan (HU-38 esc. 4). Una prueba sin respuestas invita a
/// practicarla (A36).
class PantallaProgreso extends ConsumerStatefulWidget {
  const PantallaProgreso({super.key});

  @override
  ConsumerState<PantallaProgreso> createState() => _PantallaProgresoState();
}

class _PantallaProgresoState extends ConsumerState<PantallaProgreso> {
  /// La prueba elegida en los chips; sin elegir, la primera del perfil.
  int? _pruebaId;

  Future<void> _actualizar() async {
    ref.invalidate(progresoProvider);
    try {
      await ref.read(progresoProvider.future);
    } on Object {
      // El error se muestra en la pantalla con «Reintentar».
      return;
    }
  }

  @override
  Widget build(BuildContext context) {
    final perfil = ref.watch(perfilProvider).value;
    final nombres = ref.watch(opcionesPerfilProvider).value;
    final progreso = ref.watch(progresoProvider);
    final pruebas = perfil == null || nombres == null
        ? const <PruebaDeInicio>[]
        : pruebasDeInicio(perfil, nombres);
    final elegida =
        pruebas.where((p) => p.id == _pruebaId).firstOrNull ??
        pruebas.firstOrNull;
    return PantallaFormulario(
      separacion: 14,
      alActualizar: _actualizar,
      hijos: [
        const Encabezado(titulo: 'Progreso'),
        if (pruebas.length > 1)
          Wrap(
            spacing: TemaSuperaPaes.espacio8,
            children: [
              for (final prueba in pruebas)
                ChipPrueba(
                  prueba: Prueba.deCodigo(
                    nombres?.prueba(prueba.id)?.codigo ?? '',
                  ),
                  seleccionado: prueba.id == elegida?.id,
                  onTap: () => setState(() => _pruebaId = prueba.id),
                ),
            ],
          ),
        ...switch ((progreso, elegida)) {
          (AsyncError(:final error), _) => [
            ErrorConReintento(
              error: error,
              mensaje: 'No se pudo cargar tu progreso.',
              alReintentar: () => ref.invalidate(progresoProvider),
            ),
          ],
          (AsyncData(value: final ProgresoEstudiante datos), final prueba?) =>
            _contenido(datos.prueba(prueba.id), prueba, nombres),
          (AsyncData(), null) => [const SizedBox.shrink()],
          _ => [
            const GrupoEsqueleto(
              child: Column(
                children: [
                  EsqueletoTarjeta(lineas: 4),
                  SizedBox(height: TemaSuperaPaes.espacio16),
                  EsqueletoTarjeta(lineas: 3),
                ],
              ),
            ),
          ],
        },
        if (elegida != null) _Accesos(pruebaId: elegida.id),
      ],
    );
  }

  List<Widget> _contenido(
    ProgresoPrueba? progreso,
    PruebaDeInicio prueba,
    OpcionesPerfil? nombres,
  ) {
    final datos = nombres?.prueba(prueba.id);
    final nombre = datos?.nombreCorto ?? prueba.titulo;
    final sello = Prueba.deCodigo(datos?.codigo ?? '');
    if (progreso == null || progreso.respondidas == 0) {
      return [
        _SinRespuestas(
          prueba: prueba,
          nombre: nombre,
          porHabilidad: datos?.codigo == 'CL',
        ),
      ];
    }
    return [
      TarjetaAcierto(progreso: progreso, nombre: nombre, prueba: sello),
      if (progreso.grupos.isNotEmpty) ...[
        TituloSeccion(progreso.porHabilidad ? 'Por habilidad' : 'Por eje'),
        TarjetaGrupos(progreso: progreso),
      ],
      if (progreso.semanas.isNotEmpty) ...[
        const TituloSeccion('Semana a semana'),
        TarjetaSemanas(semanas: progreso.semanas),
      ],
      if (progreso.ensayos.isNotEmpty) ...[
        const TituloSeccion('Ensayos completos'),
        TarjetaEnsayos(ensayos: progreso.ensayos),
      ],
    ];
  }
}

/// «Historial» y «Tu puntaje PAES real» de la prueba elegida, que abre A41
/// (HU-41 esc. 2, RF-A17).
class _Accesos extends ConsumerWidget {
  const _Accesos({required this.pruebaId});

  final int pruebaId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final real = ref.watch(puntajesProvider).value?.dePrueba(pruebaId);
    return ListaDeFilas(
      filas: [
        FilaNavegacion(
          texto: 'Historial',
          detalle: 'Tus prácticas y evaluaciones',
          icono: Icons.history_rounded,
          onTap: () => unawaited(context.push(Rutas.historial)),
        ),
        FilaNavegacion(
          texto: 'Tu puntaje PAES real',
          detalle: real == null
              ? 'Aún no lo cargas'
              : '${real.puntaje} puntos · Admisión ${real.anioAdmision}',
          icono: Icons.emoji_events_outlined,
          onTap: () => unawaited(context.push(Rutas.puntajes)),
        ),
      ],
    );
  }
}

/// A36: la prueba todavía no tiene respuestas; se invita a practicarla.
class _SinRespuestas extends ConsumerWidget {
  const _SinRespuestas({
    required this.prueba,
    required this.nombre,
    required this.porHabilidad,
  });

  final PruebaDeInicio prueba;

  /// Nombre corto del botón: «Practicar M1».
  final String nombre;

  /// Lectora se mide por habilidad (RN-14).
  final bool porHabilidad;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return EstadoVacio(
      titulo: 'Todavía no respondes preguntas de ${prueba.titulo}',
      texto:
          'Cuando practiques, aquí verás tu acierto por dificultad, por '
          '${porHabilidad ? 'habilidad' : 'eje'}, lo que conviene reforzar '
          'y tu avance semana a semana.',
      accion: 'Practicar $nombre',
      alTocar: () {
        ref.read(borradorPracticaProvider.notifier).elegirPrueba(prueba.id);
        context.go(Rutas.practicar);
      },
    );
  }
}
