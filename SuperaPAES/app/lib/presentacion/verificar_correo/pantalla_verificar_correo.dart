import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/verificar_correo/campo_codigo.dart';

/// Pantalla Verificar correo (A06, A06b y A06c; HU-05, CU-02, RN-32), según
/// sus bocetos en Figma: pide el código de 6 dígitos del correo, muestra los
/// intentos que quedan y, cuando el código ya no sirve, pide un correo nuevo.
/// «‹ Inicio» deja verificar más tarde: sin verificar, el cupo es de 10
/// preguntas diarias (RN-01).
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
  final _codigo = TextEditingController();

  bool _verificando = false;
  bool _reenviando = false;

  /// El código del correo actual ya no sirve (agotado o vencido): se
  /// desactivan las casillas hasta pedir un correo nuevo (A06c).
  bool _sinCodigoVigente = false;

  /// Código incompleto o incorrecto (A06b), bajo las casillas.
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
    if (_codigo.text.length != PantallaVerificarCorreo.digitosCodigo) {
      setState(() => _errorCodigo = 'El código tiene 6 dígitos.');
      return;
    }

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
    final verificado = estudiante?.correoVerificado ?? false;
    return PantallaFormulario(
      hijos: [
        const EnlaceVolver(texto: 'Inicio', destino: Rutas.inicio),
        if (verificado)
          const _CorreoVerificado()
        else
          ..._formularioCodigo(estudiante?.correo),
      ],
    );
  }

  List<Widget> _formularioCodigo(String? correo) {
    final estiloAyuda = TemaSuperaPaes.pequeno.copyWith(
      color: TemaSuperaPaes.textoSecundario,
    );
    return [
      Encabezado(
        titulo: 'Verifica tu correo',
        bajadaRica: TextSpan(
          children: [
            const TextSpan(
              text: 'Enviamos un enlace y un código de 6 dígitos a ',
            ),
            TextSpan(
              text: correo ?? 'tu correo',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            const TextSpan(
              text: '. Abre el enlace desde tu teléfono o escribe el código.',
            ),
          ],
        ),
      ),
      if (_sinCodigoVigente && _error != null)
        Aviso(tono: TonoAviso.error, texto: _error!)
      else
        const _CupoAntesYDespues(),
      CampoCodigo(
        controller: _codigo,
        enabled: !_ocupado && !_sinCodigoVigente,
        error: _errorCodigo,
        onChanged: (_) {
          if (_errorCodigo != null) setState(() => _errorCodigo = null);
        },
        onSubmitted: (_) => _ocupado ? null : _verificar(),
      ),
      if (!_sinCodigoVigente)
        if (_error case final mensaje?)
          Aviso(tono: TonoAviso.error, texto: mensaje),
      if (_aviso case final mensaje?)
        Aviso(tono: TonoAviso.exito, texto: mensaje),
      if (_sinCodigoVigente) ...[
        FilledButton(
          onPressed: _ocupado ? null : _reenviar,
          child: _reenviando
              ? const CargandoEnBoton()
              : const Text('Enviar un correo nuevo'),
        ),
        Text(
          'El correo nuevo trae otro enlace y otro código, que también '
          'vencen en 24 horas.',
          style: estiloAyuda,
        ),
      ] else ...[
        FilledButton(
          onPressed: _ocupado ? null : _verificar,
          child: _verificando
              ? const CargandoEnBoton()
              : const Text('Verificar'),
        ),
        Text(
          'El enlace y el código sirven una sola vez y vencen en 24 horas. '
          'Tienes 5 intentos para escribir el código. Si te invitaron, quien '
          'te invitó gana 5 preguntas extra cuando verificas.',
          style: estiloAyuda,
        ),
        BotonTexto(
          onPressed: _ocupado ? null : _reenviar,
          child: _reenviando
              ? const CargandoEnBoton()
              : const Text('Reenviar correo'),
        ),
      ],
    ];
  }
}

/// «Hoy 10 preguntas» y «Al verificar 20 preguntas» (RN-01).
class _CupoAntesYDespues extends StatelessWidget {
  const _CupoAntesYDespues();

  @override
  Widget build(BuildContext context) {
    Widget recuadro(String titulo, String valor, Color fondo, Color texto) {
      return Expanded(
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: fondo,
            borderRadius: BorderRadius.circular(TemaSuperaPaes.radioTarjeta),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                titulo,
                style: TemaSuperaPaes.pequeno.copyWith(color: texto),
              ),
              const SizedBox(height: 2),
              Text(valor, style: TemaSuperaPaes.h2.copyWith(color: texto)),
            ],
          ),
        ),
      );
    }

    return Row(
      children: [
        recuadro(
          'Hoy',
          '10 preguntas',
          TemaSuperaPaes.neutroSuave,
          TemaSuperaPaes.texto,
        ),
        const SizedBox(width: 10),
        recuadro(
          'Al verificar',
          '20 preguntas',
          TemaSuperaPaes.exitoSuave,
          TemaSuperaPaes.exitoTexto,
        ),
      ],
    );
  }
}

/// El correo ya está verificado: con el código, el enlace o el
/// administrador.
class _CorreoVerificado extends StatelessWidget {
  const _CorreoVerificado();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Encabezado(
          titulo: '¡Listo! Tu correo está verificado.',
          bajada: 'Desde ahora puedes responder 20 preguntas al día.',
        ),
        const SizedBox(height: 16),
        const Aviso(
          tono: TonoAviso.exito,
          texto: 'Tu cupo diario subió de 10 a 20 preguntas.',
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: () => context.go(Rutas.inicio),
          child: const Text('Ir a Inicio'),
        ),
      ],
    );
  }
}
