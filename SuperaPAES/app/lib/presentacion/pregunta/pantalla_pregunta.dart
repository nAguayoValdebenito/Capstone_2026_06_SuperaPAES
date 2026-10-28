import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/inicio/estado_inicio.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';
import 'package:supera_paes/presentacion/pregunta/texto_de_lectura.dart';

/// Pregunta de la práctica (A17, y A20 con texto de lectura; HU-34.1,
/// CU-06 paso 4, CU-07 paso 1): lo que se practica, el avance, las preguntas
/// que quedan hoy, el texto, el enunciado y las alternativas. «Responder»
/// envía la respuesta y abre su corrección; «Terminar» cierra la práctica.
/// Las fórmulas y las imágenes llegan con HU-34.2.
class PantallaPregunta extends ConsumerWidget {
  const PantallaPregunta({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (ref.watch(practicaProvider).enCurso == null) {
      return PantallaFormulario(
        hijos: [
          const SizedBox(height: 32),
          const Encabezado(
            titulo: 'No tienes una práctica en curso',
            bajada: 'Elige qué practicar para empezar una.',
          ),
          FilledButton(
            onPressed: () => context.go(Rutas.practicar),
            child: const Text('Elegir práctica'),
          ),
        ],
      );
    }
    return ref
        .watch(preguntaActualProvider)
        .when(
          data: (pregunta) => pregunta == null
              ? const SizedBox.shrink()
              // La clave reinicia la alternativa elegida con cada pregunta.
              : _VistaPregunta(
                  key: ValueKey(pregunta.itemId),
                  pregunta: pregunta,
                ),
          loading: () =>
              const Scaffold(body: Center(child: CircularProgressIndicator())),
          error: (error, _) => _SinPregunta(error: error),
        );
  }
}

class _VistaPregunta extends ConsumerStatefulWidget {
  const _VistaPregunta({required this.pregunta, super.key});

  final PreguntaDePractica pregunta;

  @override
  ConsumerState<_VistaPregunta> createState() => _VistaPreguntaState();
}

class _VistaPreguntaState extends ConsumerState<_VistaPregunta> {
  int? _elegida;
  bool _enviando = false;
  String? _error;

  Future<void> _responder() async {
    final elegida = _elegida;
    if (elegida == null) return;
    setState(() {
      _enviando = true;
      _error = null;
    });
    try {
      await ref
          .read(practicaProvider.notifier)
          .responder(widget.pregunta, elegida);
      if (mounted) context.go(Rutas.correccion);
    } on ErrorApi catch (error) {
      if (!mounted) return;
      if (error.codigo == 'CUPO_AGOTADO') {
        context.go(Rutas.cupoAgotado);
      } else {
        setState(() => _error = error.mensaje);
      }
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pregunta = widget.pregunta;
    return PantallaFormulario(
      separacion: 14,
      hijos: [
        const _Cabecera(),
        _Avance(pregunta: pregunta),
        if (pregunta.texto case final texto?)
          TarjetaTextoDeLectura(texto: texto),
        Semantics(
          header: true,
          child: Text(pregunta.enunciado, style: TemaSuperaPaes.cuerpoFuerte),
        ),
        for (final alternativa in pregunta.alternativas)
          OpcionAlternativa(
            letra: alternativa.letra,
            texto: alternativa.texto,
            seleccionada: alternativa.id == _elegida,
            onTap: _enviando
                ? null
                : () => setState(() => _elegida = alternativa.id),
          ),
      ],
      pie: PieConError(
        error: _error,
        boton: FilledButton(
          onPressed: _elegida == null || _enviando ? null : _responder,
          child: _enviando ? const CargandoEnBoton() : const Text('Responder'),
        ),
      ),
    );
  }
}

/// «✕ Terminar» y las preguntas que quedan hoy (cupo y extra).
class _Cabecera extends ConsumerWidget {
  const _Cabecera();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cupo = ref.watch(cupoDeHoyProvider).value;
    // Wrap: con letra grande, las preguntas que quedan bajan a otra línea.
    return Wrap(
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.center,
      runSpacing: 8,
      children: [
        TextButton.icon(
          style: TextButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 4),
            minimumSize: Size.zero,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          onPressed: () => terminarPractica(context, ref),
          icon: const Icon(Icons.close, size: 20),
          label: const Text('Terminar'),
        ),
        if (cupo != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: TemaSuperaPaes.primarioSuave,
              borderRadius: BorderRadius.circular(TemaSuperaPaes.radioTarjeta),
            ),
            child: Text.rich(
              TextSpan(
                children: [
                  const TextSpan(text: 'Hoy te quedan '),
                  TextSpan(
                    text: '${cupo.restantes + cupo.saldoExtra}',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ],
              ),
              style: TemaSuperaPaes.pequeno.copyWith(
                color: TemaSuperaPaes.primarioOscuro,
              ),
            ),
          ),
      ],
    );
  }
}

