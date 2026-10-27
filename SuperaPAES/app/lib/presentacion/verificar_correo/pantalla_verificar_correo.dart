import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/comunes/pantalla_base.dart';

/// Pantalla Verificar correo (A06, A06b y A06c; HU-05, CU-02, RN-32): pide
/// el código de 6 dígitos del correo, muestra los intentos que quedan y,
/// cuando el código ya no sirve, pide reenviar el correo. Se puede verificar
/// más tarde: sin verificar, el cupo es de 10 preguntas diarias (RN-01).
class PantallaVerificarCorreo extends ConsumerStatefulWidget {
  const PantallaVerificarCorreo({super.key});

  static const int digitosCodigo = 6;

  /// Códigos con los que el código del correo actual ya no sirve: hay que
  /// pedir uno nuevo (A06c).
  static const Set<String> codigosSinCodigoVigente = {
    'CODIGO_AGOTADO',
    'VERIFICACION_NO_VIGENTE',
  };

  @override
  ConsumerState<PantallaVerificarCorreo> createState() =>
      _PantallaVerificarCorreoState();
}

class _PantallaVerificarCorreoState
    extends ConsumerState<PantallaVerificarCorreo> {
  final _formulario = GlobalKey<FormState>();
  final _codigo = TextEditingController();

  bool _verificando = false;
  bool _reenviando = false;

  /// El código del correo actual ya no sirve (agotado o vencido): se
  /// desactiva el campo hasta reenviar el correo.
  bool _sinCodigoVigente = false;

  /// Código incorrecto (A06b), con los intentos que quedan.
  String? _errorCodigo;

  /// Error que no es del código: agotado, vencido, sin conexión, límite.
  String? _error;

  /// Confirmación del reenvío.
  String? _aviso;

  bool get _ocupado => _verificando || _reenviando;

  @override
  void dispose() {
    _codigo.dispose();
    super.dispose();
  }

  Future<void> _verificar() async {
    setState(() {
      _error = null;
      _aviso = null;
    });
    if (!(_formulario.currentState?.validate() ?? false)) return;

    setState(() => _verificando = true);
    try {
      await ref
          .read(repositorioVerificacionProvider)
          .verificarCodigo(_codigo.text);
      await ref.read(sesionProvider.notifier).marcarCorreoVerificado();
    } on ErrorApi catch (error) {
      if (!mounted) return;
      setState(() {
        if (error.codigo == 'CODIGO_INCORRECTO') {
          _errorCodigo = error.mensaje;
        } else {
          _error = error.mensaje;
          _sinCodigoVigente = PantallaVerificarCorreo.codigosSinCodigoVigente
              .contains(error.codigo);
        }
      });
    } finally {
      if (mounted) setState(() => _verificando = false);
    }
  }

  Future<void> _reenviar() async {
    setState(() {
      _error = null;
      _aviso = null;
      _reenviando = true;
    });
    try {
      final resultado = await ref
          .read(repositorioVerificacionProvider)
          .reenviar();
      if (resultado.yaVerificado) {
        await ref.read(sesionProvider.notifier).marcarCorreoVerificado();
        return;
      }
      if (!mounted) return;
      setState(() {
        if (resultado.enviado) {
          _sinCodigoVigente = false;
          _errorCodigo = null;
          _codigo.clear();
          _aviso =
              'Te enviamos un correo nuevo. Usa el código de ese correo: el '
              'anterior ya no sirve.';
        } else {
          _error =
              'No pudimos enviar el correo. Intenta de nuevo en unos minutos.';
        }
      });
    } on ErrorApi catch (error) {
      if (mounted) setState(() => _error = error.mensaje);
    } finally {
      if (mounted) setState(() => _reenviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final estudiante = ref.watch(sesionProvider).value?.estudiante;
    return PantallaBase(
      hijos: [
        if (estudiante?.correoVerificado ?? false)
          const _CorreoVerificado()
        else
          _formularioCodigo(estudiante?.correo),
      ],
    );
  }

  Widget _formularioCodigo(String? correo) {
    final tema = Theme.of(context);
    final textos = tema.textTheme;
    return Form(
      key: _formulario,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Verifica tu correo y tu cupo diario sube de 10 a 20 preguntas.',
            style: textos.titleMedium,
          ),
          const SizedBox(height: 12),
          Text(
            correo == null
                ? 'Te enviamos un correo con un enlace y un código de 6 '
                      'dígitos.'
                : 'Te enviamos un correo a $correo con un enlace y un código '
                      'de 6 dígitos.',
            style: textos.bodyLarge,
          ),
          const SizedBox(height: 8),
          Text(
            'Abre el enlace o escribe aquí el código. Los dos sirven una sola '
            'vez y vencen en 24 horas, y tienes 5 intentos para escribir el '
            'código.',
            style: textos.bodyMedium,
          ),
          const SizedBox(height: 24),
          TextFormField(
            controller: _codigo,
            decoration: const InputDecoration(
              labelText: 'Código de 6 dígitos',
              border: OutlineInputBorder(),
              errorMaxLines: 2,
              counterText: '',
            ),
            style: textos.headlineSmall?.copyWith(letterSpacing: 8),
            keyboardType: TextInputType.number,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.oneTimeCode],
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            maxLength: PantallaVerificarCorreo.digitosCodigo,
            enabled: !_ocupado && !_sinCodigoVigente,
            forceErrorText: _errorCodigo,
            onChanged: (_) {
              if (_errorCodigo != null) setState(() => _errorCodigo = null);
            },
            onFieldSubmitted: (_) => _ocupado ? null : _verificar(),
            validator: (valor) =>
                (valor ?? '').length == PantallaVerificarCorreo.digitosCodigo
                ? null
                : 'El código tiene 6 dígitos.',
          ),
          if (_error case final mensaje?) ...[
            const SizedBox(height: 12),
            Text(mensaje, style: TextStyle(color: tema.colorScheme.error)),
          ],
          if (_aviso case final mensaje?) ...[
            const SizedBox(height: 12),
            Text(mensaje, style: textos.bodyMedium),
          ],
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _ocupado || _sinCodigoVigente ? null : _verificar,
            child: _verificando
                ? const SizedBox.square(
                    dimension: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Verificar'),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: _ocupado ? null : _reenviar,
            child: _reenviando
                ? const SizedBox.square(
                    dimension: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Reenviar el correo'),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: _ocupado ? null : () => context.go(Rutas.inicio),
            child: const Text('Verificar más tarde'),
          ),
        ],
      ),
    );
  }
}

/// El correo ya está verificado: con el código, el enlace o el
/// administrador.
class _CorreoVerificado extends StatelessWidget {
  const _CorreoVerificado();

  @override
  Widget build(BuildContext context) {
    final textos = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Icon(
          Icons.mark_email_read_outlined,
          size: 64,
          color: Theme.of(context).colorScheme.primary,
        ),
        const SizedBox(height: 16),
        Text(
          '¡Listo! Tu correo está verificado.',
          style: textos.titleLarge,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          'Desde ahora puedes responder 20 preguntas al día.',
          style: textos.bodyLarge,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 24),
        FilledButton(
          onPressed: () => context.go(Rutas.inicio),
          child: const Text('Ir a Inicio'),
        ),
      ],
    );
  }
}
