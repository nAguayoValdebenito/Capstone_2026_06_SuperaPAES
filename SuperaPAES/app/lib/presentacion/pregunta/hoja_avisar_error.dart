import 'package:flutter/material.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/hoja_confirmacion.dart';

/// A23. La maqueta define las etiquetas; aun falta autorizar la conexion de
/// reportes. Nunca se muestra una confirmacion de envio sin persistencia real.
Future<void> avisarError(BuildContext context) =>
    mostrarHoja<void>(context, const HojaAvisarError());

class HojaAvisarError extends StatefulWidget {
  const HojaAvisarError({super.key});
  @override
  State<HojaAvisarError> createState() => _HojaAvisarErrorState();
}

class _HojaAvisarErrorState extends State<HojaAvisarError> {
  int? _motivo;
  @override
  Widget build(BuildContext context) => SafeArea(
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
        children: [
          const Text('Avisar un error', style: TemaSuperaPaes.h2),
          const SizedBox(height: 12),
          const Text(
            'Si algo de esta pregunta está mal, cuéntanos. '
            'Un docente la revisa.',
          ),
          const SizedBox(height: 16),
          for (final (indice, texto) in const [
            'El enunciado tiene un error',
            'Una alternativa está mal escrita',
            'La respuesta correcta no es esa',
            'La explicación no se entiende',
          ].indexed) ...[
            OpcionRadio(
              texto: texto,
              seleccionada: _motivo == indice,
              conMovimiento: true,
              onTap: () => setState(() => _motivo = indice),
            ),
            const SizedBox(height: 8),
          ],
          const Aviso(
            tono: TonoAviso.info,
            texto: 'El envío de avisos aún no está disponible.',
          ),
          const SizedBox(height: 16),
          const FilledButton(onPressed: null, child: Text('Enviar aviso')),
          BotonTexto(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Volver'),
          ),
        ],
      ),
    ),
  );
}
