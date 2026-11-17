import 'package:flutter/material.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/hoja_confirmacion.dart';

/// Lo que se muestra después de 5 contraseñas incorrectas en 15 minutos
/// (429 `DEMASIADOS_INTENTOS`).
const String demasiadosIntentosContrasena =
    'Hiciste demasiados intentos con una contraseña incorrecta. Espera unos '
    'minutos y vuelve a intentarlo.';

/// Reparte un error de descargar los datos o borrar la cuenta: `campo` va
/// bajo el campo de la contraseña y `general`, sobre el botón.
({String? campo, String? general}) erroresDeContrasena(ErrorApi error) =>
    switch (error) {
      // La contraseña no es la de la cuenta. La sesión sigue abierta.
      ErrorApi(estadoHttp: 401) => (campo: contrasenaIncorrecta, general: null),
      ErrorApi(estadoHttp: 429) || ErrorApi(codigo: 'DEMASIADOS_INTENTOS') => (
        campo: null,
        general: demasiadosIntentosContrasena,
      ),
      _ => switch (error.mensajeDeCampo('contrasena')) {
        final mensaje? => (campo: mensaje, general: null),
        null => (campo: null, general: error.mensaje),
      },
    };

/// Pide la contraseña en una hoja antes de [accion] (descargar los datos,
/// A39 y A42). La hoja hace la petición, muestra los errores y se cierra
/// solo si salió bien, entregando lo que [accion] devolvió; `null` si se
/// cerró sin confirmar.
Future<T?> pedirConContrasena<T>(
  BuildContext context, {
  required String titulo,
  required String texto,
  required String confirmar,
  required Future<T> Function(String contrasena) accion,
}) => mostrarHoja<T>(
  context,
  HojaContrasena<T>(
    titulo: titulo,
    texto: texto,
    confirmar: confirmar,
    accion: accion,
  ),
);

class HojaContrasena<T> extends StatefulWidget {
  const HojaContrasena({
    required this.titulo,
    required this.texto,
    required this.confirmar,
    required this.accion,
    super.key,
  });

  final String titulo;
  final String texto;
  final String confirmar;
  final Future<T> Function(String contrasena) accion;

  @override
  State<HojaContrasena<T>> createState() => _HojaContrasenaState<T>();
}

class _HojaContrasenaState<T> extends State<HojaContrasena<T>> {
  final _contrasena = TextEditingController();
  bool _enviando = false;
  String? _errorCampo;
  String? _errorGeneral;

  @override
  void dispose() {
    _contrasena.dispose();
    super.dispose();
  }

  bool get _listo => _contrasena.text.isNotEmpty && !_enviando;

  Future<void> _confirmar() async {
    if (!_listo) return;
    setState(() {
      _enviando = true;
      _errorCampo = null;
      _errorGeneral = null;
    });
    try {
      final resultado = await widget.accion(_contrasena.text);
      if (mounted) Navigator.of(context).pop(resultado);
    } on ErrorApi catch (error) {
      final errores = erroresDeContrasena(error);
      if (mounted) {
        setState(() {
          _enviando = false;
          _errorCampo = errores.campo;
          _errorGeneral = errores.general;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    child: Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(
          TemaSuperaPaes.margenPantalla,
          0,
          TemaSuperaPaes.margenPantalla,
          TemaSuperaPaes.espacio24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(widget.titulo, style: TemaSuperaPaes.h2),
            const SizedBox(height: 12),
            Text(widget.texto),
            const SizedBox(height: 16),
            CampoContrasena(
              etiqueta: 'Contraseña',
              controller: _contrasena,
              enabled: !_enviando,
              forceErrorText: _errorCampo,
              autofillHints: const [AutofillHints.password],
              textInputAction: TextInputAction.done,
              onChanged: (_) => setState(() => _errorCampo = null),
              onFieldSubmitted: (_) => _confirmar(),
            ),
            const SizedBox(height: 16),
            if (_errorGeneral case final error?) ...[
              Aviso(tono: TonoAviso.error, texto: error),
              const SizedBox(height: 12),
            ],
            FilledButton(
              onPressed: _listo ? _confirmar : null,
              child: _enviando
                  ? const CargandoEnBoton()
                  : Text(widget.confirmar),
            ),
            const SizedBox(height: 8),
            BotonTexto(
              onPressed: _enviando ? null : () => Navigator.of(context).pop(),
              child: const Text('Cancelar'),
            ),
          ],
        ),
      ),
    ),
  );
}
