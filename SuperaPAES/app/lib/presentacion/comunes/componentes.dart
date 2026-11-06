// Componentes del sistema de diseño (DAS 7.5; página «Componentes» de Figma,
// versión 3). Toda pantalla nueva se arma con ellos y con el tema: nada de
// colores, radios ni tamaños sueltos. Guía: app/DISENO.md.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/nucleo/tema.dart';

/// Pantalla de los bocetos de la app: sin barra superior, con el contenido
/// desplazable sobre el fondo de cuaderno y márgenes de 24. Arriba puede ir
/// un [EnlaceVolver]; el [pie] queda fijo abajo, como el botón «Continuar» de
/// A08. Un error de ese botón va en el pie, sobre él (ver [PieConError]),
/// para que siempre se vea. Con letra de 1,5 o más, el pie fijo taparía media
/// pantalla: pasa al final del contenido desplazable. En tablet, el
/// contenido y el pie van centrados con [anchoMaximo].
class PantallaFormulario extends StatelessWidget {
  const PantallaFormulario({
    required this.hijos,
    super.key,
    this.separacion,
    this.pie,
    this.alActualizar,
    this.anchoMaximo = TemaSuperaPaes.anchoFormulario,
  });

  final List<Widget> hijos;

  /// Espacio entre los hijos; por defecto, 16 como en los bocetos.
  final double? separacion;
  final Widget? pie;

  /// Con esta función, deslizar hacia abajo vuelve a cargar la pantalla
  /// (Inicio relee el cupo del día).
  final Future<void> Function()? alActualizar;

  /// Ancho máximo del contenido: [TemaSuperaPaes.anchoFormulario] o, en las
  /// pantallas de lectura, [TemaSuperaPaes.anchoLectura].
  final double anchoMaximo;

  /// Desde esta escala de letra el [pie] deja de ir fijo y baja al final del
  /// contenido (RNF-12).
  static const double escalaParaPieEnLista = 1.5;

  @override
  Widget build(BuildContext context) {
    final espacio = separacion ?? 16;
    final margen = margenLateral(context, anchoMaximo);
    const abajo = TemaSuperaPaes.margenPantalla;
    final pieEnLista =
        pie != null &&
        MediaQuery.textScalerOf(context).scale(1) >= escalaParaPieEnLista;
    final pieFijo = pieEnLista ? null : pie;
    final lista = ListView(
      // Se puede deslizar para actualizar aunque el contenido quepa entero.
      physics: alActualizar == null
          ? null
          : const AlwaysScrollableScrollPhysics(),
      padding: EdgeInsets.fromLTRB(
        margen,
        8,
        margen,
        pieFijo == null ? abajo : espacio,
      ),
      children: [
        for (final (i, hijo) in hijos.indexed) ...[
          if (i > 0) SizedBox(height: espacio),
          hijo,
        ],
        if (pieEnLista) ...[const SizedBox(height: abajo), ?pie],
      ],
    );
    return Scaffold(
      body: FondoCuaderno(
        child: SafeArea(
          child: Column(
            children: [
              Expanded(
                child: switch (alActualizar) {
                  final actualizar? => RefreshIndicator(
                    onRefresh: actualizar,
                    child: lista,
                  ),
                  null => lista,
                },
              ),
              if (pieFijo case final contenido?)
                Padding(
                  padding: EdgeInsets.fromLTRB(margen, 0, margen, abajo),
                  child: contenido,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Identidad «cuaderno de cuadros»: el fondo de la pantalla con una cuadrícula
/// fina, como la hoja de matemática. Se pinta una vez (pintor estático dentro
/// de un `RepaintBoundary`), así que no cuesta nada al desplazar.
class FondoCuaderno extends StatelessWidget {
  const FondoCuaderno({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      const Positioned.fill(
        child: RepaintBoundary(
          child: CustomPaint(painter: _PintorCuadricula()),
        ),
      ),
      child,
    ],
  );
}

class _PintorCuadricula extends CustomPainter {
  const _PintorCuadricula();

  @override
  void paint(Canvas canvas, Size size) {
    final linea = Paint()
      ..color = TemaSuperaPaes.cuadricula
      ..strokeWidth = 1;
    const paso = TemaSuperaPaes.pasoCuadricula;
    for (var x = paso / 2; x < size.width; x += paso) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), linea);
    }
    for (var y = paso / 2; y < size.height; y += paso) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), linea);
    }
  }

  @override
  bool shouldRepaint(_PintorCuadricula anterior) => false;
}

/// Margen de los lados de una pantalla: 24, o más en tablet para que el
/// contenido no pase de [anchoMaximo] y quede centrado. Se calcula con el
/// ancho de la pantalla, no con el diseño, así que no reconstruye nada.
double margenLateral(BuildContext context, double anchoMaximo) {
  final ancho = MediaQuery.sizeOf(context).width;
  final sobra = (ancho - anchoMaximo) / 2;
  return sobra > TemaSuperaPaes.margenPantalla
      ? sobra
      : TemaSuperaPaes.margenPantalla;
}

/// Enlace «‹ Pantalla anterior» de los bocetos. Vuelve atrás si se puede; si
/// la pantalla se abrió sin historial, va a [destino].
class EnlaceVolver extends StatelessWidget {
  const EnlaceVolver({required this.texto, required this.destino, super.key});

  final String texto;
  final String destino;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: TextButton.icon(
        style: TextButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 4),
          minimumSize: Size.zero,
          tapTargetSize: MaterialTapTargetSize.padded,
        ),
        onPressed: () => context.canPop() ? context.pop() : context.go(destino),
        icon: const Icon(Icons.chevron_left, size: 20),
        label: Text(texto),
      ),
    );
  }
}

