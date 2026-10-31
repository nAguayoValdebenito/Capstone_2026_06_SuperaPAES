import 'package:flutter/material.dart';

import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/formato_pregunta_vista.dart';

/// Una alternativa ya corregida, fija (A19 y A33): la correcta en verde
/// («Tu respuesta» si la eligió, «Correcta» si no) y la elegida incorrecta en
/// rojo; las demás quedan igual. Sin [elegidaId], la pregunta quedó omitida.
class AlternativaCorregidaVista extends StatelessWidget {
  const AlternativaCorregidaVista({
    required this.id,
    required this.letra,
    required this.texto,
    required this.correctaId,
    super.key,
    this.elegidaId,
  });

  final int id;
  final String letra;
  final String texto;
  final int correctaId;
  final int? elegidaId;

  @override
  Widget build(BuildContext context) {
    final esLaCorrecta = id == correctaId;
    final esLaElegida = id == elegidaId;
    return OpcionAlternativa(
      letra: letra,
      texto: texto,
      seleccionada: esLaElegida,
      onTap: null,
      resultado: esLaCorrecta
          ? ResultadoAlternativa.correcta
          : esLaElegida
          ? ResultadoAlternativa.incorrecta
          : null,
      etiqueta: esLaElegida
          ? 'Tu respuesta'
          : esLaCorrecta
          ? 'Correcta'
          : null,
    );
  }
}

/// «Explicación» de la respuesta correcta y, si falló, por qué la
/// alternativa elegida no era la correcta (HU-32 esc. 2; A19 y A33).
class ExplicacionCorreccion extends StatelessWidget {
  const ExplicacionCorreccion({
    required this.acerto,
    super.key,
    this.explicacion,
    this.elegida,
  });

  final bool acerto;
  final String? explicacion;

  /// La alternativa que eligió, si respondió.
  final AlternativaCorregida? elegida;

  @override
  Widget build(BuildContext context) {
    final elegida = this.elegida;
    final porQueNo = acerto ? null : elegida?.explicacion;
    final explicacion = this.explicacion;
    if (explicacion == null && porQueNo == null) return const SizedBox.shrink();
    return Tarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (explicacion != null) ...[
            const Text('Explicación', style: TemaSuperaPaes.etiqueta),
            const SizedBox(height: 6),
            TextoConFormulas(explicacion),
          ],
          if (porQueNo != null) ...[
            if (explicacion != null) const SizedBox(height: 14),
            Text(
              'Por qué la ${elegida!.letra} no es correcta',
              style: TemaSuperaPaes.etiqueta,
            ),
            const SizedBox(height: 6),
            TextoConFormulas(porQueNo),
          ],
        ],
      ),
    );
  }
}
