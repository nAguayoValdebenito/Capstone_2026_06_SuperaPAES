import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/comunes/pantalla_base.dart';
import 'package:supera_paes/presentacion/crear_cuenta/validaciones_registro.dart';

/// Pantalla Recuperar contraseña (A04; HU-06, CU-04): pide el correo y
/// confirma el envío de un enlace de un solo uso que vence en 1 hora. La
/// confirmación es la misma exista o no la cuenta, como la respuesta de la
/// API. La contraseña nueva se crea en la página de la consola que abre el
/// enlace (A05).
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

  /// Se pidió otro enlace desde la confirmación.
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

  void _volverAIngreso() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(Rutas.ingreso);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PantallaBase(
      hijos: [
        if (_enviadoA case final correo?)
          _confirmacion(correo)
        else
          _formularioCorreo(),
      ],
    );
  }

  Widget _formularioCorreo() {
    final tema = Theme.of(context);
    return Form(
      key: _formulario,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Escribe el correo de tu cuenta y te enviaremos un enlace para '
            'crear una contraseña nueva.',
            style: tema.textTheme.bodyLarge,
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _correo,
            decoration: const InputDecoration(
              labelText: 'Correo',
              border: OutlineInputBorder(),
            ),
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
          ..._avisoError(tema),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _enviando ? null : _enviar,
            child: _enviando ? const _Cargando() : const Text('Enviar enlace'),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: _enviando ? null : _volverAIngreso,
            child: const Text('Volver a Iniciar sesión'),
          ),
        ],
      ),
    );
  }

  Widget _confirmacion(String correo) {
    final tema = Theme.of(context);
    final textos = tema.textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Icon(
          Icons.mark_email_read_outlined,
          size: 64,
          color: tema.colorScheme.primary,
        ),
        const SizedBox(height: 16),
        Text(
          _reenviado ? 'Te enviamos otro enlace' : 'Revisa tu correo',
          style: textos.titleLarge,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          'Si $correo tiene una cuenta, te enviamos un enlace para crear una '
          'contraseña nueva. Vence en 1 hora y sirve una sola vez.',
          style: textos.bodyLarge,
        ),
        const SizedBox(height: 8),
        Text(
          'Ábrelo en tu teléfono: se abrirá una página donde escribes la '
          'contraseña nueva. Si pides otro enlace, el anterior deja de servir.',
          style: textos.bodyMedium,
        ),
        ..._avisoError(tema),
        const SizedBox(height: 24),
        FilledButton(
          onPressed: _enviando ? null : _volverAIngreso,
          child: const Text('Volver a Iniciar sesión'),
        ),
        const SizedBox(height: 8),
        OutlinedButton(
          onPressed: _enviando
              ? null
              : () => _solicitar(correo, esReenvio: true),
          child: _enviando
              ? const _Cargando()
              : const Text('Reenviar el enlace'),
        ),
      ],
    );
  }

  List<Widget> _avisoError(ThemeData tema) => [
    if (_error case final mensaje?) ...[
      const SizedBox(height: 12),
      Text(mensaje, style: TextStyle(color: tema.colorScheme.error)),
    ],
  ];
}

class _Cargando extends StatelessWidget {
  const _Cargando();

  @override
  Widget build(BuildContext context) => const SizedBox.square(
    dimension: 20,
    child: CircularProgressIndicator(strokeWidth: 2),
  );
}