/// Título de la pantalla (Titulo/H1) con su bajada opcional (Texto/Cuerpo,
/// gris). La bajada puede traer partes en negrita con [bajadaRica].
class Encabezado extends StatelessWidget {
  const Encabezado({
    required this.titulo,
    super.key,
    this.bajada,
    this.bajadaRica,
    this.centrado = false,
  });

  final String titulo;
  final String? bajada;
  final InlineSpan? bajadaRica;
  final bool centrado;

  @override
  Widget build(BuildContext context) {
    final estiloBajada = TemaSuperaPaes.cuerpo.copyWith(
      color: TemaSuperaPaes.textoSecundario,
    );
    final alineacion = centrado ? TextAlign.center : TextAlign.start;
    return Column(
      crossAxisAlignment: centrado
          ? CrossAxisAlignment.center
          : CrossAxisAlignment.start,
      children: [
        Semantics(
          header: true,
          child: Text(titulo, style: TemaSuperaPaes.h1, textAlign: alineacion),
        ),
        if (bajadaRica != null || bajada != null) ...[
          const SizedBox(height: 4),
          if (bajadaRica case final rica?)
            Text.rich(rica, style: estiloBajada, textAlign: alineacion)
          else
            Text(bajada!, style: estiloBajada, textAlign: alineacion),
        ],
      ],
    );
  }
}

/// Campo con su etiqueta arriba (Texto/Etiqueta) y una ayuda opcional abajo
/// (Texto/Pequeño, gris). Lo usan [CampoTexto] y [CampoContrasena].
class CampoConEtiqueta extends StatelessWidget {
  const CampoConEtiqueta({
    required this.etiqueta,
    required this.child,
    super.key,
    this.ayuda,
    this.deshabilitado = false,
  });

  final String etiqueta;
  final Widget child;
  final String? ayuda;
  final bool deshabilitado;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          etiqueta,
          style: TemaSuperaPaes.etiqueta.copyWith(
            color: deshabilitado ? TemaSuperaPaes.textoSecundario : null,
          ),
        ),
        const SizedBox(height: 6),
        child,
        if (ayuda case final texto?) ...[
          const SizedBox(height: 6),
          Text(
            texto,
            style: TemaSuperaPaes.pequeno.copyWith(
              color: TemaSuperaPaes.textoSecundario,
            ),
          ),
        ],
      ],
    );
  }
}

/// Campo de texto del sistema de diseño (Campo: Normal, Vacío, Foco y Error).
class CampoTexto extends StatelessWidget {
  const CampoTexto({
    required this.etiqueta,
    required this.controller,
    super.key,
    this.pista,
    this.ayuda,
    this.validator,
    this.forceErrorText,
    this.onChanged,
    this.onFieldSubmitted,
    this.keyboardType,
    this.textInputAction,
    this.textCapitalization = TextCapitalization.none,
    this.autofillHints,
    this.inputFormatters,
    this.enabled = true,
    this.autocorrect = true,
  });

  final String etiqueta;
  final TextEditingController controller;
  final String? pista;
  final String? ayuda;
  final FormFieldValidator<String>? validator;
  final String? forceErrorText;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onFieldSubmitted;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final TextCapitalization textCapitalization;
  final Iterable<String>? autofillHints;
  final List<TextInputFormatter>? inputFormatters;
  final bool enabled;
  final bool autocorrect;

