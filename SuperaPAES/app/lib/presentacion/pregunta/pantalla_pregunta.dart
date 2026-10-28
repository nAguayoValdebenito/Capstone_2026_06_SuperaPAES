import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/formato_pregunta_vista.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';
import 'package:supera_paes/presentacion/pregunta/hoja_confirmar_respuesta.dart';
import 'package:supera_paes/presentacion/pregunta/partes_pregunta.dart';
import 'package:supera_paes/presentacion/pregunta/texto_de_lectura.dart';

/// Pregunta de la práctica (A17, y A20 con texto de lectura; HU-34.1,
/// CU-06 paso 4, CU-07 paso 1): lo que se practica, el avance, las preguntas
/// que quedan hoy, el texto, el enunciado y las alternativas. «Responder»
/// pide confirmar (A18) y abre la corrección (A19); «Terminar» cierra la
/// práctica. Las fórmulas y las imágenes se ven con [TextoConFormulas].
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

  /// Confirma la alternativa (A18; en la práctica la respuesta es
  /// definitiva, HU-32 esc. 4) y la envía para que la corrija el servidor.
  Future<void> _responder() async {
    final elegida = _elegida;
    if (elegida == null) return;
    final letra = [
      for (final a in widget.pregunta.alternativas)
        if (a.id == elegida) a.letra,
    ].first;
    if (!await confirmarRespuesta(context, letra) || !mounted) return;
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
        const CabeceraPractica(),
        AvancePractica(pregunta: pregunta),
        if (pregunta.texto case final texto?)
          TarjetaTextoDeLectura(texto: texto),
        Semantics(
          header: true,
          child: TextoConFormulas(
            pregunta.enunciado,
            estilo: TemaSuperaPaes.cuerpoFuerte,
          ),
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
