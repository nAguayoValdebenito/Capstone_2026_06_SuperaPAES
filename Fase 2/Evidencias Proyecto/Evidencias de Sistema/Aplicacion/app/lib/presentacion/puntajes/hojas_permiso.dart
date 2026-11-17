import 'package:flutter/material.dart';

import 'package:supera_paes/dominio/entidades/puntajes_paes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/hoja_confirmacion.dart';
import 'package:supera_paes/presentacion/comunes/texto_documento.dart';

/// Dar el permiso de puntajes (RN-16): muestra el permiso vigente completo
/// antes de aceptarlo, como los términos al registrarse.
class HojaDarPermiso extends StatelessWidget {
  const HojaDarPermiso({required this.permiso, super.key});

  final PermisoPuntajes permiso;

  @override
  Widget build(BuildContext context) {
    // El título y la línea de versión del Markdown ya están en la hoja.
    final markdown = permiso.texto
        .split('\n')
        .where((l) => !l.startsWith('# ') && !l.startsWith('Versión '))
        .join('\n');
    return HojaConfirmacion(
      titulo: 'Permiso para usar mis puntajes',
      contenido: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Versión ${permiso.version}',
            style: TemaSuperaPaes.pequenoFuerte.copyWith(
              color: TemaSuperaPaes.textoSecundario,
            ),
          ),
          const SizedBox(height: 8),
          ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.sizeOf(context).height * 0.45,
            ),
            child: SingleChildScrollView(child: TextoDocumento(markdown)),
          ),
        ],
      ),
      confirmar: 'Dar el permiso',
      cancelar: 'Ahora no',
    );
  }
}

/// Retirar el permiso: avisa que se borran los puntajes cargados (RN-16).
class HojaRetirarPermiso extends StatelessWidget {
  const HojaRetirarPermiso({required this.cargados, super.key});

  final int cargados;

  @override
  Widget build(BuildContext context) {
    return HojaConfirmacion(
      titulo: '¿Retirar el permiso?',
      contenido: Text(
        switch (cargados) {
          0 => 'Ya no podrás cargar puntajes hasta que vuelvas a darlo.',
          1 => 'Borraremos el puntaje que cargaste. No se puede deshacer.',
          _ =>
            'Borraremos los $cargados puntajes que cargaste. No se puede '
                'deshacer.',
        },
        style: TemaSuperaPaes.cuerpo.copyWith(
          color: TemaSuperaPaes.textoSecundario,
        ),
      ),
      confirmar: 'Retirar el permiso',
      cancelar: 'Mantenerlo',
    );
  }
}