  @override
  Widget build(BuildContext context) {
    return CampoConEtiqueta(
      etiqueta: etiqueta,
      ayuda: ayuda,
      child: TextFormField(
        controller: controller,
        decoration: InputDecoration(hintText: pista, errorMaxLines: 3),
        style: TemaSuperaPaes.cuerpo,
        keyboardType: keyboardType,
        textInputAction: textInputAction,
        textCapitalization: textCapitalization,
        autocorrect: autocorrect,
        autofillHints: autofillHints,
        inputFormatters: inputFormatters,
        enabled: enabled,
        forceErrorText: forceErrorText,
        onChanged: onChanged,
        onFieldSubmitted: onFieldSubmitted,
        validator: validator,
      ),
    );
  }
}

/// Campo de contraseña (Campo contraseña: Normal y Error), con el botón del
/// ojo para mostrarla.
class CampoContrasena extends StatefulWidget {
  const CampoContrasena({
    required this.etiqueta,
    required this.controller,
    super.key,
    this.ayuda,
    this.validator,
    this.forceErrorText,
    this.onChanged,
    this.onFieldSubmitted,
    this.textInputAction,
    this.autofillHints,
    this.enabled = true,
  });

  final String etiqueta;
  final TextEditingController controller;
  final String? ayuda;
  final FormFieldValidator<String>? validator;
  final String? forceErrorText;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onFieldSubmitted;
  final TextInputAction? textInputAction;
  final Iterable<String>? autofillHints;
  final bool enabled;

  @override
  State<CampoContrasena> createState() => _CampoContrasenaState();
}

class _CampoContrasenaState extends State<CampoContrasena> {
  bool _visible = false;

  @override
  Widget build(BuildContext context) {
    return CampoConEtiqueta(
      etiqueta: widget.etiqueta,
      ayuda: widget.ayuda,
      child: TextFormField(
        controller: widget.controller,
        decoration: InputDecoration(
          errorMaxLines: 3,
          suffixIcon: IconButton(
            tooltip: _visible ? 'Ocultar contraseña' : 'Mostrar contraseña',
            icon: Icon(
              _visible
                  ? Icons.visibility_off_outlined
                  : Icons.visibility_outlined,
              size: 20,
              color: TemaSuperaPaes.textoSecundario,
            ),
            onPressed: () => setState(() => _visible = !_visible),
          ),
        ),
        style: TemaSuperaPaes.cuerpo,
        obscureText: !_visible,
        autocorrect: false,
        enableSuggestions: false,
        textInputAction: widget.textInputAction,
        autofillHints: widget.autofillHints,
        enabled: widget.enabled,
        forceErrorText: widget.forceErrorText,
        onChanged: widget.onChanged,
        onFieldSubmitted: widget.onFieldSubmitted,
        validator: widget.validator,
      ),
    );
  }
}

/// Tonos de [Aviso] (Info, Aviso, Error, Éxito, Neutro y Primario). El tono
/// decide el ícono y su color; el texto va siempre en tinta.
enum TonoAviso { info, aviso, error, exito, neutro, primario }

/// Aviso con ícono y texto (Texto/Pequeño): hoja blanca con borde fino y el
/// ícono en su tono, sin relleno pastel. El color de alarma queda para lo que
/// de verdad lo es (error y éxito, que además llevan su propio ícono).
/// [destacado] va en negrita al inicio, como «Revisa tu correo.» en A04;
/// [textoRico] reemplaza al texto cuando la negrita va en medio, como el
/// área de carrera en A09b.
class Aviso extends StatelessWidget {
  const Aviso({
    required this.tono,
    this.texto = '',
    super.key,
    this.destacado,
    this.textoRico,
  });

  final TonoAviso tono;
  final String texto;
  final String? destacado;
  final InlineSpan? textoRico;

