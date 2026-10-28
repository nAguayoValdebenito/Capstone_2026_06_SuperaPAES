// Componentes de selección y de filas del sistema de diseño (DAS 7.5; página
// «Componentes» de Figma, versión 3): Opción, Chip, Etiqueta, la tarjeta con
// casilla de A10, el indicador de pasos de A08 a A10 y las filas de A37.
// Guía: app/DISENO.md.
import 'package:flutter/material.dart';

import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/formato_pregunta_vista.dart';

/// Opción con radio (Opción: Normal y Seleccionada), como los cursos de A08.
class OpcionRadio extends StatelessWidget {
  const OpcionRadio({
    required this.texto,
    required this.seleccionada,
    required this.onTap,
    super.key,
    this.detalle,
  });

  final String texto;
  final bool seleccionada;
  final VoidCallback onTap;

  /// Texto gris bajo el título, como el contenido elegido en A13.
  final String? detalle;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      inMutuallyExclusiveGroup: true,
      checked: seleccionada,
      child: _Seleccionable(
        seleccionada: seleccionada,
        bordeAncho: seleccionada ? 2 : 1,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        onTap: onTap,
        child: Row(
          children: [
            _Marca(redonda: true, marcada: seleccionada),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(texto, style: TemaSuperaPaes.cuerpoFuerte),
                  if (detalle case final abajo?) ...[
                    const SizedBox(height: 2),
                    Text(
                      abajo,
                      style: TemaSuperaPaes.pequeno.copyWith(
                        color: TemaSuperaPaes.textoSecundario,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Tarjeta con casilla, como cada prueba de A10: título, detalle opcional y
/// una [Etiqueta] a la derecha.
class TarjetaCasilla extends StatelessWidget {
  const TarjetaCasilla({
    required this.titulo,
    required this.marcada,
    required this.onTap,
    super.key,
    this.detalle,
    this.etiqueta,
  });

  final String titulo;
  final bool marcada;
  final VoidCallback onTap;
  final String? detalle;
  final String? etiqueta;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      checked: marcada,
      child: _Seleccionable(
        seleccionada: marcada,
        bordeAncho: 1,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        onTap: onTap,
        child: Row(
          children: [
            _Marca(redonda: false, marcada: marcada),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(titulo, style: TemaSuperaPaes.cuerpoFuerte),
                  if (detalle case final texto?)
                    Text(
                      texto,
                      style: TemaSuperaPaes.pequeno.copyWith(
                        color: TemaSuperaPaes.textoSecundario,
                      ),
                    ),
                ],
              ),
            ),
            if (etiqueta case final texto?) ...[
              const SizedBox(width: 8),
              Etiqueta(texto: texto),
            ],
          ],
        ),
      ),
    );
  }
}

/// Recuadro que se toca: blanco con borde, o azul suave con borde azul si
/// está seleccionado.
class _Seleccionable extends StatelessWidget {
  const _Seleccionable({
    required this.seleccionada,
    required this.bordeAncho,
    required this.padding,
    required this.onTap,
    required this.child,
    this.colores,
  });

  final bool seleccionada;
  final double bordeAncho;
  final EdgeInsets padding;

  /// `null`: no se puede tocar (una alternativa ya corregida).
  final VoidCallback? onTap;
  final Widget child;

  /// Fondo y borde propios, como el verde de la alternativa correcta.
  final (Color, Color)? colores;

  @override
  Widget build(BuildContext context) {
    final forma = BorderRadius.circular(TemaSuperaPaes.radioBoton);
    final (fondo, borde) =
        colores ??
        (seleccionada
            ? (TemaSuperaPaes.primarioSuave, TemaSuperaPaes.primario)
            : (TemaSuperaPaes.superficie, TemaSuperaPaes.borde));
    return Material(
      color: fondo,
      shape: RoundedRectangleBorder(
        borderRadius: forma,
        side: BorderSide(color: borde, width: bordeAncho),
      ),
      child: InkWell(
        borderRadius: forma,
        onTap: onTap,
        child: Padding(padding: padding, child: child),
      ),
    );
  }
}

/// Radio (redonda) o casilla (cuadrada) de 22, marcada en azul.
class _Marca extends StatelessWidget {
  const _Marca({required this.redonda, required this.marcada});

  final bool redonda;
  final bool marcada;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 22,
      height: 22,
      decoration: BoxDecoration(
        color: marcada ? TemaSuperaPaes.primario : TemaSuperaPaes.superficie,
        borderRadius: BorderRadius.circular(redonda ? 11 : 6),
        border: marcada
            ? null
            : Border.all(color: TemaSuperaPaes.bordeInput, width: 2),
      ),
      alignment: Alignment.center,
      child: !marcada
          ? null
          : redonda
          ? Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                color: TemaSuperaPaes.superficie,
                shape: BoxShape.circle,
              ),
            )
          : const Icon(Icons.check, size: 16, color: TemaSuperaPaes.superficie),
    );
  }
}

/// Chip (Normal y Activo), como las áreas de carrera de A09.
class ChipSeleccion extends StatelessWidget {
  const ChipSeleccion({
    required this.texto,
    required this.seleccionado,
    required this.onTap,
    super.key,
  });

