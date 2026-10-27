import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/datos_registro.dart';
import 'package:supera_paes/dominio/entidades/documento_legal.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/crear_cuenta/validaciones_registro.dart';

/// Pantalla Crear cuenta (A01 y A01b; HU-01, CU-01): nombre, correo,
/// contraseña con sus requisitos (RN-31), código de invitación opcional
/// (RN-33) y aceptación de los términos y la política vigentes con la
/// declaración de tener 14 años o más (RN-18). Sigue su boceto en Figma.
class PantallaCrearCuenta extends ConsumerStatefulWidget {
  const PantallaCrearCuenta({super.key});

  @override
  ConsumerState<PantallaCrearCuenta> createState() =>
      _PantallaCrearCuentaState();
}

/// Campos del cuerpo del registro, tal como los nombra la API en
/// `detalles[].ruta`.
abstract final class _Campo {
  static const String nombre = 'nombre';
  static const String correo = 'correo';
  static const String contrasena = 'contrasena';
  static const String codigoInvitacion = 'codigoInvitacion';
  static const String documentosAceptados = 'documentosAceptados';
  static const String declaraEdad = 'declaraTenerCatorceAnios';
}

class _PantallaCrearCuentaState extends ConsumerState<PantallaCrearCuenta> {
  final _formulario = GlobalKey<FormState>();
  final _nombre = TextEditingController();
  final _correo = TextEditingController();
  final _contrasena = TextEditingController();
  final _codigo = TextEditingController();

  bool _acepta = false;
  bool _enviando = false;

  /// Mostrar el aviso de la casilla solo después de intentar crear la cuenta.
  bool _intentoEnviar = false;

  /// Errores que devolvió la API, por campo. Se borran al editar el campo.
  Map<String, String> _erroresServidor = const {};

  /// Error que no corresponde a un campo (sin conexión, demasiados intentos).
  String? _errorGeneral;

  @override
  void dispose() {
    _nombre.dispose();
    _correo.dispose();
    _contrasena.dispose();
    _codigo.dispose();
    super.dispose();
  }

  void _limpiarErrorServidor(String campo) {
    if (!_erroresServidor.containsKey(campo)) return;
    setState(() {
      _erroresServidor = Map.of(_erroresServidor)..remove(campo);
    });
  }

