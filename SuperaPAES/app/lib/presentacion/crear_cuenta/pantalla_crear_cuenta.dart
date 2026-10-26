import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/datos_registro.dart';
import 'package:supera_paes/dominio/entidades/documento_legal.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/comunes/pantalla_base.dart';
import 'package:supera_paes/presentacion/crear_cuenta/validaciones_registro.dart';

/// Pantalla Crear cuenta (A01 y A01b; HU-01, CU-01): nombre, correo,
/// contraseña con sus requisitos (RN-31), código de invitación opcional
/// (RN-33) y aceptación de los términos y la política vigentes con la
/// declaración de tener 14 años o más (RN-18).
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
  bool _contrasenaVisible = false;
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
    return PantallaBase(
      hijos: [
        Text(
          'Crea tu cuenta para empezar a practicar.',
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        const SizedBox(height: 16),
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
      ],
    );
  }

  Widget _formularioRegistro(List<DocumentoLegal> documentos) {
    final tema = Theme.of(context);
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
            TextFormField(
              controller: _nombre,
              decoration: const InputDecoration(
                labelText: 'Nombre',
                border: OutlineInputBorder(),
              ),
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.name],
              enabled: !_enviando,
              forceErrorText: _erroresServidor[_Campo.nombre],
              onChanged: (_) => _limpiarErrorServidor(_Campo.nombre),
              validator: ValidacionesRegistro.nombre,
            ),
            const SizedBox(height: 16),
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
              forceErrorText: _erroresServidor[_Campo.correo],
              onChanged: (_) => _limpiarErrorServidor(_Campo.correo),
              validator: ValidacionesRegistro.correo,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _contrasena,
              decoration: InputDecoration(
                labelText: 'Contraseña',
                border: const OutlineInputBorder(),
                helperText: ValidacionesRegistro.requisitosContrasena,
                helperMaxLines: 3,
                errorMaxLines: 3,
                suffixIcon: IconButton(
                  tooltip: _contrasenaVisible
                      ? 'Ocultar contraseña'
                      : 'Mostrar contraseña',
                  icon: Icon(
                    _contrasenaVisible
                        ? Icons.visibility_off_outlined
                        : Icons.visibility_outlined,
                  ),
                  onPressed: () =>
                      setState(() => _contrasenaVisible = !_contrasenaVisible),
                ),
              ),
              obscureText: !_contrasenaVisible,
              textInputAction: TextInputAction.next,
              autocorrect: false,
              enableSuggestions: false,
              autofillHints: const [AutofillHints.newPassword],
              enabled: !_enviando,
              forceErrorText: _erroresServidor[_Campo.contrasena],
              onChanged: (_) => _limpiarErrorServidor(_Campo.contrasena),
              validator: (valor) =>
                  ValidacionesRegistro.contrasena(valor, _correo.text),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _codigo,
              decoration: const InputDecoration(
                labelText: 'Código de invitación (opcional)',
                border: OutlineInputBorder(),
                helperText: 'Si alguien te invitó, escribe su código.',
                errorMaxLines: 2,
              ),
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
            const SizedBox(height: 16),
            CheckboxListTile(
              value: _acepta,
              onChanged: _enviando
                  ? null
                  : (valor) => setState(() {
                      _acepta = valor ?? false;
                      _erroresServidor = Map.of(_erroresServidor)
                        ..remove(_Campo.documentosAceptados)
                        ..remove(_Campo.declaraEdad);
                    }),
              controlAffinity: ListTileControlAffinity.leading,
              contentPadding: EdgeInsets.zero,
              title: Text(_textoAceptacion(documentos)),
              subtitle: errorAceptacion == null
                  ? null
                  : Text(
                      errorAceptacion,
                      style: TextStyle(color: tema.colorScheme.error),
                    ),
            ),
            Wrap(
              spacing: 8,
              children: [
                TextButton(
                  onPressed: () => context.push(Rutas.terminos),
                  child: const Text('Leer los términos'),
                ),
                TextButton(
                  onPressed: () => context.push(Rutas.privacidad),
                  child: const Text('Leer la política de privacidad'),
                ),
              ],
            ),
            if (_errorGeneral case final mensaje?) ...[
              const SizedBox(height: 8),
              Text(mensaje, style: TextStyle(color: tema.colorScheme.error)),
            ],
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _enviando ? null : () => _crearCuenta(documentos),
              child: _enviando
                  ? const SizedBox.square(
                      dimension: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Crear cuenta'),
            ),
          ],
        ),
      ),
    );
  }
}

/// «Acepto los Términos y condiciones (versión 1.0) y la Política de
/// privacidad (versión 1.0), y declaro tener 14 años o más.»
String _textoAceptacion(List<DocumentoLegal> documentos) {
  final partes = [
    for (final documento in documentos)
      '${switch (documento.tipo) {
        TipoDocumentoLegal.terminos => 'los',
        TipoDocumentoLegal.privacidad => 'la',
      }} ${documento.nombre} (versión ${documento.version})',
  ];
  return 'Acepto ${partes.join(' y ')}, y declaro tener 14 años o más.';
}

class _ErrorDocumentos extends StatelessWidget {
  const _ErrorDocumentos({required this.mensaje, required this.alReintentar});

  final String mensaje;
  final VoidCallback alReintentar;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          mensaje,
          style: TextStyle(color: Theme.of(context).colorScheme.error),
        ),
        const SizedBox(height: 8),
        OutlinedButton(
          onPressed: alReintentar,
          child: const Text('Reintentar'),
        ),
      ],
    );
  }
}
