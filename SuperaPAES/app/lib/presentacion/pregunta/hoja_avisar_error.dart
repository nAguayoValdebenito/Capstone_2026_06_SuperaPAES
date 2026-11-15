import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supera_paes/dominio/entidades/aviso_error.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/hoja_confirmacion.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';
import 'package:supera_paes/presentacion/pregunta/estado_avisos.dart';

/// Largo del comentario que acepta el servidor (decisión D5 del plan HU-37).
const int minimoComentario = 5;
const int maximoComentario = 500;

/// A23 (HU-37, CU-13, RF-A16): el estudiante elige un motivo de la lista y
/// escribe un comentario sobre la pregunta del ítem [itemId] de la
/// evaluación [evaluacionId]. La confirmación solo se muestra cuando el
/// servidor guardó el aviso.
Future<void> avisarError(
  BuildContext context, {
  required int evaluacionId,
  required int itemId,
}) => mostrarHoja<void>(
  context,
  HojaAvisarError(evaluacionId: evaluacionId, itemId: itemId),
);

/// «Avisar un error» de A17 y A19: el ítem [itemId] de la práctica en
/// curso. Sin práctica en curso no hay ítem que avisar.
Future<void> avisarErrorDePractica(
  BuildContext context,
  WidgetRef ref,
  int itemId,
) async {
  final practica = ref.read(practicaProvider).enCurso;
  if (practica == null) return;
  await avisarError(context, evaluacionId: practica.id, itemId: itemId);
}

class HojaAvisarError extends ConsumerStatefulWidget {
  const HojaAvisarError({
    required this.evaluacionId,
    required this.itemId,
    super.key,
  });

  final int evaluacionId;
  final int itemId;

  @override
  ConsumerState<HojaAvisarError> createState() => _HojaAvisarErrorState();
}

class _HojaAvisarErrorState extends ConsumerState<HojaAvisarError> {
  final _comentario = TextEditingController();
  String? _motivo;
  bool _enviando = false;
  String? _error;
  AvisoEnviado? _enviado;

  @override
  void dispose() {
    _comentario.dispose();
    super.dispose();
  }

  bool get _listo =>
      _motivo != null &&
      _comentario.text.trim().length >= minimoComentario &&
      !_enviando;

  Future<void> _enviar() async {
    final motivo = _motivo;
    if (motivo == null || !_listo) return;
    setState(() {
      _enviando = true;
      _error = null;
    });
    try {
      final enviado = await ref
          .read(repositorioAvisosProvider)
          .enviar(
            DatosAviso(
              evaluacionId: widget.evaluacionId,
              itemId: widget.itemId,
              motivo: motivo,
              comentario: _comentario.text.trim(),
            ),
          );
      if (mounted) setState(() => _enviado = enviado);
    } on ErrorApi catch (error) {
      if (mounted) setState(() => _error = error.mensaje);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    child: Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(
          TemaSuperaPaes.margenPantalla,
          0,
          TemaSuperaPaes.margenPantalla,
          TemaSuperaPaes.espacio24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: switch (_enviado) {
            final enviado? => _confirmacion(enviado),
            null => _formulario(),
          },
        ),
      ),
    ),
  );

  List<Widget> _confirmacion(AvisoEnviado enviado) => [
    const Text('Recibimos tu aviso', style: TemaSuperaPaes.h2),
    const SizedBox(height: 12),
    Aviso(
      tono: TonoAviso.exito,
      texto:
          'Gracias. Un administrador revisará la pregunta '
          '(motivo: ${enviado.motivo}).',
    ),
    const SizedBox(height: 16),
    FilledButton(
      onPressed: () => Navigator.of(context).pop(),
      child: const Text('Volver a la pregunta'),
    ),
  ];

  List<Widget> _formulario() => [
    const Text('Avisar un error', style: TemaSuperaPaes.h2),
    const SizedBox(height: 12),
    const Text(
      'Si algo de esta pregunta está mal, cuéntanos. '
      'Un administrador la revisa.',
    ),
    const SizedBox(height: 16),
    ...ref
        .watch(motivosAvisoProvider)
        .when(
          data: _motivos,
          loading: () => const [
            Center(child: CircularProgressIndicator()),
            SizedBox(height: 16),
          ],
          error: (error, _) => [
            Aviso(
              tono: TonoAviso.error,
              texto: error is ErrorApi
                  ? error.mensaje
                  : 'No pudimos cargar los motivos.',
            ),
            BotonTexto(
              onPressed: () => ref.invalidate(motivosAvisoProvider),
              child: const Text('Reintentar'),
            ),
          ],
        ),
    BotonTexto(
      onPressed: () => Navigator.of(context).pop(),
      child: const Text('Volver'),
    ),
  ];

  List<Widget> _motivos(List<MotivoAviso> motivos) => [
    for (final motivo in motivos) ...[
      OpcionRadio(
        texto: motivo.nombre,
        seleccionada: _motivo == motivo.codigo,
        conMovimiento: true,
        onTap: () {
          if (!_enviando) setState(() => _motivo = motivo.codigo);
        },
      ),
      const SizedBox(height: 8),
    ],
    const SizedBox(height: 8),
    CampoConEtiqueta(
      etiqueta: 'Comentario',
      ayuda:
          'Cuéntanos qué está mal. Entre $minimoComentario y '
          '$maximoComentario caracteres.',
      child: TextField(
        key: const Key('comentario-aviso'),
        controller: _comentario,
        enabled: !_enviando,
        minLines: 3,
        maxLines: 6,
        maxLength: maximoComentario,
        textCapitalization: TextCapitalization.sentences,
        style: TemaSuperaPaes.cuerpo,
        onChanged: (_) => setState(() {}),
      ),
    ),
    const SizedBox(height: 8),
    if (_error case final error?) ...[
      Aviso(tono: TonoAviso.error, texto: error),
      const SizedBox(height: 12),
    ],
    FilledButton(
      onPressed: _listo ? _enviar : null,
      child: _enviando ? const CargandoEnBoton() : const Text('Enviar aviso'),
    ),
  ];
}
