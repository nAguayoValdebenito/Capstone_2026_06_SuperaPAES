// Componentes del sistema de diseño (DAS 7.5; página «Componentes» de Figma,
// versión 3). Toda pantalla nueva se arma con ellos y con el tema: nada de
// colores, radios ni tamaños sueltos. Guía: app/DISENO.md.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/nucleo/tema.dart';

/// Pantalla de los bocetos de la app: sin barra superior, con el contenido
/// desplazable y márgenes de 24. Arriba puede ir un [EnlaceVolver]; el [pie]
/// queda fijo abajo, como el botón «Continuar» de A08. Un error de ese botón
/// va en el pie, sobre él (ver [PieConError]), para que siempre se vea.
class PantallaFormulario extends StatelessWidget {
  const PantallaFormulario({
    required this.hijos,
    super.key,
    this.separacion,
    this.pie,
    this.alActualizar,
  });

  final List<Widget> hijos;

  /// Espacio entre los hijos; por defecto, 16 como en los bocetos.
  final double? separacion;
  final Widget? pie;

  /// Con esta función, deslizar hacia abajo vuelve a cargar la pantalla
  /// (Inicio relee el cupo del día).
  final Future<void> Function()? alActualizar;

  @override
  Widget build(BuildContext context) {
    final espacio = separacion ?? 16;
    const margen = TemaSuperaPaes.margenPantalla;
    final lista = ListView(
      // Se puede deslizar para actualizar aunque el contenido quepa entero.
      physics: alActualizar == null
          ? null
          : const AlwaysScrollableScrollPhysics(),
      padding: EdgeInsets.fromLTRB(
        margen,
        8,
        margen,
        pie == null ? margen : espacio,
      ),
      children: [
        for (final (i, hijo) in hijos.indexed) ...[
          if (i > 0) SizedBox(height: espacio),
          hijo,
        ],
      ],
    );
    return Scaffold(
      body: SafeArea(
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
            if (pie case final abajo?)
              Padding(
                padding: const EdgeInsets.fromLTRB(margen, 0, margen, margen),
                child: abajo,
              ),
          ],
        ),
      ),
    );
  }
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
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
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

/// Tonos de [Aviso] (Aviso: Info, Aviso, Error, Éxito, Neutro y Primario).
enum TonoAviso { info, aviso, error, exito, neutro, primario }

/// Aviso con ícono y texto (Texto/Pequeño). [destacado] va en negrita al
/// inicio, como «Revisa tu correo.» en A04; [textoRico] reemplaza al texto
/// cuando la negrita va en medio, como el área de carrera en A09b.
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
    final (fondo, colorTexto, icono, borde) = switch (tono) {
      TonoAviso.info => (
        TemaSuperaPaes.primarioSuave,
        TemaSuperaPaes.primarioOscuro,
        Icons.info_outline,
        null,
      ),
      TonoAviso.aviso => (
        TemaSuperaPaes.avisoSuave,
        TemaSuperaPaes.avisoTexto,
        Icons.warning_amber_rounded,
        TemaSuperaPaes.avisoBorde,
      ),
      TonoAviso.error => (
        TemaSuperaPaes.errorSuave,
        TemaSuperaPaes.errorTexto,
        Icons.cancel_outlined,
        null,
      ),
      TonoAviso.exito => (
        TemaSuperaPaes.exitoSuave,
        TemaSuperaPaes.exitoTexto,
        Icons.check_circle_outline,
        null,
      ),
      TonoAviso.neutro => (
        TemaSuperaPaes.neutroSuave,
        TemaSuperaPaes.texto,
        Icons.info_outline,
        null,
      ),
      TonoAviso.primario => (
        TemaSuperaPaes.primarioSuave,
        TemaSuperaPaes.primario,
        Icons.info_outline,
        null,
      ),
    };
    final estilo = TemaSuperaPaes.pequeno.copyWith(color: colorTexto);
    return Semantics(
      liveRegion: tono == TonoAviso.error || tono == TonoAviso.exito,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: fondo,
          borderRadius: BorderRadius.circular(TemaSuperaPaes.radioCampo),
          border: borde == null ? null : Border.all(color: borde),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icono, size: 20, color: colorTexto),
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
                style: estilo,
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

/// Ícono de 24 en un círculo de 48, sobre el título de una pantalla o una
/// hoja: el basurero de A42 o el reloj de A29.
class IconoEnCirculo extends StatelessWidget {
  const IconoEnCirculo({
    required this.icono,
    required this.fondo,
    required this.color,
    super.key,
  });

  final IconData icono;
  final Color fondo;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        width: 48,
        height: 48,
        decoration: BoxDecoration(color: fondo, shape: BoxShape.circle),
        child: Icon(icono, size: 24, color: color),
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
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          onPressed: onPressed,
          child: Text(enlace),
        ),
      ],
    );
  }
}
