import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supera_paes/dominio/entidades/historial.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/error_con_reintento.dart';
import 'package:supera_paes/presentacion/comunes/estados.dart';
import 'package:supera_paes/presentacion/comunes/movimiento.dart';
import 'package:supera_paes/presentacion/comunes/sello_prueba.dart';
import 'package:supera_paes/presentacion/inicio/evaluacion_sin_terminar.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
import 'package:supera_paes/presentacion/progreso/tarjetas_progreso.dart';
import 'package:supera_paes/presentacion/resultado/estado_resultado.dart';

/// Historial (A34; HU-62, RF-A24, CU-30): las evaluaciones cerradas, de la más
/// reciente a la más antigua, por páginas y con filtros por prueba y por
/// tipo. Marca las abandonadas y las recalculadas, y cada una abre su
/// resultado (CU-29). Lo que sigue abierto se ofrece arriba (CU-30 2.c).
class PantallaHistorial extends ConsumerWidget {
  const PantallaHistorial({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filtros = ref.watch(filtrosHistorialProvider);
    final historial = ref.watch(historialProvider);
    return PantallaFormulario(
      separacion: 12,
      alActualizar: () async {
        ref.invalidate(historialProvider);
        await ref.read(historialProvider.future);
      },
      hijos: [
        const EnlaceVolver(texto: 'Volver', destino: Rutas.progreso),
        const Encabezado(titulo: 'Historial'),
        SelectorSegmentado<String?>(
          key: const ValueKey('grupo-historial'),
          conMovimiento: true,
          opciones: const [
            (null, 'Todo'),
            ('practicas', 'Prácticas'),
            ('evaluaciones', 'Evaluaciones'),
          ],
          seleccionado: filtros.grupo,
          onChanged: ref.read(filtrosHistorialProvider.notifier).elegirGrupo,
        ),
        const _Filtros(),
        const EvaluacionSinTerminar(),
        ...switch (historial) {
          AsyncData(value: final PaginaHistorial pagina)
              when pagina.evaluaciones.isEmpty =>
            [_SinEvaluaciones(sinFiltros: filtros.sinFiltros)],
          AsyncData(value: final PaginaHistorial pagina) => [
            for (final evaluacion in pagina.evaluaciones)
              _TarjetaEvaluacion(evaluacion: evaluacion),
            _Paginas(pagina: pagina),
          ],
          AsyncError(:final error) => [
            ErrorConReintento(
              error: error,
              mensaje: 'No pudimos cargar tu historial.',
              alReintentar: () => ref.invalidate(historialProvider),
            ),
          ],
          _ => const [EsqueletoTarjeta(), EsqueletoTarjeta()],
        },
      ],
    );
  }
}

/// Filtros por prueba y por tipo (CU-30 paso 3). Cambiar uno vuelve a la
/// primera página.
class _Filtros extends ConsumerWidget {
  const _Filtros();

  static const List<(String, String)> _tipos = [
    ('practica', 'Práctica'),
    ('repaso', 'Repaso'),
    ('diagnostico', 'Diagnóstico'),
    ('mini_ensayo', 'Mini-ensayo'),
    ('ensayo', 'Ensayo completo'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filtros = ref.watch(filtrosHistorialProvider);
    final pruebas = ref.watch(opcionesPerfilProvider).value?.pruebas ?? [];
    final elegir = ref.read(filtrosHistorialProvider.notifier);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: _Filtro<int>(
            etiqueta: 'Prueba',
            todos: 'Todas',
            valor: filtros.pruebaId,
            opciones: [
              for (final prueba in pruebas) (prueba.id, prueba.nombreCorto),
            ],
            alCambiar: elegir.elegirPrueba,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _Filtro<String>(
            etiqueta: 'Tipo',
            todos: 'Todos',
            valor: filtros.tipo,
            opciones: _tipos,
            alCambiar: elegir.elegirTipo,
          ),
        ),
      ],
    );
  }
}

class _Filtro<T> extends StatelessWidget {
  const _Filtro({
    required this.etiqueta,
    required this.todos,
    required this.valor,
    required this.opciones,
    required this.alCambiar,
    super.key,
  });

  final String etiqueta;
  final String todos;
  final T? valor;
  final List<(T, String)> opciones;
  final ValueChanged<T?> alCambiar;

  @override
  Widget build(BuildContext context) {
    return CampoConEtiqueta(
      etiqueta: etiqueta,
      child: DropdownButtonFormField<T?>(
        initialValue: valor,
        isExpanded: true,
        items: [
          DropdownMenuItem(child: Text(todos)),
          for (final (codigo, nombre) in opciones)
            DropdownMenuItem(value: codigo, child: Text(nombre)),
        ],
        onChanged: alCambiar,
      ),
    );
  }
}

