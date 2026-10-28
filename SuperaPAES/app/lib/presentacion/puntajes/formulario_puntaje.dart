import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/nucleo/errores.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/puntajes/estado_puntajes.dart';

/// La primera admisión con la PAES fue la de 2023.
const int primeraAdmisionPaes = 2023;

/// Carga de un puntaje en A41: prueba, año de admisión y puntaje de 100 a
/// 1.000 (RN-16). Las mismas reglas las revisa el servidor; sus rechazos se
/// muestran en el campo que corresponde.
class FormularioPuntaje extends ConsumerStatefulWidget {
  const FormularioPuntaje({
    required this.pruebas,
    required this.pruebaInicial,
    super.key,
  });

  final List<PruebaPerfil> pruebas;
  final int pruebaInicial;

  @override
  ConsumerState<FormularioPuntaje> createState() => _FormularioPuntajeState();
}

class _FormularioPuntajeState extends ConsumerState<FormularioPuntaje> {
  final _formulario = GlobalKey<FormState>();
  late int _pruebaId = widget.pruebaInicial;
  final _anio = TextEditingController(text: '${DateTime.now().year}');
  final _puntaje = TextEditingController();
  ErrorApi? _error;
  bool _guardando = false;

  @override
  void dispose() {
    _anio.dispose();
    _puntaje.dispose();
    super.dispose();
  }

  String? _validarAnio(String? texto) {
    final anio = int.tryParse(texto ?? '');
    if (anio == null || anio < primeraAdmisionPaes) {
      return 'Ingresa un año de admisión desde 2023.';
    }
    if (anio > DateTime.now().year + 1) {
      return 'Ese año de admisión todavía no llega.';
    }
    return null;
  }

  static String? _validarPuntaje(String? texto) {
    final puntaje = int.tryParse(texto ?? '');
    return puntaje == null || puntaje < 100 || puntaje > 1000
        ? 'El puntaje va de 100 a 1.000.'
        : null;
  }

  Future<void> _guardar() async {
    setState(() => _error = null);
    if (!(_formulario.currentState?.validate() ?? false)) return;
    setState(() => _guardando = true);
    try {
      await ref.read(puntajesProvider.notifier).guardar((
        pruebaId: _pruebaId,
        anioAdmision: int.parse(_anio.text),
        puntaje: int.parse(_puntaje.text),
      ));
      _puntaje.clear();
    } on ErrorApi catch (error) {
      if (mounted) setState(() => _error = error);
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final error = _error;
    final soloNumeros = [FilteringTextInputFormatter.digitsOnly];
    return Form(
      key: _formulario,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CampoConEtiqueta(
            etiqueta: 'Prueba',
            child: DropdownButtonFormField<int>(
              initialValue: _pruebaId,
              isExpanded: true,
              items: [
                for (final prueba in widget.pruebas)
                  DropdownMenuItem(
                    value: prueba.id,
                    child: Text(prueba.nombreEnInicio),
                  ),
              ],
              onChanged: (id) => setState(() => _pruebaId = id ?? _pruebaId),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: CampoTexto(
                  etiqueta: 'Año',
                  controller: _anio,
                  keyboardType: TextInputType.number,
                  inputFormatters: soloNumeros,
                  validator: _validarAnio,
                  forceErrorText: error?.mensajeDeCampo('anioAdmision'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: CampoTexto(
                  etiqueta: 'Puntaje (100 a 1.000)',
                  controller: _puntaje,
                  keyboardType: TextInputType.number,
                  inputFormatters: soloNumeros,
                  validator: _validarPuntaje,
                  forceErrorText: error?.mensajeDeCampo('puntaje'),
                  onFieldSubmitted: (_) => _guardar(),
                ),
              ),
            ],
          ),
          // Lo que no es del año ni del puntaje (como una prueba que ya no
          // existe o SIN_PERMISO) va sobre el botón.
          if (error != null &&
              error.mensajeDeCampo('anioAdmision') == null &&
              error.mensajeDeCampo('puntaje') == null) ...[
            const SizedBox(height: 14),
            Aviso(
              tono: TonoAviso.error,
              texto: error.problemas.firstOrNull?.mensaje ?? error.mensaje,
            ),
          ],
          const SizedBox(height: 14),
          FilledButton(
            onPressed: _guardando ? null : _guardar,
            child: _guardando
                ? const CargandoEnBoton()
                : const Text('Guardar puntaje'),
          ),
        ],
      ),
    );
  }
}
