import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/boton_principal.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/comunes/logo_acceso.dart';
import 'package:supera_paes/presentacion/comunes/movimiento.dart';
import 'package:supera_paes/presentacion/crear_cuenta/validaciones_registro.dart';
import 'package:supera_paes/presentacion/ingreso/accesos_demo.dart';

/// Pantalla Iniciar sesión (A03; HU-02, CU-03), según su boceto en Figma,
/// con el logo (DAS 7.5). Al entrar, la sesión queda guardada y la app pasa
/// a Inicio. «¿Olvidaste tu contraseña?» lleva a Recuperar contraseña (A04,
/// HU-06.2).
class PantallaIngreso extends ConsumerStatefulWidget {
  const PantallaIngreso({super.key});

  /// Logo oficial (Figura 63 del DAS), empaquetado con la app con fondo
  /// transparente.
  static const String logo = LogoAcceso.recurso;

  static const String avisoSesionVencida =
      'Tu sesión terminó. Vuelve a entrar para seguir.';

  @override
  ConsumerState<PantallaIngreso> createState() => _PantallaIngresoState();
}

class _PantallaIngresoState extends ConsumerState<PantallaIngreso>
    with SingleTickerProviderStateMixin {
  final _formulario = GlobalKey<FormState>();
  final _correo = TextEditingController();
  final _contrasena = TextEditingController();

  late final AnimationController _confirmacion = AnimationController(
    vsync: this,
  );
  EstadoBoton _estado = EstadoBoton.normal;
  int _intentosFallidos = 0;

  bool get _enviando =>
      _estado == EstadoBoton.cargando || _estado == EstadoBoton.exito;

  /// Errores de la API por campo (`VALIDACION`).
  Map<String, String> _erroresServidor = const {};

  /// Credenciales incorrectas, demasiados intentos o sin conexión. La API
  /// usa el mismo mensaje para un correo sin cuenta y una contraseña
  /// incorrecta, así que no se marca un campo.
  String? _errorGeneral;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _confirmacion.duration = duracion(
      context,
      TemaSuperaPaes.confirmacionAcceso,
    );
    if (reducirMovimiento(context) && _confirmacion.isAnimating) {
      // Termina la espera sin cancelarla: todavía debe guardarse la sesión.
      _confirmacion
        ..stop(canceled: false)
        ..value = 1;
    }
  }

  @override
  void dispose() {
    _correo.dispose();
    _contrasena.dispose();
    _confirmacion.dispose();
    super.dispose();
  }

  void _limpiarErrores(String campo) {
    if (_estado != EstadoBoton.error &&
        _errorGeneral == null &&
        !_erroresServidor.containsKey(campo)) {
      return;
    }
    setState(() {
      _estado = EstadoBoton.normal;
      _errorGeneral = null;
      _erroresServidor = Map.of(_erroresServidor)..remove(campo);
    });
  }

  /// Solo en desarrollo: llena el formulario con la cuenta y entra.
  void _entrarCon(AccesoDemo acceso) {
    if (_enviando) return;
    _correo.text = acceso.correo;
    _contrasena.text = claveDemo;
    unawaited(_ingresar());
  }

  Future<void> _ingresar() async {
    if (_enviando) return;
    setState(() => _errorGeneral = null);
    if (!(_formulario.currentState?.validate() ?? false)) {
      setState(() {
        _estado = EstadoBoton.error;
        _intentosFallidos++;
      });
      return;
    }

    setState(() => _estado = EstadoBoton.cargando);
    var completado = false;
    try {
      final sesion = await ref
          .read(repositorioCuentasProvider)
          .ingresar(
            correo: _correo.text.trim(),
            contrasena: _contrasena.text,
            dispositivo: nombreDispositivo(),
          );
      if (!mounted) return;
      setState(() => _estado = EstadoBoton.exito);
      await _confirmacion.forward(from: 0).orCancel;
      if (!mounted) return;
      await ref.read(sesionProvider.notifier).abrir(sesion);
      if (!mounted) return;
      completado = true;
      context.go(Rutas.inicio);
    } on ErrorApi catch (error) {
      if (!mounted) return;
      setState(() {
        _estado = EstadoBoton.error;
        _intentosFallidos++;
        _erroresServidor = {
          for (final problema in error.problemas)
            problema.ruta: problema.mensaje,
        };
        _errorGeneral = _erroresServidor.isEmpty ? error.mensaje : null;
      });
    } on TickerCanceled {
      // Se dejó la pantalla durante la confirmación; no se abre otra sesión.
    } finally {
      if (mounted && !completado && _enviando) {
        setState(() => _estado = EstadoBoton.normal);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return PantallaFormulario(
      hijos: [
        const SizedBox(height: TemaSuperaPaes.espacio24),
        const Center(child: LogoAcceso()),
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
        if (ref.watch(avisoSesionVencidaProvider))
          Semantics(
            liveRegion: true,
            child: const Aviso(
              tono: TonoAviso.info,
              texto: PantallaIngreso.avisoSesionVencida,
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
                BotonPrincipal(
                  texto: 'Entrar',
                  onPressed: _ingresar,
                  estado: _estado,
                  error: _errorGeneral,
                  intentosFallidos: _intentosFallidos,
                ),
                if (kDebugMode)
                  AccesosDemo(onElegir: _enviando ? null : _entrarCon),
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
