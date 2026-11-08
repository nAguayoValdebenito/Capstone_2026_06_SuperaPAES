import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/dominio/entidades/resultado_evaluacion.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/ejes.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';

/// Lo propio del resultado del diagnóstico (A31; HU-36 esc. 4, CU-10a,
/// RN-14 y RN-28): cada eje (o habilidad, en Lectora) con su marca «A
/// reforzar», los ejes que el curso todavía no ve y lo que la práctica
/// priorizará desde ahora.
List<Widget> partesDiagnostico(ResultadoEvaluacion datos) {
  final reforzar = datos.aReforzar;
  return [
    _TarjetaReforzar(
      grupos: datos.ejes.isNotEmpty ? datos.ejes : datos.habilidades,
    ),
    for (final eje in datos.ejesOmitidos)
      Aviso(tono: TonoAviso.neutro, textoRico: _avisoOmitido(eje)),
    if (reforzar.isEmpty)
      const Aviso(
        tono: TonoAviso.exito,
        texto:
            'Por ahora no hay nada que reforzar: tu práctica seguirá con la '
            'mezcla de toda la prueba.',
      )
    else
      Aviso(
        tono: TonoAviso.info,
        textoRico: TextSpan(
          children: [
            TextSpan(
              text:
                  'Desde ahora tu práctica de ${datos.prueba} dará '
                  'prioridad a ',
            ),
            ..._enNegrita([for (final g in reforzar) g.nombre]),
            const TextSpan(text: '.'),
          ],
        ),
      ),
  ];
}

/// «El eje **Sistema económico** se enseña en 4° medio, así que no se
/// incluyó. Sus preguntas se repartieron entre los otros ejes.»
InlineSpan _avisoOmitido(EjeOmitido eje) => TextSpan(
  children: [
    const TextSpan(text: 'El eje '),
    TextSpan(
      text: eje.nombre,
      style: const TextStyle(fontWeight: FontWeight.w700),
    ),
    TextSpan(
      text: switch (eje.curso) {
        final curso? => ' se enseña en $curso',
        null => ' todavía no se enseña en tu curso',
      },
    ),
    const TextSpan(
      text:
          ', así que no se incluyó. Sus preguntas se repartieron entre los '
          'otros ejes.',
    ),
  ],
);

/// «**A**», «**A** y **B**», «**A**, **B** y **C**».
List<InlineSpan> _enNegrita(List<String> nombres) => [
  for (final (i, nombre) in nombres.indexed) ...[
    if (i > 0) TextSpan(text: i == nombres.length - 1 ? ' y ' : ', '),
    TextSpan(
      text: nombre,
      style: const TextStyle(fontWeight: FontWeight.w700),
    ),
  ],
];

/// Lleva a practicar lo primero que marcó el diagnóstico (A13 con ese eje o
/// esa habilidad); sin nada a reforzar, toda la prueba.
void practicarLoReforzado(
  BuildContext context,
  WidgetRef ref,
  ResultadoEvaluacion datos,
) {
  final pruebaId = datos.pruebaId;
  if (pruebaId == null) return;
  final borrador = ref.read(borradorPracticaProvider.notifier)
    ..elegirPrueba(pruebaId);
  if (datos.aReforzar.firstOrNull
      case GrupoDeResultado(id: final id?, :final nombre) && final grupo) {
    borrador.elegirAlcance(
      Alcance(
        datos.ejes.contains(grupo) ? TipoAlcance.eje : TipoAlcance.habilidad,
        id: id,
        nombre: nombre,
      ),
    );
  }
  context.go(Rutas.practicar);
}

/// «Practicar Formación ciudadana», o «Ir a practicar» sin nada a reforzar.
String textoPracticar(ResultadoEvaluacion datos) =>
    switch (datos.aReforzar.firstOrNull) {
      final grupo? => 'Practicar ${grupo.nombre}',
      null => 'Ir a practicar',
    };

/// Cada eje con sus correctas y, si la práctica lo priorizará, «A reforzar».
class _TarjetaReforzar extends StatelessWidget {
  const _TarjetaReforzar({required this.grupos});

  final List<GrupoDeResultado> grupos;

  @override
  Widget build(BuildContext context) {
    return Tarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (i, grupo) in grupos.indexed) ...[
            if (i > 0) const SizedBox(height: 12),
            FilaEje(
              mostrarNivel: false,
              nombre: grupo.nombre,
              valor: grupo.porcentaje / 100,
              indice: i,
            ),
            Text(
              '${grupo.correctas} de ${grupo.preguntas} · '
              '${grupo.porcentaje.round()} %',
              style: TemaSuperaPaes.pequeno,
            ),
            if (grupo.aReforzar) ...[
              const SizedBox(height: 4),
              const Align(
                alignment: Alignment.centerLeft,
                child: Etiqueta(texto: 'A reforzar', tono: TonoEtiqueta.aviso),
              ),
            ],
          ],
        ],
      ),
    );
  }
}