/// «M2 · Logaritmos · Mezcla», «Pregunta 4 de 10» y la barra del avance.
class _Avance extends ConsumerWidget {
  const _Avance({required this.pregunta});

  final PreguntaDePractica pregunta;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final datos = ref.watch(practicaProvider).datos;
    final nombres = ref.watch(opcionesPerfilProvider).value;
    final dificultades =
        ref.watch(opcionesPracticaProvider).value?.dificultades ?? const [];
    final secundario = TemaSuperaPaes.pequeno.copyWith(
      color: TemaSuperaPaes.textoSecundario,
    );
    final descripcion = datos == null
        ? ''
        : [
            ?nombres?.prueba(datos.pruebaId)?.nombreCorto,
            ?datos.alcance.nombre,
            [
                  for (final d in dificultades)
                    if (d.id == datos.dificultadId) d.nombre,
                ].firstOrNull ??
                'Mezcla',
          ].join(' · ');
    final hechas = (pregunta.orden - 1) / pregunta.total;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          alignment: WrapAlignment.spaceBetween,
          spacing: 8,
          children: [
            Text(descripcion, style: secundario),
            Text(
              'Pregunta ${pregunta.orden} de ${pregunta.total}',
              style: secundario,
            ),
          ],
        ),
        const SizedBox(height: 8),
        ExcludeSemantics(
          child: Container(
            height: TemaSuperaPaes.altoAvance,
            alignment: Alignment.centerLeft,
            decoration: BoxDecoration(
              color: TemaSuperaPaes.neutroSuave,
              borderRadius: BorderRadius.circular(TemaSuperaPaes.altoAvance),
            ),
            child: FractionallySizedBox(
              widthFactor: hechas.clamp(0, 1),
              heightFactor: 1,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: TemaSuperaPaes.primario,
                  borderRadius: BorderRadius.circular(
                    TemaSuperaPaes.altoAvance,
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Lo que se muestra si la siguiente pregunta no llega: sin cupo, la
/// práctica ya respondida entera u otro problema. Siempre se puede terminar.
class _SinPregunta extends ConsumerWidget {
  const _SinPregunta({required this.error});

  final Object error;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final codigo = error is ErrorApi ? (error as ErrorApi).codigo : null;
    final mensaje = switch (codigo) {
      'PRACTICA_COMPLETA' => 'Ya respondiste todas las preguntas.',
      'SIN_PREGUNTAS_SUFICIENTES' =>
        'Ya no quedan preguntas para lo que elegiste.',
      _ when error is ErrorApi => (error as ErrorApi).mensaje,
      _ => 'No se pudo cargar la pregunta.',
    };
    return PantallaFormulario(
      hijos: [
        const SizedBox(height: 32),
        Aviso(tono: TonoAviso.aviso, texto: mensaje),
        if (codigo == 'CUPO_AGOTADO')
          FilledButton(
            onPressed: () => context.go(Rutas.cupoAgotado),
            child: const Text('Ver cómo seguir'),
          )
        else if (codigo == null || !codigo.startsWith('PRACTICA'))
          OutlinedButton(
            onPressed: () => ref.invalidate(preguntaActualProvider),
            child: const Text('Reintentar'),
          ),
        FilledButton(
          onPressed: () => terminarPractica(context, ref, preguntar: false),
          child: Text(
            codigo == 'PRACTICA_COMPLETA' ? 'Ver resumen' : 'Terminar práctica',
          ),
        ),
      ],
    );
  }
}

/// Cierra la práctica y abre su resumen (A21). Con `preguntar`, antes avisa
/// que las preguntas sin responder quedan como omitidas.
Future<void> terminarPractica(
  BuildContext context,
  WidgetRef ref, {
  bool preguntar = true,
}) async {
  if (preguntar) {
    final terminar = await showDialog<bool>(
      context: context,
      builder: (contexto) => AlertDialog(
        title: const Text('¿Terminar la práctica?'),
        content: const Text(
          'Las preguntas que no respondiste quedan sin responder en tu '
          'resumen.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(contexto).pop(false),
            child: const Text('Seguir practicando'),
          ),
          TextButton(
            onPressed: () => Navigator.of(contexto).pop(true),
            child: const Text('Terminar'),
          ),
        ],
      ),
    );
    if (terminar != true) return;
  }
  try {
    await ref.read(practicaProvider.notifier).cerrar();
    if (context.mounted) context.go(Rutas.resumenPractica);
  } on ErrorApi catch (error) {
    if (context.mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.mensaje)));
    }
  }
}
