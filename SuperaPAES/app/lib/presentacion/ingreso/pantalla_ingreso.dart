import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/comunes/pantalla_base.dart';
import 'package:supera_paes/presentacion/crear_cuenta/validaciones_registro.dart';

/// Pantalla Iniciar sesión (A03; HU-02, CU-03), con el logo (DAS 7.5). Al
/// entrar, la sesión queda guardada y la app pasa a Inicio. El enlace
/// «¿Olvidaste tu contraseña?» llega con la recuperación (HU-06.2).
class PantallaIngreso extends ConsumerStatefulWidget {
  const PantallaIngreso({super.key});

  /// Logo oficial (Figura 63 del DAS), empaquetado con la app.
  static const String logo = 'assets/imagenes/logo_supera_paes.png';

  @override
  ConsumerState<PantallaIngreso> createState() => _PantallaIngresoState();
}

class _PantallaIngresoState extends ConsumerState<PantallaIngreso> {
  final _formulario = GlobalKey<FormState>();
  final _correo = TextEditingController();
  final _contrasena = TextEditingController();

  bool _contrasenaVisible = false;
  bool _enviando = false;

  /// Errores de la API por campo (`VALIDACION`).
  Map<String, String> _erroresServidor = const {};

  /// Credenciales incorrectas, demasiados intentos o sin conexión. La API
  /// usa el mismo mensaje para un correo sin cuenta y una contraseña
  /// incorrecta, así que no se marca un campo.
  String? _errorGeneral;

  @override
  void dispose() {
    _correo.dispose();
    _contrasena.dispose();
    super.dispose();
  }

  void _limpiarErrores(String campo) {
    if (_errorGeneral == null && !_erroresServidor.containsKey(campo)) return;
    setState(() {
      _errorGeneral = null;
      _erroresServidor = Map.of(_erroresServidor)..remove(campo);
    });
  }

  Future<void> _ingresar() async {
    setState(() => _errorGeneral = null);
    if (!(_formulario.currentState?.validate() ?? false)) return;

    setState(() => _enviando = true);
    try {
      final sesion = await ref
          .read(repositorioCuentasProvider)
          .ingresar(
            correo: _correo.text.trim(),
            contrasena: _contrasena.text,
            dispositivo: nombreDispositivo(),
          );
      await ref.read(sesionProvider.notifier).abrir(sesion);
      if (!mounted) return;
      context.go(Rutas.inicio);
    } on ErrorApi catch (error) {
      if (!mounted) return;
      setState(() {
        _erroresServidor = {
          for (final problema in error.problemas)
            problema.ruta: problema.mensaje,
        };
        _errorGeneral = _erroresServidor.isEmpty ? error.mensaje : null;
      });
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tema = Theme.of(context);
    return PantallaBase(
      hijos: [
        Center(
          child: Image.asset(
            PantallaIngreso.logo,
            // Proporción del logo (991 × 823): reserva su lugar antes de
            // cargar.
            width: 180,
            height: 150,
            semanticLabel: Textos.nombreApp,
          ),
        ),
        const SizedBox(height: 24),
        Text(
          'Ingresa con tu correo y contraseña para seguir practicando.',
          style: tema.textTheme.bodyLarge,
        ),
        const SizedBox(height: 16),
        Form(
          key: _formulario,
          child: AutofillGroup(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextFormField(
                  controller: _correo,
                  decoration: const InputDecoration(
                    labelText: 'Correo',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  autocorrect: false,
                  autofillHints: const [AutofillHints.email],
                  enabled: !_enviando,
                  forceErrorText: _erroresServidor['correo'],
                  onChanged: (_) => _limpiarErrores('correo'),
                  validator: ValidacionesRegistro.correo,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _contrasena,
                  decoration: InputDecoration(
                    labelText: 'Contraseña',
                    border: const OutlineInputBorder(),
                    errorMaxLines: 2,
                    suffixIcon: IconButton(
                      tooltip: _contrasenaVisible
                          ? 'Ocultar contraseña'
                          : 'Mostrar contraseña',
                      icon: Icon(
                        _contrasenaVisible
                            ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined,
                      ),
                      onPressed: () => setState(
                        () => _contrasenaVisible = !_contrasenaVisible,
                      ),
                    ),
                  ),
                  obscureText: !_contrasenaVisible,
                  textInputAction: TextInputAction.done,
                  autocorrect: false,
                  enableSuggestions: false,
                  autofillHints: const [AutofillHints.password],
                  enabled: !_enviando,
                  forceErrorText: _erroresServidor['contrasena'],
                  onChanged: (_) => _limpiarErrores('contrasena'),
                  onFieldSubmitted: (_) => _enviando ? null : _ingresar(),
                  validator: (valor) =>
                      (valor ?? '').isEmpty ? 'Ingresa tu contraseña.' : null,
                ),
                if (_errorGeneral case final mensaje?) ...[
                  const SizedBox(height: 12),
                  Text(
                    mensaje,
                    style: TextStyle(color: tema.colorScheme.error),
                  ),
                ],
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _enviando ? null : _ingresar,
                  child: _enviando
                      ? const SizedBox.square(
                          dimension: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Ingresar'),
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: _enviando
                      ? null
                      : () => context.push(Rutas.crearCuenta),
                  child: const Text('¿No tienes cuenta? Crea una'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