  Future<void> _crearCuenta(List<DocumentoLegal> documentos) async {
    setState(() {
      _intentoEnviar = true;
      _errorGeneral = null;
    });
    final valido = _formulario.currentState?.validate() ?? false;
    if (!valido || !_acepta) return;

    final codigo = ValidacionesRegistro.normalizarCodigo(_codigo.text);
    final datos = DatosRegistro(
      nombre: ValidacionesRegistro.normalizarNombre(_nombre.text),
      correo: _correo.text.trim(),
      contrasena: _contrasena.text,
      documentosAceptados: [for (final documento in documentos) documento.id],
      codigoInvitacion: codigo.isEmpty ? null : codigo,
    );

    setState(() => _enviando = true);
    try {
      final sesion = await ref
          .read(repositorioCuentasProvider)
          .registrar(datos);
      await ref.read(sesionProvider.notifier).abrir(sesion);
      if (!mounted) return;
      context.go(Rutas.verificarCorreo);
    } on ErrorApi catch (error) {
      if (!mounted) return;
      _mostrarError(error);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  void _mostrarError(ErrorApi error) {
    final porCampo = <String, String>{
      for (final problema in error.problemas) problema.ruta: problema.mensaje,
    };
    // CU-01 5.a: el correo ya tiene cuenta.
    if (error.codigo == 'CONFLICTO') porCampo[_Campo.correo] = error.mensaje;
    // La versión vigente cambió mientras se llenaba el formulario: se
    // vuelven a pedir los documentos para aceptar la nueva.
    final documentosCambiaron = porCampo.containsKey(
      _Campo.documentosAceptados,
    );
    if (documentosCambiaron) ref.invalidate(documentosVigentesProvider);
    setState(() {
      if (documentosCambiaron) _acepta = false;
      _erroresServidor = porCampo;
      _errorGeneral = porCampo.isEmpty ? error.mensaje : null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final documentos = ref.watch(documentosVigentesProvider);
    return PantallaFormulario(
      separacion: 14,
      hijos: [
        const Encabezado(
          titulo: 'Crea tu cuenta',
          bajada: 'Practica la PAES con preguntas revisadas por docentes.',
        ),
        documentos.when(
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(vertical: 32),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (error, _) => _ErrorDocumentos(
            mensaje: error is ErrorApi
                ? error.mensaje
                : 'No se pudieron cargar los términos y la política de '
                      'privacidad.',
            alReintentar: () => ref.invalidate(documentosVigentesProvider),
          ),
          data: _formularioRegistro,
        ),
        PieConEnlace(
          pregunta: '¿Ya tienes cuenta?',
          enlace: 'Inicia sesión',
          onPressed: _enviando
              ? null
              : () => context.canPop()
                    ? context.pop()
                    : context.go(Rutas.ingreso),
        ),
      ],
    );
  }

  Widget _formularioRegistro(List<DocumentoLegal> documentos) {
    final errorAceptacion =
        _erroresServidor[_Campo.documentosAceptados] ??
        _erroresServidor[_Campo.declaraEdad] ??
        (_intentoEnviar && !_acepta
            ? 'Debes aceptar los términos y la política de privacidad para '
                  'crear tu cuenta.'
            : null);

    return Form(
      key: _formulario,
      child: AutofillGroup(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            CampoTexto(
              etiqueta: 'Nombre',
              controller: _nombre,
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.name],
              enabled: !_enviando,
              forceErrorText: _erroresServidor[_Campo.nombre],
              onChanged: (_) => _limpiarErrorServidor(_Campo.nombre),
              validator: ValidacionesRegistro.nombre,
            ),
            const SizedBox(height: 14),
            CampoTexto(
              etiqueta: 'Correo',
              controller: _correo,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autocorrect: false,
              autofillHints: const [AutofillHints.email],
              enabled: !_enviando,
              forceErrorText: _erroresServidor[_Campo.correo],
              onChanged: (_) => _limpiarErrorServidor(_Campo.correo),
              validator: ValidacionesRegistro.correo,
            ),
            const SizedBox(height: 14),
            CampoContrasena(
              etiqueta: 'Contraseña',
              controller: _contrasena,
              ayuda: ValidacionesRegistro.requisitosContrasena,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.newPassword],
              enabled: !_enviando,
              forceErrorText: _erroresServidor[_Campo.contrasena],
              onChanged: (_) => _limpiarErrorServidor(_Campo.contrasena),
              validator: (valor) =>
                  ValidacionesRegistro.contrasena(valor, _correo.text),
            ),
            const SizedBox(height: 14),
            CampoTexto(
              etiqueta: 'Código de invitación (opcional)',
              controller: _codigo,
              pista: 'Si alguien te invitó, escríbelo aquí',
              ayuda: 'Son 6 letras y números, por ejemplo K7P2QX.',
              textCapitalization: TextCapitalization.characters,
              textInputAction: TextInputAction.done,
              autocorrect: false,
              inputFormatters: [
                LengthLimitingTextInputFormatter(
                  ValidacionesRegistro.largoCodigoInvitacion,
                ),
              ],
              enabled: !_enviando,
              forceErrorText: _erroresServidor[_Campo.codigoInvitacion],
              onChanged: (_) => _limpiarErrorServidor(_Campo.codigoInvitacion),
              validator: ValidacionesRegistro.codigoInvitacion,
            ),
            const SizedBox(height: 14),
            _CasillaAceptacion(
              aceptada: _acepta,
              documentos: documentos,
              error: errorAceptacion,
              onChanged: _enviando
                  ? null
                  : (valor) => setState(() {
                      _acepta = valor;
                      _erroresServidor = Map.of(_erroresServidor)
                        ..remove(_Campo.documentosAceptados)
                        ..remove(_Campo.declaraEdad);
                    }),
            ),
            const SizedBox(height: 14),
            Text(
              'Los menores de 14 años no pueden registrarse en esta versión.',
              style: TemaSuperaPaes.pequeno.copyWith(
                color: TemaSuperaPaes.textoSecundario,
              ),
            ),
            if (_errorGeneral case final mensaje?) ...[
              const SizedBox(height: 14),
              Aviso(tono: TonoAviso.error, texto: mensaje),
            ],
            const SizedBox(height: 14),
            FilledButton(
              onPressed: _enviando ? null : () => _crearCuenta(documentos),
              child: _enviando
                  ? const CargandoEnBoton()
                  : const Text('Crear cuenta'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Casilla «Acepto los Términos y condiciones y la Política de privacidad, y
/// declaro que tengo 14 años o más» (Casilla del sistema de diseño). Los
/// nombres de los documentos, en negrita, abren su texto vigente (A02 y
/// A02b).
class _CasillaAceptacion extends StatefulWidget {
  const _CasillaAceptacion({
    required this.aceptada,
    required this.documentos,
    required this.onChanged,
    this.error,
  });

  final bool aceptada;
  final List<DocumentoLegal> documentos;
  final ValueChanged<bool>? onChanged;
  final String? error;

  @override
  State<_CasillaAceptacion> createState() => _CasillaAceptacionState();
}

class _CasillaAceptacionState extends State<_CasillaAceptacion> {
  late final _abrirTerminos = TapGestureRecognizer()
    ..onTap = () => context.push(Rutas.terminos);
  late final _abrirPrivacidad = TapGestureRecognizer()
    ..onTap = () => context.push(Rutas.privacidad);

  @override
  void dispose() {
    _abrirTerminos.dispose();
    _abrirPrivacidad.dispose();
    super.dispose();
  }

  String _nombre(TipoDocumentoLegal tipo, String porDefecto) =>
      widget.documentos.where((d) => d.tipo == tipo).firstOrNull?.nombre ??
      porDefecto;

  @override
  Widget build(BuildContext context) {
    const negrita = TextStyle(fontWeight: FontWeight.w700);
    final onChanged = widget.onChanged;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox.square(
              dimension: 22,
              child: Checkbox(
                value: widget.aceptada,
                onChanged: onChanged == null
                    ? null
                    : (valor) => onChanged(valor ?? false),
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                visualDensity: VisualDensity.compact,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: GestureDetector(
                onTap: onChanged == null
                    ? null
                    : () => onChanged(!widget.aceptada),
                child: Text.rich(
                  TextSpan(
                    children: [
                      const TextSpan(text: 'Acepto los '),
                      TextSpan(
                        text: _nombre(
                          TipoDocumentoLegal.terminos,
                          'Términos y condiciones',
                        ),
                        style: negrita,
                        recognizer: _abrirTerminos,
                      ),
                      const TextSpan(text: ' y la '),
                      TextSpan(
                        text: _nombre(
                          TipoDocumentoLegal.privacidad,
                          'Política de privacidad',
                        ),
                        style: negrita,
                        recognizer: _abrirPrivacidad,
                      ),
                      const TextSpan(
                        text: ', y declaro que tengo 14 años o más.',
                      ),
                    ],
                  ),
                  style: TemaSuperaPaes.pequeno,
                ),
              ),
            ),
          ],
        ),
        if (widget.error case final mensaje?) ...[
          const SizedBox(height: 8),
          Text(
            mensaje,
            style: TemaSuperaPaes.pequeno.copyWith(color: TemaSuperaPaes.error),
          ),
        ],
      ],
    );
  }
}

class _ErrorDocumentos extends StatelessWidget {
  const _ErrorDocumentos({required this.mensaje, required this.alReintentar});

  final String mensaje;
  final VoidCallback alReintentar;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Aviso(tono: TonoAviso.error, texto: mensaje),
        const SizedBox(height: 12),
        OutlinedButton(
          onPressed: alReintentar,
          child: const Text('Reintentar'),
        ),
      ],
    );
  }
}
