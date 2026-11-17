import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';

/// Código de 6 dígitos en casillas separadas (A06). Por debajo hay un solo
/// campo de texto invisible que recibe lo que se escribe o se pega, así
/// funcionan el teclado numérico y el autocompletado del código.
class CampoCodigo extends StatefulWidget {
  const CampoCodigo({
    required this.controller,
    super.key,
    this.digitos = 6,
    this.error,
    this.enabled = true,
    this.onChanged,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final int digitos;

  /// Mensaje bajo las casillas (A06b); las casillas quedan en rojo.
  final String? error;
  final bool enabled;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;

  static const String etiqueta = 'Código de 6 dígitos';

  @override
  State<CampoCodigo> createState() => _CampoCodigoState();
}

class _CampoCodigoState extends State<CampoCodigo> {
  final _foco = FocusNode();

  @override
  void initState() {
    super.initState();
    _foco.addListener(_redibujar);
    widget.controller.addListener(_redibujar);
  }

  @override
  void didUpdateWidget(CampoCodigo anterior) {
    super.didUpdateWidget(anterior);
    if (anterior.controller != widget.controller) {
      anterior.controller.removeListener(_redibujar);
      widget.controller.addListener(_redibujar);
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_redibujar);
    _foco.dispose();
    super.dispose();
  }

  void _redibujar() => setState(() {});

  Widget _casilla(int indice, String texto) {
    final activa = _foco.hasFocus && indice == texto.length.clamp(0, 5);
    final (fondo, borde, ancho) = !widget.enabled
        ? (TemaSuperaPaes.neutroSuave, TemaSuperaPaes.borde, 1.0)
        : widget.error != null
        ? (TemaSuperaPaes.superficie, TemaSuperaPaes.error, 2.0)
        : activa
        ? (TemaSuperaPaes.superficie, TemaSuperaPaes.primario, 2.0)
        : (TemaSuperaPaes.superficie, TemaSuperaPaes.bordeInput, 1.0);
    return Expanded(
      child: Container(
        height: 54,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: fondo,
          borderRadius: BorderRadius.circular(TemaSuperaPaes.radioCampo),
          border: Border.all(color: borde, width: ancho),
        ),
        child: Text(
          indice < texto.length ? texto[indice] : '',
          style: TemaSuperaPaes.h1.copyWith(fontSize: 22),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final texto = widget.controller.text;
    return CampoConEtiqueta(
      etiqueta: CampoCodigo.etiqueta,
      deshabilitado: !widget.enabled,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            label: CampoCodigo.etiqueta,
            textField: true,
            value: texto,
            child: Stack(
              children: [
                Row(
                  children: [
                    for (var i = 0; i < widget.digitos; i++) ...[
                      if (i > 0) const SizedBox(width: 8),
                      _casilla(i, texto),
                    ],
                  ],
                ),
                Positioned.fill(
                  child: Opacity(
                    opacity: 0,
                    child: TextField(
                      controller: widget.controller,
                      focusNode: _foco,
                      enabled: widget.enabled,
                      keyboardType: TextInputType.number,
                      textInputAction: TextInputAction.done,
                      autofillHints: const [AutofillHints.oneTimeCode],
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(widget.digitos),
                      ],
                      showCursor: false,
                      enableInteractiveSelection: false,
                      decoration: const InputDecoration(
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        disabledBorder: InputBorder.none,
                        filled: false,
                        counterText: '',
                      ),
                      onChanged: widget.onChanged,
                      onSubmitted: widget.onSubmitted,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (widget.error case final mensaje?) ...[
            const SizedBox(height: 6),
            Text(
              mensaje,
              style: TemaSuperaPaes.pequeno.copyWith(
                color: TemaSuperaPaes.error,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
