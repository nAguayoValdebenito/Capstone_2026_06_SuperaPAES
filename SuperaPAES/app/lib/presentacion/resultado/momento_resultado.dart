import 'package:flutter/material.dart';
import 'package:supera_paes/dominio/entidades/resultado_evaluacion.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/animados.dart';
import 'package:supera_paes/presentacion/comunes/movimiento.dart';
import 'package:supera_paes/presentacion/comunes/trazo.dart';

/// Texto interpretativo de la maqueta adaptado a los ejes recibidos.
/// No inventa un eje ni declara mejoras respecto de evaluaciones anteriores.
String? fraseDeResultado(ResultadoEvaluacion resultado) {
  final ejes = resultado.ejes.where((eje) => eje.preguntas > 0).toList()
    ..sort((a, b) => b.porcentaje.compareTo(a.porcentaje));
  if (ejes.isEmpty) return null;
  if (ejes.length == 1) return 'Tu resultado en ${ejes.first.nombre}.';
  if (ejes.first.porcentaje == ejes.last.porcentaje) {
    return 'Tu resultado fue parejo en todos los ejes.';
  }
  return 'Tu mejor eje fue ${ejes.first.nombre}. '
      '${ejes.last.nombre} es lo que más te conviene reforzar.';
}

class MomentoResultado extends StatelessWidget {
  const MomentoResultado({required this.datos, super.key});
  final ResultadoEvaluacion datos;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: duracion(context, TemaSuperaPaes.movimientoLento),
        builder: (_, valor, _) => Trazo(
          ancho: TemaSuperaPaes.anchoTrazoCorreccion,
          avance: sinAnimarMomentos(context) ? 1 : valor,
        ),
      ),
      const SizedBox(height: 12),
      ContadorAnimado(
        valor: datos.puntaje ?? datos.porcentaje.round(),
        miles: datos.puntaje != null,
        sufijo: datos.puntaje == null ? ' %' : '',
        estilo: TemaSuperaPaes.display,
      ),
    ],
  );
}
