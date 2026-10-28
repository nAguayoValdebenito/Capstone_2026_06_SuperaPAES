import 'package:flutter/material.dart';
import 'package:flutter_math_fork/flutter_math.dart';

import 'package:supera_paes/nucleo/configuracion.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/formato_pregunta.dart';

/// Texto de una pregunta con sus fórmulas e imágenes (HU-34.2 esc. 2 y 3):
/// el enunciado, cada alternativa, la explicación y el texto de lectura.
/// Las fórmulas se dibujan con LaTeX; las imágenes se agrandan al tocarlas.
class TextoConFormulas extends StatelessWidget {
  const TextoConFormulas(
    this.texto, {
    super.key,
    this.estilo = TemaSuperaPaes.cuerpo,
  });

  final String texto;
  final TextStyle estilo;

  @override
  Widget build(BuildContext context) {
    final bloques = bloquesDePregunta(texto);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (i, bloque) in bloques.indexed) ...[
          if (i > 0) const SizedBox(height: 10),
          switch (bloque) {
            ParrafoPregunta(:final trozos) => Text.rich(
              TextSpan(children: [for (final trozo in trozos) _trozo(trozo)]),
              style: estilo,
            ),
            FormulaEnBloque(:final tex) => _FormulaEnBloque(
              tex: tex,
              estilo: estilo,
            ),
            ImagenPregunta(:final url, :final alternativo) => ImagenAmpliable(
              url: url,
              alternativo: alternativo,
            ),
          },
        ],
      ],
    );
  }

  InlineSpan _trozo(TrozoPregunta trozo) => switch (trozo) {
    TextoPregunta(:final texto, :final negrita, :final cursiva) => TextSpan(
      text: texto,
      style: TextStyle(
        fontWeight: negrita ? FontWeight.w700 : null,
        fontStyle: cursiva ? FontStyle.italic : null,
      ),
    ),
    FormulaEnLinea(:final tex) => WidgetSpan(
      alignment: PlaceholderAlignment.baseline,
      baseline: TextBaseline.alphabetic,
      child: Formula(tex: tex, estilo: estilo),
    ),
  };
}

/// Una fórmula en LaTeX. Si no se puede leer, se muestra tal como se
/// escribió, para no perder la pregunta. El lector de pantalla lee el LaTeX.
class Formula extends StatelessWidget {
  const Formula({
    required this.tex,
    required this.estilo,
    super.key,
    this.enBloque = false,
  });

  final String tex;
  final TextStyle estilo;
  final bool enBloque;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: tex,
      excludeSemantics: true,
      child: Math.tex(
        tex,
        mathStyle: enBloque ? MathStyle.display : MathStyle.text,
        textStyle: estilo.copyWith(fontFamily: TemaSuperaPaes.fuenteFormulas),
        onErrorFallback: (_) =>
            Text(enBloque ? '\$\$$tex\$\$' : '\$$tex\$', style: estilo),
      ),
    );
  }
}

/// Fórmula en su propia línea: centrada y, si no cabe, se desliza de lado
/// sin salirse de la pantalla.
class _FormulaEnBloque extends StatelessWidget {
  const _FormulaEnBloque({required this.tex, required this.estilo});

  final String tex;
  final TextStyle estilo;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Formula(tex: tex, estilo: estilo, enBloque: true),
      ),
    );
  }
}

/// Dirección de una imagen: completa, o relativa a la API.
String direccionDeImagen(String url) => url.startsWith('http')
    ? url
    : '${Configuracion.apiUrl}${url.startsWith('/') ? '' : '/'}$url';

/// Imagen de una pregunta o de un texto de lectura. Se toca para verla en
/// pantalla completa, donde se puede agrandar (HU-34 esc. 3).
class ImagenAmpliable extends StatelessWidget {
  const ImagenAmpliable({
    required this.url,
    required this.alternativo,
    super.key,
  });

  final String url;
  final String alternativo;

  @override
  Widget build(BuildContext context) {
    final radio = BorderRadius.circular(TemaSuperaPaes.radioCampo);
    return Semantics(
      image: true,
      button: true,
      label: alternativo.isEmpty ? 'Imagen' : alternativo,
      hint: 'Toca para agrandarla',
      excludeSemantics: true,
      child: InkWell(
        borderRadius: radio,
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            fullscreenDialog: true,
            builder: (_) => PantallaImagen(url: url, alternativo: alternativo),
          ),
        ),
        child: Stack(
          children: [
            ClipRRect(
              borderRadius: radio,
              child: Container(
                width: double.infinity,
                constraints: const BoxConstraints(minHeight: 80),
                color: TemaSuperaPaes.superficie,
                child: Image.network(
                  direccionDeImagen(url),
                  fit: BoxFit.contain,
                  errorBuilder: (_, _, _) =>
                      _ImagenNoDisponible(alternativo: alternativo),
                ),
              ),
            ),
            const Positioned(right: 8, bottom: 8, child: _MarcaAgrandar()),
          ],
        ),
      ),
    );
  }
}

class _MarcaAgrandar extends StatelessWidget {
  const _MarcaAgrandar();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: TemaSuperaPaes.superficie,
        borderRadius: BorderRadius.circular(TemaSuperaPaes.radioBotonChico),
        border: Border.all(color: TemaSuperaPaes.borde),
      ),
      child: const Icon(
        Icons.zoom_in,
        size: 20,
        color: TemaSuperaPaes.textoSecundario,
      ),
    );
  }
}

/// Si la imagen no carga, su texto alternativo, para no perder la pregunta.
class _ImagenNoDisponible extends StatelessWidget {
  const _ImagenNoDisponible({required this.alternativo});

  final String alternativo;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          const Icon(
            Icons.image_not_supported_outlined,
            color: TemaSuperaPaes.textoSecundario,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              alternativo.isEmpty
                  ? 'No se pudo cargar la imagen.'
                  : 'No se pudo cargar la imagen: $alternativo',
              style: TemaSuperaPaes.pequeno.copyWith(
                color: TemaSuperaPaes.textoSecundario,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// La imagen en pantalla completa: se agranda con dos dedos (hasta 5 veces)
/// y se cierra para volver a la pregunta.
class PantallaImagen extends StatelessWidget {
  const PantallaImagen({
    required this.url,
    required this.alternativo,
    super.key,
  });

  final String url;
  final String alternativo;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: TemaSuperaPaes.texto,
      body: SafeArea(
        child: Stack(
          children: [
            Positioned.fill(
              child: InteractiveViewer(
                maxScale: 5,
                child: Center(
                  child: Semantics(
                    image: true,
                    label: alternativo,
                    child: Image.network(
                      direccionDeImagen(url),
                      errorBuilder: (_, _, _) =>
                          _ImagenNoDisponible(alternativo: alternativo),
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              top: 8,
              left: 8,
              child: IconButton.filled(
                tooltip: 'Volver a la pregunta',
                style: IconButton.styleFrom(
                  backgroundColor: TemaSuperaPaes.superficie,
                  foregroundColor: TemaSuperaPaes.texto,
                ),
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