  final String texto;
  final bool seleccionado;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final forma = BorderRadius.circular(TemaSuperaPaes.radioChip);
    return Semantics(
      checked: seleccionado,
      button: true,
      child: Material(
        color: seleccionado
            ? TemaSuperaPaes.primario
            : TemaSuperaPaes.superficie,
        shape: RoundedRectangleBorder(
          borderRadius: forma,
          side: seleccionado
              ? BorderSide.none
              : const BorderSide(color: TemaSuperaPaes.bordeInput),
        ),
        child: InkWell(
          borderRadius: forma,
          onTap: onTap,
          child: Container(
            constraints: const BoxConstraints(
              minHeight: TemaSuperaPaes.altoChip,
            ),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            child: Text(
              texto,
              style: TemaSuperaPaes.etiqueta.copyWith(
                color: seleccionado
                    ? TemaSuperaPaes.superficie
                    : TemaSuperaPaes.texto,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Grupo de chips que pasan a la línea siguiente, con 8 de separación.
class GrupoChips extends StatelessWidget {
  const GrupoChips({required this.chips, super.key});

  final List<Widget> chips;

  @override
  Widget build(BuildContext context) =>
      Wrap(spacing: 8, runSpacing: 8, children: chips);
}

/// Cómo quedó una alternativa en la corrección (A19 y A19b).
enum ResultadoAlternativa { correcta, incorrecta }

/// Alternativa de una pregunta (A17 a A20): la letra en un círculo y su
/// texto. Seleccionada, con borde y fondo `primario`, igual que [OpcionRadio].
/// En la corrección, la correcta va en verde y la elegida incorrecta en rojo,
/// con su [etiqueta] («Tu respuesta», «Correcta»).
class OpcionAlternativa extends StatelessWidget {
  const OpcionAlternativa({
    required this.letra,
    required this.texto,
    required this.seleccionada,
    required this.onTap,
    super.key,
    this.resultado,
    this.etiqueta,
  });

  final String letra;
  final String texto;
  final bool seleccionada;

  /// `null` mientras se envía la respuesta o ya corregida.
  final VoidCallback? onTap;
  final ResultadoAlternativa? resultado;
  final String? etiqueta;

  @override
  Widget build(BuildContext context) {
    final (fondo, color) = switch (resultado) {
      ResultadoAlternativa.correcta => (
        TemaSuperaPaes.exitoSuave,
        TemaSuperaPaes.exito,
      ),
      ResultadoAlternativa.incorrecta => (
        TemaSuperaPaes.errorSuave,
        TemaSuperaPaes.error,
      ),
      null when seleccionada => (
        TemaSuperaPaes.primarioSuave,
        TemaSuperaPaes.primario,
      ),
      null => (TemaSuperaPaes.superficie, TemaSuperaPaes.borde),
    };
    final marcada = seleccionada || resultado != null;
    return Semantics(
      inMutuallyExclusiveGroup: true,
      checked: seleccionada,
      label: ['Alternativa $letra', ?etiqueta].join(', '),
      child: _Seleccionable(
        seleccionada: seleccionada,
        bordeAncho: marcada ? 2 : 1,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        onTap: onTap,
        colores: (fondo, color),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: TemaSuperaPaes.circuloLetra,
              height: TemaSuperaPaes.circuloLetra,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: marcada ? color : TemaSuperaPaes.neutroSuave,
              ),
              child: Text(
                letra,
                style: TemaSuperaPaes.etiqueta.copyWith(
                  color: marcada
                      ? TemaSuperaPaes.superficie
                      : TemaSuperaPaes.texto,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: 3),
                // Las alternativas también pueden traer fórmulas e imágenes.
                child: TextoConFormulas(texto),
              ),
            ),
            if (etiqueta case final texto?) ...[
              const SizedBox(width: 8),
              Etiqueta(
                texto: texto,
                tono: resultado == ResultadoAlternativa.incorrecta
                    ? TonoEtiqueta.error
                    : TonoEtiqueta.exito,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Selector segmentado: una opción entre pocas, a lo ancho, como la
/// dificultad de A13 (Mezcla, Fácil, Media, Difícil). La activa va en blanco
/// con el texto en `primario`.
class SelectorSegmentado<T> extends StatelessWidget {
  const SelectorSegmentado({
    required this.opciones,
    required this.seleccionado,
    required this.onChanged,
    super.key,
  });

  /// Cada opción con su valor y su texto.
  final List<(T, String)> opciones;
  final T seleccionado;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: TemaSuperaPaes.neutroSuave,
        borderRadius: BorderRadius.circular(TemaSuperaPaes.radioCampo),
      ),
      child: Row(
        children: [
          for (final (i, (valor, texto)) in opciones.indexed) ...[
            if (i > 0) const SizedBox(width: 4),
            Expanded(
              child: _Segmento(
                texto: texto,
                activo: valor == seleccionado,
                onTap: () => onChanged(valor),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Segmento extends StatelessWidget {
  const _Segmento({
    required this.texto,
    required this.activo,
    required this.onTap,
  });

  final String texto;
  final bool activo;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final radio = BorderRadius.circular(TemaSuperaPaes.radioSegmento);
    return Semantics(
      button: true,
      selected: activo,
      inMutuallyExclusiveGroup: true,
      child: Material(
        color: activo ? TemaSuperaPaes.superficie : Colors.transparent,
        borderRadius: radio,
        child: InkWell(
          borderRadius: radio,
          onTap: onTap,
          child: Container(
            constraints: const BoxConstraints(
              minHeight: TemaSuperaPaes.altoSegmento,
            ),
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Text(
              texto,
              textAlign: TextAlign.center,
              style: TemaSuperaPaes.etiqueta.copyWith(
                color: activo
                    ? TemaSuperaPaes.primario
                    : TemaSuperaPaes.textoSecundario,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Tonos de [Etiqueta]: primario («Sugerida»), aviso («Sin verificar»),
/// éxito («Correcta») y error («Tu respuesta» incorrecta).
enum TonoEtiqueta { primario, aviso, exito, error }

/// Etiqueta (Texto/Pequeño fuerte sobre fondo suave, radio 12).
class Etiqueta extends StatelessWidget {
  const Etiqueta({
    required this.texto,
    super.key,
    this.tono = TonoEtiqueta.primario,
  });

  final String texto;
  final TonoEtiqueta tono;

  @override
  Widget build(BuildContext context) {
    final (fondo, color) = switch (tono) {
      TonoEtiqueta.primario => (
        TemaSuperaPaes.primarioSuave,
        TemaSuperaPaes.primario,
      ),
      TonoEtiqueta.aviso => (
        TemaSuperaPaes.avisoSuave,
        TemaSuperaPaes.avisoTexto,
      ),
      TonoEtiqueta.exito => (
        TemaSuperaPaes.superficie,
        TemaSuperaPaes.exitoTexto,
      ),
      TonoEtiqueta.error => (
        TemaSuperaPaes.superficie,
        TemaSuperaPaes.errorTexto,
      ),
    };
    // Sin `alignment`: así mide lo que su texto (13 × 1,4 + 6 ≈ 24 de alto)
    // y no se estira dentro de un Wrap.
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: fondo,
        borderRadius: BorderRadius.circular(TemaSuperaPaes.altoEtiqueta / 2),
      ),
      child: Text(
        texto,
        style: TemaSuperaPaes.pequenoFuerte.copyWith(color: color),
      ),
    );
  }
}

/// «Paso 1 de 3» con su barra de avance (A08 a A10). A la derecha puede ir
/// una [accion], como «Omitir» en A09.
class IndicadorPasos extends StatelessWidget {
  const IndicadorPasos({
    required this.paso,
    required this.total,
    super.key,
    this.opcional = false,
    this.accion,
  });

  final int paso;
  final int total;
  final bool opcional;
  final Widget? accion;

  @override
  Widget build(BuildContext context) {
    final texto = 'Paso $paso de $total${opcional ? ' · Opcional' : ''}';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                texto,
                style: TemaSuperaPaes.pequenoFuerte.copyWith(
                  color: TemaSuperaPaes.primario,
                ),
              ),
            ),
            ?accion,
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            for (var i = 1; i <= total; i++) ...[
              if (i > 1) const SizedBox(width: 6),
              Expanded(
                child: Container(
                  height: 6,
                  decoration: BoxDecoration(
                    color: i <= paso
                        ? TemaSuperaPaes.primario
                        : TemaSuperaPaes.neutroSuave,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }
}

/// Fila de dato de una tarjeta: etiqueta gris a la izquierda y valor a la
/// derecha (Texto/Pequeño), como «Curso · 3° medio» en A37.
class FilaDato extends StatelessWidget {
  const FilaDato({required this.etiqueta, required this.valor, super.key});

  final String etiqueta;
  final String valor;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          etiqueta,
          style: TemaSuperaPaes.pequeno.copyWith(
            color: TemaSuperaPaes.textoSecundario,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            valor,
            textAlign: TextAlign.end,
            style: TemaSuperaPaes.pequenoFuerte,
          ),
        ),
      ],
    );
  }
}

/// Fila que lleva a otra pantalla, con «›» a la derecha (Fila), como «Mi
/// suscripción» en A37. Varias van juntas en [ListaDeFilas].
class FilaNavegacion extends StatelessWidget {
  const FilaNavegacion({required this.texto, required this.onTap, super.key});

  final String texto;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Expanded(child: Text(texto, style: TemaSuperaPaes.cuerpoFuerte)),
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

/// Tarjeta con filas separadas por una línea (A37).
class ListaDeFilas extends StatelessWidget {
  const ListaDeFilas({required this.filas, super.key});

  final List<Widget> filas;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: TemaSuperaPaes.superficie,
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(TemaSuperaPaes.radioTarjeta),
        side: const BorderSide(color: TemaSuperaPaes.borde),
      ),
      child: Column(
        children: [
          for (final (i, fila) in filas.indexed) ...[
            if (i > 0) const Divider(height: 1),
            fila,
          ],
        ],
      ),
    );
  }
}
