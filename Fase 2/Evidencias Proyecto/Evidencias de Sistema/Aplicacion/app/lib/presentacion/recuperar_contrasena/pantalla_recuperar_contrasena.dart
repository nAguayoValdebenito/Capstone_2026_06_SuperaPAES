import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/boton_principal.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/comunes/logo_acceso.dart';
import 'package:supera_paes/presentacion/comunes/movimiento.dart';
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
    extends ConsumerState<PantallaRecuperarContrasena>
    with SingleTickerProviderStateMixin {
  final _formulario = GlobalKey<FormState>();
  final _correo = TextEditingController();

  late final AnimationController _confirmacion = AnimationController(
    vsync: this,
  );
  EstadoBoton _estado = EstadoBoton.normal;
  int _intentosFallidos = 0;

  bool get _enviando =>
      _estado == EstadoBoton.cargando || _estado == EstadoBoton.exito;

  /// Correo al que se pidió el enlace; con él se muestra la confirmación.
  String? _enviadoA;

  /// Se pidió otro enlace al mismo correo.
  bool _reenviado = false;

  String? _errorCorreo;
  String? _error;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _confirmacion.duration = duracion(
      context,
      TemaSuperaPaes.confirmacionAcceso,
    );
    if (reducirMovimiento(context) && _confirmacion.isAnimating) {
      _confirmacion
        ..stop(canceled: false)
        ..value = 1;
    }
  }

  @override
  void dispose() {
    _correo.dispose();
    _confirmacion.dispose();
    super.dispose();
  }

  Future<void> _solicitar(String correo, {bool esReenvio = false}) async {
    if (_enviando) return;
    setState(() {
      _estado = EstadoBoton.cargando;
      _error = null;
      _errorCorreo = null;
    });
    try {
      await ref.read(repositorioCuentasProvider).solicitarRecuperacion(correo);
      if (!mounted) return;
      setState(() => _estado = EstadoBoton.exito);
      await _confirmacion.forward(from: 0).orCancel;
      if (!mounted) return;
      setState(() {
        _enviadoA = correo;
        _reenviado = esReenvio;
        _estado = EstadoBoton.normal;
      });
    } on ErrorApi catch (error) {
      if (!mounted) return;
      setState(() {
        _estado = EstadoBoton.error;
        _intentosFallidos++;
        _errorCorreo = error.mensajeDeCampo('correo');
        _error = _errorCorreo == null ? error.mensaje : null;
      });
    } on TickerCanceled {
      // Se dejó la pantalla durante la confirmación; no se actualiza su estado.
    } finally {
      if (mounted && _enviando) setState(() => _estado = EstadoBoton.normal);
    }
  }

  Future<void> _enviar() async {
    if (_enviando) return;
    setState(() => _error = null);
    if (!(_formulario.currentState?.validate() ?? false)) {
      setState(() {
        _estado = EstadoBoton.error;
        _intentosFallidos++;
      });
      return;
    }
    final correo = _correo.text.trim();
    await _solicitar(correo, esReenvio: _enviadoA == correo);
  }

  void _editarCorreo() {
    setState(() {
      _errorCorreo = null;
      _error = null;
      _estado = EstadoBoton.normal;
      if (_enviadoA != null && _correo.text.trim() != _enviadoA) {
        _enviadoA = null;
        _reenviado = false;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final enviadoA = _enviadoA;
    return PantallaFormulario(
      hijos: [
        const EnlaceVolver(texto: 'Iniciar sesión', destino: Rutas.ingreso),
        const Center(child: LogoAcceso()),
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
            onChanged: (_) => _editarCorreo(),
            onFieldSubmitted: (_) => _enviando ? null : _enviar(),
            validator: ValidacionesRegistro.correo,
          ),
        ),
        if (enviadoA != null)
          Semantics(
            liveRegion: true,
            child: Aviso(
              tono: TonoAviso.exito,
              destacado: _reenviado
                  ? 'Te enviamos otro enlace.'
                  : 'Revisa tu correo.',
              texto:
                  'Si $enviadoA está registrado, te llegará un enlace. Sirve '
                  'una sola vez y vence en 1 hora. Si pides otro, el anterior '
                  'deja de servir.',
            ),
          ),
        BotonPrincipal(
          texto: enviadoA == null ? 'Enviar enlace' : 'Reenviar enlace',
          onPressed: _enviar,
          estado: _estado,
          error: _error,
          intentosFallidos: _intentosFallidos,
        ),
      ],
    );
  }
}