  @override
  Widget build(BuildContext context) {
    final (color, icono, borde) = switch (tono) {
      TonoAviso.info || TonoAviso.primario => (
        TemaSuperaPaes.primario,
        Icons.info_outline_rounded,
        TemaSuperaPaes.borde,
      ),
      TonoAviso.aviso => (
        TemaSuperaPaes.primarioOscuro,
        Icons.error_outline_rounded,
        TemaSuperaPaes.borde,
      ),
      TonoAviso.error => (
        TemaSuperaPaes.error,
        Icons.cancel_outlined,
        TemaSuperaPaes.error,
      ),
      TonoAviso.exito => (
        TemaSuperaPaes.exito,
        Icons.check_circle_outline_rounded,
        TemaSuperaPaes.exito,
      ),
      TonoAviso.neutro => (
        TemaSuperaPaes.textoSecundario,
        Icons.info_outline_rounded,
        TemaSuperaPaes.borde,
      ),
    };
    return Semantics(
      liveRegion: tono == TonoAviso.error || tono == TonoAviso.exito,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: TemaSuperaPaes.superficie,
          borderRadius: BorderRadius.circular(TemaSuperaPaes.radioCampo),
          border: Border.all(color: borde),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              icono,
              size: MediaQuery.textScalerOf(context).scale(20),
              color: color,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text.rich(
                TextSpan(
                  children: [
                    if (destacado case final fuerte?)
                      TextSpan(
                        text: '$fuerte ',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    textoRico ?? TextSpan(text: texto),
                  ],
                ),
                style: TemaSuperaPaes.pequeno,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Un número grande con su texto debajo, en un tercio del ancho: «7
/// correctas» de A21 y A30. Va dentro de una `Row`.
class DatoResumen extends StatelessWidget {
  const DatoResumen({required this.valor, required this.texto, super.key});

  final String valor;
  final String texto;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(valor, style: TemaSuperaPaes.numero),
          Text(
            texto,
            style: TemaSuperaPaes.pequeno.copyWith(
              color: TemaSuperaPaes.textoSecundario,
            ),
          ),
        ],
      ),
    );
  }
}

/// Tarjeta blanca con borde (radio 16, relleno 16), como los recuadros de A12
/// y A05.
class Tarjeta extends StatelessWidget {
  const Tarjeta({required this.child, super.key, this.color, this.borde});

  final Widget child;
  final Color? color;
  final Color? borde;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color ?? TemaSuperaPaes.superficie,
        borderRadius: BorderRadius.circular(TemaSuperaPaes.radioTarjeta),
        border: Border.all(color: borde ?? TemaSuperaPaes.borde),
      ),
      child: child,
    );
  }
}

/// Ícono suelto (sin círculo pastel) sobre el título de una pantalla o una
/// hoja: el basurero de A42 o el reloj de A29. Es decorativo.
class IconoEnCirculo extends StatelessWidget {
  const IconoEnCirculo({
    required this.icono,
    super.key,
    this.color = TemaSuperaPaes.primario,
  });

  final IconData icono;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: ExcludeSemantics(
        child: SizedBox.square(
          dimension: 48,
          child: Icon(icono, size: 32, color: color),
        ),
      ),
    );
  }
}

/// Botón chico (Botón chico: 40 de alto, radio 10, Boton/Normal), para los
/// botones dentro de un aviso o una fila.
class BotonChico extends StatelessWidget {
  const BotonChico({required this.texto, required this.onPressed, super.key});

  final String texto;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      style: FilledButton.styleFrom(
        minimumSize: const Size(0, TemaSuperaPaes.altoBotonChico),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(TemaSuperaPaes.radioBotonChico),
        ),
        textStyle: TemaSuperaPaes.botonNormal,
      ),
      onPressed: onPressed,
      child: Text(texto),
    );
  }
}

/// Botón de texto a lo ancho (Botón: Texto), como «Reenviar enlace».
class BotonTexto extends StatelessWidget {
  const BotonTexto({required this.child, required this.onPressed, super.key});

  final Widget child;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return TextButton(
      style: TextButton.styleFrom(
        minimumSize: const Size.fromHeight(TemaSuperaPaes.altoBoton),
        textStyle: TemaSuperaPaes.botonGrande,
      ),
      onPressed: onPressed,
      child: child,
    );
  }
}

/// Pie fijo de [PantallaFormulario]: el [Aviso] de error, si hay, sobre el
/// botón.
class PieConError extends StatelessWidget {
  const PieConError({required this.boton, super.key, this.error});

  final Widget boton;
  final String? error;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (error case final texto?) ...[
          Aviso(tono: TonoAviso.error, texto: texto),
          const SizedBox(height: 12),
        ],
        boton,
      ],
    );
  }
}

/// Indicador de carga dentro de un botón mientras se envía.
class CargandoEnBoton extends StatelessWidget {
  const CargandoEnBoton({super.key});

  @override
  Widget build(BuildContext context) => const SizedBox.square(
    dimension: 20,
    child: CircularProgressIndicator(strokeWidth: 2),
  );
}

