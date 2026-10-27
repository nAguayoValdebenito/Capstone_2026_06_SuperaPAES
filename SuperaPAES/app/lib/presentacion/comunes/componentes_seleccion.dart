// Componentes de selección y de filas del sistema de diseño (DAS 7.5; página
// «Componentes» de Figma, versión 3): Opción, Chip, Etiqueta, la tarjeta con
// casilla de A10, el indicador de pasos de A08 a A10 y las filas de A37.
// Guía: app/DISENO.md.
import 'package:flutter/material.dart';

import 'package:supera_paes/nucleo/tema.dart';

/// Opción con radio (Opción: Normal y Seleccionada), como los cursos de A08.
class OpcionRadio extends StatelessWidget {
  const OpcionRadio({
    required this.texto,
    required this.seleccionada,
    required this.onTap,
    super.key,
  });

  final String texto;
  final bool seleccionada;
  final VoidCallback onTap;

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
            Expanded(child: Text(texto, style: TemaSuperaPaes.cuerpoFuerte)),
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
  });

  final bool seleccionada;
  final double bordeAncho;
  final EdgeInsets padding;
  final VoidCallback onTap;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final forma = BorderRadius.circular(TemaSuperaPaes.radioBoton);
    return Material(
      color: seleccionada
          ? TemaSuperaPaes.primarioSuave
          : TemaSuperaPaes.superficie,
      shape: RoundedRectangleBorder(
        borderRadius: forma,
        side: BorderSide(
          color: seleccionada ? TemaSuperaPaes.primario : TemaSuperaPaes.borde,
          width: bordeAncho,
        ),
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

/// Tonos de [Etiqueta]: primario («Sugerida») y aviso («Sin verificar»).
enum TonoEtiqueta { primario, aviso }

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
