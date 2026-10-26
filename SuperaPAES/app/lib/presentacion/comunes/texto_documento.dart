import 'package:flutter/material.dart';

/// Muestra el Markdown sencillo de los documentos legales: títulos (`#` y
/// `##`), listas (`- `) y párrafos separados por una línea vacía. No
/// interpreta nada más, porque los documentos no usan nada más.
class TextoDocumento extends StatelessWidget {
  const TextoDocumento(this.markdown, {super.key});

  final String markdown;

  @override
  Widget build(BuildContext context) {
    final textos = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final bloque in bloquesDeMarkdown(markdown))
          Padding(
            padding: EdgeInsets.only(
              top: bloque.tipo == TipoBloque.titulo ? 16 : 0,
              bottom: bloque.tipo == TipoBloque.elementoLista ? 4 : 12,
            ),
            child: switch (bloque.tipo) {
              TipoBloque.titulo => Text(
                bloque.texto,
                style: textos.headlineSmall,
              ),
              TipoBloque.subtitulo => Text(
                bloque.texto,
                style: textos.titleMedium,
              ),
              TipoBloque.elementoLista => Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('•  ', style: textos.bodyMedium),
                  Expanded(child: Text(bloque.texto, style: textos.bodyMedium)),
                ],
              ),
              TipoBloque.parrafo => Text(
                bloque.texto,
                style: textos.bodyMedium,
              ),
            },
          ),
      ],
    );
  }
}

enum TipoBloque { titulo, subtitulo, elementoLista, parrafo }

class BloqueDocumento {
  const BloqueDocumento(this.tipo, this.texto);

  final TipoBloque tipo;
  final String texto;
}

/// Divide el Markdown en bloques. Las líneas seguidas de un párrafo se unen
/// con un espacio, como en Markdown.
List<BloqueDocumento> bloquesDeMarkdown(String markdown) {
  final bloques = <BloqueDocumento>[];
  final parrafo = <String>[];

  void cerrarParrafo() {
    if (parrafo.isEmpty) return;
    bloques.add(BloqueDocumento(TipoBloque.parrafo, parrafo.join(' ')));
    parrafo.clear();
  }

  for (final linea in markdown.split('\n').map((l) => l.trim())) {
    if (linea.isEmpty) {
      cerrarParrafo();
    } else if (linea.startsWith('## ')) {
      cerrarParrafo();
      bloques.add(BloqueDocumento(TipoBloque.subtitulo, linea.substring(3)));
    } else if (linea.startsWith('# ')) {
      cerrarParrafo();
      bloques.add(BloqueDocumento(TipoBloque.titulo, linea.substring(2)));
    } else if (linea.startsWith('- ')) {
      cerrarParrafo();
      bloques.add(
        BloqueDocumento(TipoBloque.elementoLista, linea.substring(2)),
      );
    } else {
      parrafo.add(linea);
    }
  }
  cerrarParrafo();
  return bloques;
}
