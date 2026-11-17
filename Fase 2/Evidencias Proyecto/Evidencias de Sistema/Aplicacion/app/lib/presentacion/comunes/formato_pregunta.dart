// Formato de las preguntas (HU-34.2): el enunciado, las alternativas, la
// explicación y el texto de lectura vienen en Markdown, con las fórmulas en
// LaTeX entre signos `$` y las imágenes como `![texto alternativo](url)`
// (comentarios de contenido.pregunta en la base y DAS, CU-16 paso 3). Aquí se
// separa ese texto en bloques y trozos; formato_pregunta_vista.dart los
// dibuja.

/// Un bloque de la pregunta: un párrafo, una fórmula sola o una imagen.
sealed class BloquePregunta {
  const BloquePregunta();
}

/// Párrafo con texto y fórmulas en línea. Los saltos de línea se respetan
/// (por ejemplo, las afirmaciones I, II y III de una pregunta).
final class ParrafoPregunta extends BloquePregunta {
  const ParrafoPregunta(this.trozos);

  final List<TrozoPregunta> trozos;
}

/// Fórmula en su propia línea (`$$…$$`).
final class FormulaEnBloque extends BloquePregunta {
  const FormulaEnBloque(this.tex);

  final String tex;
}

/// Imagen (`![texto alternativo](url)`).
final class ImagenPregunta extends BloquePregunta {
  const ImagenPregunta({required this.url, required this.alternativo});

  final String url;

  /// Lo que describe la imagen; lo lee el lector de pantalla (RNF-12).
  final String alternativo;
}

/// Un trozo de un párrafo: texto (en negrita o cursiva) o una fórmula.
sealed class TrozoPregunta {
  const TrozoPregunta();
}

final class TextoPregunta extends TrozoPregunta {
  const TextoPregunta(this.texto, {this.negrita = false, this.cursiva = false});

  final String texto;
  final bool negrita;
  final bool cursiva;
}

final class FormulaEnLinea extends TrozoPregunta {
  const FormulaEnLinea(this.tex);

  final String tex;
}

final RegExp _formulaEnBloque = RegExp(r'\$\$([\s\S]+?)\$\$');
final RegExp _imagen = RegExp(r'!\[([^\]]*)\]\(([^)\s]+)\)');

/// Separa el texto en bloques: primero las fórmulas `$$…$$`, que pueden
/// ocupar varias líneas; después los párrafos (separados por una línea vacía)
/// y, dentro de ellos, las imágenes.
List<BloquePregunta> bloquesDePregunta(String texto) {
  final bloques = <BloquePregunta>[];
  var desde = 0;
  for (final formula in _formulaEnBloque.allMatches(texto)) {
    bloques
      ..addAll(_bloquesDeTexto(texto.substring(desde, formula.start)))
      ..add(FormulaEnBloque(formula.group(1)!.trim()));
    desde = formula.end;
  }
  bloques.addAll(_bloquesDeTexto(texto.substring(desde)));
  return bloques;
}

List<BloquePregunta> _bloquesDeTexto(String texto) => [
  for (final parrafo in texto.split(RegExp(r'\n\s*\n')))
    ..._bloquesDeParrafo(parrafo.trim()),
];

List<BloquePregunta> _bloquesDeParrafo(String parrafo) {
  final bloques = <BloquePregunta>[];
  var desde = 0;
  void agregarTexto(String parte) {
    final limpio = parte.trim();
    if (limpio.isNotEmpty) bloques.add(ParrafoPregunta(trozosDeTexto(limpio)));
  }

  for (final imagen in _imagen.allMatches(parrafo)) {
    agregarTexto(parrafo.substring(desde, imagen.start));
    bloques.add(
      ImagenPregunta(url: imagen.group(2)!, alternativo: imagen.group(1)!),
    );
    desde = imagen.end;
  }
  agregarTexto(parrafo.substring(desde));
  return bloques;
}

/// Separa un párrafo en texto y fórmulas `$…$`, con `**negrita**` y
/// `*cursiva*`. Como en Pandoc, un `$` abre una fórmula solo si lo sigue algo
/// que no es un espacio, y la cierra un `$` que tiene algo antes y no lo
/// sigue un dígito: así «$5.000 y $3.000» queda como texto. `\$` es un signo
/// peso.
List<TrozoPregunta> trozosDeTexto(String texto) {
  final trozos = <TrozoPregunta>[];
  final actual = StringBuffer();
  var negrita = false;
  var cursiva = false;

  void cerrarTexto() {
    if (actual.isEmpty) return;
    trozos.add(
      TextoPregunta(actual.toString(), negrita: negrita, cursiva: cursiva),
    );
    actual.clear();
  }

  var i = 0;
  while (i < texto.length) {
    final letra = texto[i];
    final siguiente = i + 1 < texto.length ? texto[i + 1] : '';
    if (letra == r'\' && siguiente == r'$') {
      actual.write(r'$');
      i += 2;
    } else if (letra == r'$' && _abreFormula(texto, i)) {
      final cierre = _cierreDeFormula(texto, i + 1);
      if (cierre == null) {
        actual.write(letra);
        i++;
      } else {
        cerrarTexto();
        trozos.add(FormulaEnLinea(texto.substring(i + 1, cierre)));
        i = cierre + 1;
      }
    } else if (letra == '*' && siguiente == '*') {
      cerrarTexto();
      negrita = !negrita;
      i += 2;
    } else if (letra == '*' && _cambiaCursiva(texto, i, cursiva)) {
      cerrarTexto();
      cursiva = !cursiva;
      i++;
    } else {
      actual.write(letra);
      i++;
    }
  }
  cerrarTexto();
  return trozos;
}

bool _esEspacio(String letra) => letra.trim().isEmpty;

bool _abreFormula(String texto, int i) =>
    i + 1 < texto.length && !_esEspacio(texto[i + 1]);

int? _cierreDeFormula(String texto, int desde) {
  for (var j = desde; j < texto.length; j++) {
    if (texto[j] != r'$' || texto[j - 1] == r'\') continue;
    final despues = j + 1 < texto.length ? texto[j + 1] : '';
    if (!_esEspacio(texto[j - 1]) && !RegExp(r'\d').hasMatch(despues)) {
      return j;
    }
  }
  return null;
}

/// Un `*` abre la cursiva si lo sigue algo que no es un espacio y la cierra
/// si lo antecede algo que no es un espacio; si no, es un asterisco.
bool _cambiaCursiva(String texto, int i, bool cursiva) {
  if (cursiva) return i > 0 && !_esEspacio(texto[i - 1]);
  return i + 1 < texto.length && !_esEspacio(texto[i + 1]);
}
