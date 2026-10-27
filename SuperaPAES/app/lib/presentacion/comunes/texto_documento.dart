import 'package:flutter/material.dart';

import 'package:supera_paes/nucleo/tema.dart';

/// Muestra el Markdown sencillo de los documentos legales: títulos (`#` y
/// `##`), listas (`- `) y párrafos separados por una línea vacía. No
/// interpreta nada más, porque los documentos no usan nada más.
class TextoDocumento extends StatelessWidget {
  const TextoDocumento(this.markdown, {super.key});

  final String markdown;

  @override
  Widget build(BuildContext context) {
    final cuerpo = TemaSuperaPaes.pequeno.copyWith(
      color: TemaSuperaPaes.textoSecundario,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final bloque in bloquesDeMarkdown(markdown))
          Padding(
            padding: EdgeInsets.only(
              top: bloque.tipo == TipoBloque.titulo ? 16 : 0,
              bottom: switch (bloque.tipo) {
                TipoBloque.elementoLista => 4,
                TipoBloque.subtitulo => 4,
                _ => 12,
              },
            ),
            child: switch (bloque.tipo) {
              TipoBloque.titulo => Text(bloque.texto, style: TemaSuperaPaes.h2),
              TipoBloque.subtitulo => Text(
                bloque.texto,
                style: TemaSuperaPaes.cuerpoFuerte,
              ),
              TipoBloque.elementoLista => Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('•  ', style: cuerpo),
                  Expanded(child: Text(bloque.texto, style: cuerpo)),
                ],
              ),
              TipoBloque.parrafo => Text(bloque.texto, style: cuerpo),
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
