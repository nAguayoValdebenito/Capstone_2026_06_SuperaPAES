import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supera_paes/dominio/entidades/historial.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/animados.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/error_con_reintento.dart';
import 'package:supera_paes/presentacion/comunes/estados.dart';
import 'package:supera_paes/presentacion/comunes/fechas.dart';
import 'package:supera_paes/presentacion/comunes/movimiento.dart';
import 'package:supera_paes/presentacion/comunes/sello_prueba.dart';
import 'package:supera_paes/presentacion/inicio/evaluacion_sin_terminar.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
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
    // Sin nada todavía, solo el vacío: los filtros no tienen qué filtrar.
    final sinNada =
        filtros.sinFiltros &&
        historial.value?.evaluaciones.isEmpty == true &&
        !historial.isLoading;
    return PantallaFormulario(
      separacion: 12,
      alActualizar: () async {
        ref.invalidate(historialProvider);
        await ref.read(historialProvider.future);
      },
      hijos: [
        const EnlaceVolver(texto: 'Progreso', destino: Rutas.progreso),
        const Encabezado(titulo: 'Historial'),
        if (!sinNada) ...[
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
        ],
        const EvaluacionSinTerminar(),
        ...switch (historial) {
          AsyncData(value: final PaginaHistorial pagina)
              when pagina.evaluaciones.isEmpty =>
            [_SinEvaluaciones(sinFiltros: filtros.sinFiltros)],
          AsyncData(value: final PaginaHistorial pagina) => [
            _ListaEvaluaciones(evaluaciones: pagina.evaluaciones),
            _Paginas(pagina: pagina),
          ],
          AsyncError(:final error) => [
            ErrorConReintento(
              error: error,
              mensaje: 'No pudimos cargar tu historial.',
              alReintentar: () => ref.invalidate(historialProvider),
            ),
          ],
          _ => const [
            GrupoEsqueleto(
              child: Column(
                children: [
                  EsqueletoTarjeta(),
                  SizedBox(height: TemaSuperaPaes.espacio16),
                  EsqueletoTarjeta(),
                ],
              ),
            ),
          ],
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

/// Las evaluaciones de la página en una sola lista con borde, como en la
/// maqueta A34: cada fila con su sello, el tipo y la prueba, el resultado y
/// la fecha.
class _ListaEvaluaciones extends StatelessWidget {
  const _ListaEvaluaciones({required this.evaluaciones});

  final List<EvaluacionDelHistorial> evaluaciones;

  @override
  Widget build(BuildContext context) => ListaDeFilas(
    filas: [
      for (final (i, evaluacion) in evaluaciones.indexed)
        AparecerEscalonado(
          indice: i,
          child: _FilaEvaluacion(evaluacion: evaluacion),
        ),
    ],
  );
}

class _FilaEvaluacion extends ConsumerWidget {
  const _FilaEvaluacion({required this.evaluacion});

  final EvaluacionDelHistorial evaluacion;

  /// «Mini-ensayo de M1»; sin código de prueba, con su nombre.
  String get _titulo => switch (evaluacion.codigoPrueba) {
    final codigo? =>
      '${evaluacion.tipoNombre} de ${Prueba.deCodigo(codigo).corto}',
    null => '${evaluacion.tipoNombre} · ${evaluacion.prueba}',
  };

  /// «68 %», o «612 pts» en el ensayo completo.
  String? get _resultado {
    if (evaluacion.puntaje case final puntaje?) return '$puntaje pts';
    if (evaluacion.porcentaje case final porcentaje?) {
      return '${porcentaje.round()} %';
    }
    return null;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final secundario = TemaSuperaPaes.pequeno.copyWith(
      color: TemaSuperaPaes.textoSecundario,
    );
    final resultado = _resultado;
    return InkWell(
      onTap: () => abrirResultado(
        context,
        ref,
        evaluacion.id,
        desdeHistorial: true,
        codigoPrueba: evaluacion.codigoPrueba,
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: TemaSuperaPaes.espacio16,
          vertical: TemaSuperaPaes.espacio12,
        ),
        child: Row(
          children: [
            HeroMode(
              enabled: !reducirMovimiento(context),
              child: Hero(
                tag: 'sello-evaluacion-${evaluacion.id}',
                child: SelloPrueba(
                  Prueba.deCodigo(evaluacion.codigoPrueba ?? ''),
                  tamano: 36,
                ),
              ),
            ),
            const SizedBox(width: TemaSuperaPaes.espacio12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: TemaSuperaPaes.espacio8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(_titulo, style: TemaSuperaPaes.cuerpoFuerte),
                      if (resultado != null)
                        Text(
                          resultado,
                          style: TemaSuperaPaes.tabular(
                            TemaSuperaPaes.pequenoFuerte.copyWith(
                              color: TemaSuperaPaes.primarioOscuro,
                            ),
                          ),
                        ),
                    ],
                  ),
                  Text(
                    [
                      fechaEnPalabras(evaluacion.cerradaEn),
                      ?evaluacion.alcance,
                    ].join(' · '),
                    style: secundario,
                  ),
                  if (evaluacion.abandonada)
                    Text(
                      'Abandonada: se guardó lo respondido',
                      style: secundario,
                    ),
                  if (evaluacion.recalculada)
                    Text(
                      'Recalculado: se anuló una pregunta con error',
                      style: secundario,
                    ),
                ],
              ),
            ),
            const SizedBox(width: TemaSuperaPaes.espacio8),
            const Icon(
              Icons.chevron_right,
              size: 18,
              color: TemaSuperaPaes.textoSecundario,
            ),
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
        titulo: 'Aún no tienes nada en tu historial',
        texto:
            'Cuando termines una práctica o una evaluación, la verás aquí con '
            'su resultado.',
        accion: 'Empezar una práctica',
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
