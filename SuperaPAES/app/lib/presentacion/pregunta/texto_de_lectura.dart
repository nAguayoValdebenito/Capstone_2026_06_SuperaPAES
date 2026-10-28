import 'package:flutter/material.dart';

import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/formato_pregunta_vista.dart';

/// Texto de lectura de una pregunta de Competencia Lectora (A20; HU-34
/// esc. 1): se recorre dentro de su recuadro sin perder la pregunta, y
/// «Ampliar texto» lo abre entero en otra pantalla.
class TarjetaTextoDeLectura extends StatefulWidget {
  const TarjetaTextoDeLectura({required this.texto, super.key});

  final TextoDeLectura texto;

  @override
  State<TarjetaTextoDeLectura> createState() => _TarjetaTextoDeLecturaState();
}

class _TarjetaTextoDeLecturaState extends State<TarjetaTextoDeLectura> {
  /// La barra siempre visible necesita el mismo controlador que el texto.
  final _desplazamiento = ScrollController();

  @override
  void dispose() {
    _desplazamiento.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final texto = widget.texto;
    return Tarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  (texto.titulo ?? 'Texto').toUpperCase(),
                  style: TemaSuperaPaes.mini.copyWith(
                    color: TemaSuperaPaes.textoSecundario,
                  ),
                ),
              ),
              TextButton(
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  textStyle: TemaSuperaPaes.pequenoFuerte,
                ),
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    fullscreenDialog: true,
                    builder: (_) => PantallaTextoCompleto(texto: texto),
                  ),
                ),
                child: const Text('Ampliar texto'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ConstrainedBox(
            constraints: const BoxConstraints(
              maxHeight: TemaSuperaPaes.altoTextoLectura,
            ),
            child: Scrollbar(
              controller: _desplazamiento,
              thumbVisibility: true,
              child: SingleChildScrollView(
                controller: _desplazamiento,
                padding: const EdgeInsets.only(right: 8),
                child: _ContenidoDelTexto(texto: texto),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// El texto de lectura entero, para leerlo con calma; se vuelve a la
/// pregunta, que sigue igual.
class PantallaTextoCompleto extends StatelessWidget {
  const PantallaTextoCompleto({required this.texto, super.key});

  final TextoDeLectura texto;

  @override
  Widget build(BuildContext context) {
    return PantallaFormulario(
      hijos: [
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 4),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            onPressed: () => Navigator.of(context).pop(),
            icon: const Icon(Icons.close, size: 20),
            label: const Text('Volver a la pregunta'),
          ),
        ),
        if (texto.titulo case final titulo?) Encabezado(titulo: titulo),
        _ContenidoDelTexto(texto: texto),
      ],
    );
  }
}

/// La imagen del texto (un gráfico o una tabla, si tiene) y su contenido,
/// con fórmulas e imágenes (HU-34.2).
class _ContenidoDelTexto extends StatelessWidget {
  const _ContenidoDelTexto({required this.texto});

  final TextoDeLectura texto;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (texto.imagen case final imagen?) ...[
          ImagenAmpliable(url: imagen, alternativo: texto.titulo ?? ''),
          const SizedBox(height: 10),
        ],
        TextoConFormulas(texto.contenido ?? ''),
      ],
    );
  }
}