/// Pregunta con enlace al pie de un formulario, como «¿No tienes cuenta?
/// Crea una».
class PieConEnlace extends StatelessWidget {
  const PieConEnlace({
    required this.pregunta,
    required this.enlace,
    required this.onPressed,
    super.key,
  });

  final String pregunta;
  final String enlace;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    // Wrap: con letra grande, el enlace baja a la línea siguiente.
    return Wrap(
      alignment: WrapAlignment.center,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Text(
          pregunta,
          style: TemaSuperaPaes.pequeno.copyWith(
            color: TemaSuperaPaes.textoSecundario,
          ),
        ),
        TextButton(
          style: TextButton.styleFrom(
            textStyle: TemaSuperaPaes.pequenoFuerte.copyWith(
              fontFamily: TemaSuperaPaes.fuenteInterfaz,
            ),
            padding: const EdgeInsets.symmetric(horizontal: 4),
            minimumSize: Size.zero,
            tapTargetSize: MaterialTapTargetSize.padded,
          ),
          onPressed: onPressed,
          child: Text(enlace),
        ),
      ],
    );
  }
}

/// El destacador del cuaderno: una franja celeste (el celeste del logo al
/// 30 %) bajo la mitad inferior del texto, como un subrayado con destacador.
/// Marca lo que pide atención («Reforzar», «Sin verificar», «Tu racha subió»)
/// sin usar amarillo ni naranja. Con [icono], va antes del texto.
class Destacado extends StatelessWidget {
  const Destacado({required this.texto, super.key, this.icono, this.estilo});

  final String texto;
  final IconData? icono;
  final TextStyle? estilo;

  @override
  Widget build(BuildContext context) {
    final letra =
        estilo ??
        TemaSuperaPaes.pequenoFuerte.copyWith(
          color: TemaSuperaPaes.logoOscuro,
          fontWeight: FontWeight.w800,
        );
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (icono != null) ...[
          Icon(
            icono,
            size: MediaQuery.textScalerOf(context).scale(15),
            color: TemaSuperaPaes.logoOscuro,
          ),
          const SizedBox(width: TemaSuperaPaes.espacio4),
        ],
        Flexible(
          child: CustomPaint(
            painter: const _PintorDestacador(),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 3),
              child: Text(texto, style: letra),
            ),
          ),
        ),
      ],
    );
  }
}

class _PintorDestacador extends CustomPainter {
  const _PintorDestacador();

  @override
  void paint(Canvas canvas, Size size) {
    final franja = RRect.fromRectAndCorners(
      Rect.fromLTWH(0, size.height * 0.48, size.width, size.height * 0.44),
      topLeft: const Radius.circular(2),
      topRight: const Radius.circular(6),
      bottomLeft: const Radius.circular(6),
      bottomRight: const Radius.circular(2),
    );
    canvas.drawRRect(franja, Paint()..color = TemaSuperaPaes.destacador);
  }

  @override
  bool shouldRepaint(_PintorDestacador anterior) => false;
}

/// Los datos de apoyo de una pantalla en una sola línea, sin fichas
/// iguales: «**8** correctas · **2** incorrectas · **9 min** de tiempo». Cada
/// dato es (valor, texto). Con letra grande pasa a la línea siguiente sin
/// partir un dato; el valor va en cifras tabulares.
class LineaDatos extends StatelessWidget {
  const LineaDatos({required this.datos, super.key});

  final List<(String, String)> datos;

  @override
  Widget build(BuildContext context) => Wrap(
    crossAxisAlignment: WrapCrossAlignment.center,
    spacing: TemaSuperaPaes.espacio12,
    runSpacing: TemaSuperaPaes.espacio4,
    children: [
      for (final (i, (valor, texto)) in datos.indexed)
        Text.rich(
          TextSpan(
            children: [
              TextSpan(
                text: valor,
                style: TemaSuperaPaes.tabular(
                  TemaSuperaPaes.h2.copyWith(fontWeight: FontWeight.w800),
                ),
              ),
              TextSpan(
                text: ' $texto',
                style: TemaSuperaPaes.pequeno.copyWith(
                  color: TemaSuperaPaes.textoSecundario,
                ),
              ),
              if (i < datos.length - 1)
                TextSpan(
                  text: '   ·',
                  style: TemaSuperaPaes.pequeno.copyWith(
                    color: TemaSuperaPaes.bordeInput,
                  ),
                ),
            ],
          ),
        ),
    ],
  );
}