class _TarjetaEvaluacion extends ConsumerWidget {
  const _TarjetaEvaluacion({required this.evaluacion});

  final EvaluacionDelHistorial evaluacion;

  /// «22 preguntas · 15 correctas · 68 %», con el puntaje en el ensayo.
  String get _detalle => [
    if (evaluacion.cantidad == 1)
      '1 pregunta'
    else
      '${evaluacion.cantidad} preguntas',
    if (evaluacion.correctas == 1)
      '1 correcta'
    else
      '${evaluacion.correctas} correctas',
    if (evaluacion.puntaje case final puntaje?)
      '$puntaje puntos'
    else if (evaluacion.porcentaje case final porcentaje?)
      '${porcentaje.round()} %',
  ].join(' · ');

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    const nota = TemaSuperaPaes.pequenoFuerte;
    return Tarjeta(
      child: InkWell(
        onTap: () => abrirResultado(
          context,
          ref,
          evaluacion.id,
          desdeHistorial: true,
          codigoPrueba: evaluacion.codigoPrueba,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: HeroMode(
                enabled: !reducirMovimiento(context),
                child: Hero(
                  tag: 'sello-evaluacion-${evaluacion.id}',
                  child: SelloPrueba(
                    Prueba.deCodigo(evaluacion.codigoPrueba ?? ''),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 8,
              runSpacing: 4,
              children: [
                Etiqueta(texto: evaluacion.tipoNombre),
                Text(
                  fechaLarga(evaluacion.cerradaEn),
                  style: TemaSuperaPaes.pequeno.copyWith(
                    color: TemaSuperaPaes.textoSecundario,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              [evaluacion.prueba, ?evaluacion.alcance].join(' · '),
              style: TemaSuperaPaes.cuerpoFuerte,
            ),
            const SizedBox(height: 4),
            Text(
              _detalle,
              style: TemaSuperaPaes.pequeno.copyWith(
                color: TemaSuperaPaes.textoSecundario,
              ),
            ),
            if (evaluacion.abandonada) ...[
              const SizedBox(height: 6),
              Text(
                'Abandonada: se guardó lo respondido',
                style: nota.copyWith(color: TemaSuperaPaes.avisoTexto),
              ),
            ],
            if (evaluacion.recalculada) ...[
              const SizedBox(height: 6),
              Text(
                'Recalculado: se anuló una pregunta con error',
                style: nota.copyWith(color: TemaSuperaPaes.primarioOscuro),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// «Página 1 de 3» con «Anterior» y «Siguiente». Con una sola página no se
/// muestra.
class _Paginas extends ConsumerWidget {
  const _Paginas({required this.pagina});

  final PaginaHistorial pagina;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (pagina.paginas <= 1) return const SizedBox.shrink();
    final filtros = ref.read(filtrosHistorialProvider.notifier);
    return Wrap(
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 8,
      children: [
        Text(
          'Página ${pagina.pagina} de ${pagina.paginas}',
          style: TemaSuperaPaes.pequeno.copyWith(
            color: TemaSuperaPaes.textoSecundario,
          ),
        ),
        Wrap(
          spacing: 8,
          children: [
            if (pagina.pagina > 1)
              BotonTexto(
                onPressed: () => filtros.irAPagina(pagina.pagina - 1),
                child: const Text('Anterior'),
              ),
            if (pagina.pagina < pagina.paginas)
              BotonTexto(
                onPressed: () => filtros.irAPagina(pagina.pagina + 1),
                child: const Text('Siguiente'),
              ),
          ],
        ),
      ],
    );
  }
}

/// Sin nada todavía ofrece practicar (CU-30 2.a); con filtros, quitarlos.
class _SinEvaluaciones extends ConsumerWidget {
  const _SinEvaluaciones({required this.sinFiltros});

  final bool sinFiltros;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (sinFiltros) {
      return EstadoVacio(
        titulo: 'Todavía no tienes evaluaciones',
        texto:
            'Cuando termines una práctica o una evaluación, la verás aquí con '
            'su resultado.',
        accion: 'Ir a practicar',
        alTocar: () => context.go(Rutas.practicar),
      );
    }
    return EstadoVacio(
      titulo: 'No hay evaluaciones con estos filtros',
      texto: 'Prueba con otra prueba u otro tipo de evaluación.',
      accion: 'Ver todas',
      alTocar: () => ref.read(filtrosHistorialProvider.notifier).limpiar(),
    );
  }
}
