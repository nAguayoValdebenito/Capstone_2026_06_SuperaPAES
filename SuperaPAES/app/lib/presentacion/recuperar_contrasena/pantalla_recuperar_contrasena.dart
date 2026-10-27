import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/crear_cuenta/validaciones_registro.dart';

/// Pantalla Recuperar contraseña (A04; HU-06, CU-04), según su boceto en
/// Figma: pide el correo y confirma el envío de un enlace de un solo uso que
/// vence en 1 hora. La confirmación es la misma exista o no la cuenta, como
/// la respuesta de la API. La contraseña nueva se crea en la página de la
/// consola que abre el enlace (A05).
class PantallaRecuperarContrasena extends ConsumerStatefulWidget {
  const PantallaRecuperarContrasena({super.key});

  @override
  ConsumerState<PantallaRecuperarContrasena> createState() =>
      _PantallaRecuperarContrasenaState();
}

class _PantallaRecuperarContrasenaState
    extends ConsumerState<PantallaRecuperarContrasena> {
  final _formulario = GlobalKey<FormState>();
  final _correo = TextEditingController();

  bool _enviando = false;

  /// Correo al que se pidió el enlace; con él se muestra la confirmación.
  String? _enviadoA;

  /// Se pidió otro enlace al mismo correo.
  bool _reenviado = false;

  String? _errorCorreo;
  String? _error;

  @override
  void dispose() {
    _correo.dispose();
    super.dispose();
  }

  Future<void> _solicitar(String correo, {bool esReenvio = false}) async {
    setState(() {
      _enviando = true;
      _error = null;
      _errorCorreo = null;
    });
    try {
      await ref.read(repositorioCuentasProvider).solicitarRecuperacion(correo);
      if (!mounted) return;
      setState(() {
        _enviadoA = correo;
        _reenviado = esReenvio;
      });
    } on ErrorApi catch (error) {
      if (!mounted) return;
      setState(() {
        _errorCorreo = error.mensajeDeCampo('correo');
        _error = _errorCorreo == null ? error.mensaje : null;
      });
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  Future<void> _enviar() async {
    setState(() => _error = null);
    if (!(_formulario.currentState?.validate() ?? false)) return;
    await _solicitar(_correo.text.trim());
  }

  @override
  Widget build(BuildContext context) {
    final enviadoA = _enviadoA;
    return PantallaFormulario(
      hijos: [
        const EnlaceVolver(texto: 'Iniciar sesión', destino: Rutas.ingreso),
        const Encabezado(
          titulo: 'Recupera tu contraseña',
          bajada: 'Te enviaremos un enlace para crear una contraseña nueva.',
        ),
        Form(
          key: _formulario,
          child: CampoTexto(
            etiqueta: 'Correo',
            controller: _correo,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.done,
            autocorrect: false,
            autofillHints: const [AutofillHints.email],
            enabled: !_enviando,
            forceErrorText: _errorCorreo,
            onChanged: (_) {
              if (_errorCorreo != null) setState(() => _errorCorreo = null);
            },
            onFieldSubmitted: (_) => _enviando ? null : _enviar(),
            validator: ValidacionesRegistro.correo,
          ),
        ),
        FilledButton(
          onPressed: _enviando ? null : _enviar,
          child: _enviando && enviadoA == null
              ? const CargandoEnBoton()
              : const Text('Enviar enlace'),
        ),
        if (_error case final mensaje?)
          Aviso(tono: TonoAviso.error, texto: mensaje),
        if (enviadoA != null) ...[
          Aviso(
            tono: TonoAviso.exito,
            destacado: _reenviado
                ? 'Te enviamos otro enlace.'
                : 'Revisa tu correo.',
            texto:
                'Si $enviadoA está registrado, te llegará un enlace. Sirve '
                'una sola vez y vence en 1 hora. Si pides otro, el anterior '
                'deja de servir.',
          ),
          BotonTexto(
            onPressed: _enviando
                ? null
                : () => _solicitar(enviadoA, esReenvio: true),
            child: _enviando
                ? const CargandoEnBoton()
                : const Text('Reenviar enlace'),
          ),
        ],
      ],
    );
  }
}
