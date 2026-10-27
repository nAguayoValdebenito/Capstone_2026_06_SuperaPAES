import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/crear_cuenta/validaciones_registro.dart';

/// Pantalla Iniciar sesión (A03; HU-02, CU-03), según su boceto en Figma,
/// con el logo (DAS 7.5). Al entrar, la sesión queda guardada y la app pasa
/// a Inicio. «¿Olvidaste tu contraseña?» lleva a Recuperar contraseña (A04,
/// HU-06.2).
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
    return PantallaFormulario(
      hijos: [
        const SizedBox(height: 24),
        Center(
          child: Image.asset(
            PantallaIngreso.logo,
            // Proporción del logo (991 × 823): reserva su lugar antes de
            // cargar.
            width: 144,
            height: 120,
            semanticLabel: Textos.nombreApp,
          ),
        ),
        // En el boceto, el logo es el título; la bajada va centrada.
        Semantics(
          header: true,
          label: 'Iniciar sesión',
          child: Text(
            'Ingresa para seguir practicando.',
            textAlign: TextAlign.center,
            style: TemaSuperaPaes.cuerpo.copyWith(
              color: TemaSuperaPaes.textoSecundario,
            ),
          ),
        ),
        Form(
          key: _formulario,
          child: AutofillGroup(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                CampoTexto(
                  etiqueta: 'Correo',
                  controller: _correo,
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
                CampoContrasena(
                  etiqueta: 'Contraseña',
                  controller: _contrasena,
                  textInputAction: TextInputAction.done,
                  autofillHints: const [AutofillHints.password],
                  enabled: !_enviando,
                  forceErrorText: _erroresServidor['contrasena'],
                  onChanged: (_) => _limpiarErrores('contrasena'),
                  onFieldSubmitted: (_) => _enviando ? null : _ingresar(),
                  validator: (valor) =>
                      (valor ?? '').isEmpty ? 'Ingresa tu contraseña.' : null,
                ),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: _enviando
                        ? null
                        : () => context.push(Rutas.recuperarContrasena),
                    child: const Text('¿Olvidaste tu contraseña?'),
                  ),
                ),
                if (_errorGeneral case final mensaje?) ...[
                  Aviso(tono: TonoAviso.error, texto: mensaje),
                  const SizedBox(height: 16),
                ],
                FilledButton(
                  onPressed: _enviando ? null : _ingresar,
                  child: _enviando
                      ? const CargandoEnBoton()
                      : const Text('Entrar'),
                ),
              ],
            ),
          ),
        ),
        PieConEnlace(
          pregunta: '¿No tienes cuenta?',
          enlace: 'Crea una',
          onPressed: _enviando ? null : () => context.push(Rutas.crearCuenta),
        ),
      ],
    );
  }
}
