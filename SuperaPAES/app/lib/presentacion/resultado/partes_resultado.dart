import 'package:flutter/material.dart';

import 'package:supera_paes/dominio/entidades/resultado_evaluacion.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/practicar/pantalla_resumen_practica.dart';

/// Las partes del resultado (A30, A32 y A32b), en el orden de los bocetos.
abstract final class ContenidoResultado {
  static List<Widget> de(ResultadoEvaluacion datos) {
    final secundario = TemaSuperaPaes.pequeno.copyWith(
      color: TemaSuperaPaes.textoSecundario,
    );
    return [
      Column(
        children: [
          Text(
            '${datos.tipoNombre} · ${_estado(datos)}',
            style: secundario,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Semantics(
            header: true,
            child: Text(
              datos.prueba,
              style: TemaSuperaPaes.h1,
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
      _TarjetaPrincipal(datos: datos),
      if (datos.esEnsayo) Text(_notaEnsayo(datos), style: secundario),
      if (datos.esEnsayo && datos.puntaje == null)
        const Aviso(
          tono: TonoAviso.info,
          texto:
              'Esta prueba todavía no tiene una tabla de conversión del '
              'DEMRE, así que el resultado va sin puntaje estimado.',
        ),
      if (datos.recalculado)
        const Aviso(
          tono: TonoAviso.neutro,
          texto:
              'Este resultado se recalculó porque se anuló una pregunta con '
              'error.',
        ),
      if (datos.ejes.isNotEmpty || datos.habilidades.isNotEmpty)
        _TarjetaGrupos(datos: datos),
      if (datos.incorrectas + datos.omitidas > 0)
        Aviso(tono: TonoAviso.info, textoRico: _avisoRepaso(datos)),
    ];
  }

  /// «Entregado», «Tiempo agotado» o «Abandonado»; en femenino para la
  /// práctica.
  static String _estado(ResultadoEvaluacion datos) {
    final femenino = datos.tipo == 'practica';
    return switch (datos.estado) {
      'tiempo_agotado' => 'Tiempo agotado',
      'abandonada' => femenino ? 'Abandonada' : 'Abandonado',
      _ => femenino ? 'Entregada' : 'Entregado',
    };
  }

  /// A32: «Se consideran las 60 preguntas que puntúan. Las otras 5, como en
  /// la PAES, no cuentan. Tiempo usado: 2 h 11 min de 2 h 20 min.»
  static String _notaEnsayo(ResultadoEvaluacion datos) {
    final otras = datos.cantidad - datos.puntuables;
    final noCuentan = switch (otras) {
      <= 0 => '',
      1 => 'La otra, como en la PAES, no cuenta. ',
      _ => 'Las otras $otras, como en la PAES, no cuentan. ',
    };
    return 'Se consideran las ${datos.puntuables} preguntas que puntúan. '
        '${noCuentan}Tiempo usado: ${tiempoUsado(datos)}.';
  }

  /// «Las 4 incorrectas y las 3 omitidas pasaron a **Repasar errores**.»
  static InlineSpan _avisoRepaso(ResultadoEvaluacion datos) {
    final partes = [
      if (datos.incorrectas == 1) 'la incorrecta',
      if (datos.incorrectas > 1) 'las ${datos.incorrectas} incorrectas',
      if (datos.omitidas == 1) 'la omitida',
      if (datos.omitidas > 1) 'las ${datos.omitidas} omitidas',
    ];
    final sujeto = partes.join(' y ');
    final plural = datos.incorrectas + datos.omitidas > 1;
    return TextSpan(
      children: [
        TextSpan(
          text:
              '${sujeto[0].toUpperCase()}${sujeto.substring(1)} '
              '${plural ? 'pasaron' : 'pasó'} a ',
        ),
        const TextSpan(
          text: 'Repasar errores',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        const TextSpan(text: '.'),
      ],
    );
  }
}

/// «44 de 48 min» o «2 h 11 min de 2 h 20 min»; solo el tiempo usado si la
/// evaluación no tenía límite.
String tiempoUsado(ResultadoEvaluacion datos) {
  final usado = duracionLegible(datos.tiempoUsadoSeg);
  final limite = datos.duracionMin;
  if (limite == null) return usado;
  final minutos = (datos.tiempoUsadoSeg / 60).round();
  if (datos.tiempoUsadoSeg >= 60 && minutos < 60 && limite < 60) {
    return '$minutos de $limite min';
  }
  return '$usado de ${duracionLegible(limite * 60)}';
}

/// «44 min», «2 h 11 min» o, bajo un minuto, los segundos.
String duracionLegible(int segundos) {
  if (segundos < 60) return tiempoDePractica(segundos);
  final minutos = (segundos / 60).round();
  if (minutos < 60) return '$minutos min';
  final resto = minutos % 60;
  return resto == 0 ? '${minutos ~/ 60} h' : '${minutos ~/ 60} h $resto min';
}

/// El porcentaje o el puntaje estimado, y correctas, incorrectas y omitidas.
class _TarjetaPrincipal extends StatelessWidget {
  const _TarjetaPrincipal({required this.datos});

  final ResultadoEvaluacion datos;

  @override
  Widget build(BuildContext context) {
    final secundario = TemaSuperaPaes.pequeno.copyWith(
      color: TemaSuperaPaes.textoSecundario,
    );
    final puntaje = datos.puntaje;
    final tabla = datos.tablaConversion;
    return Tarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (puntaje != null) ...[
            const Text(
              'Puntaje estimado',
              style: TemaSuperaPaes.etiqueta,
              textAlign: TextAlign.center,
            ),
            Text(
              '$puntaje',
              style: TemaSuperaPaes.display,
              textAlign: TextAlign.center,
            ),
            Text(
              'Escala de 100 a 1.000 · tabla de conversión DEMRE, '
              'admisión ${tabla?.anioAdmision ?? ''} '
              '(${tabla?.proceso.toLowerCase() ?? ''})',
              style: secundario,
              textAlign: TextAlign.center,
            ),
            Text(
              'Es una estimación, no un resultado oficial del DEMRE.',
              style: secundario,
              textAlign: TextAlign.center,
            ),
          ] else ...[
            Text(
              '${datos.porcentaje.round()} %',
              style: TemaSuperaPaes.display,
              textAlign: TextAlign.center,
            ),
            Text(
              '${datos.correctas} de ${datos.puntuables} correctas',
              style: TemaSuperaPaes.cuerpo,
              textAlign: TextAlign.center,
            ),
            // En el ensayo, el tiempo va en la nota de abajo (A32).
            if (!datos.esEnsayo)
              Text(
                'Tiempo usado: ${tiempoUsado(datos)}',
                style: secundario,
                textAlign: TextAlign.center,
              ),
          ],
          const SizedBox(height: 16),
          Row(
            children: [
              DatoResumen(valor: '${datos.correctas}', texto: 'correctas'),
              DatoResumen(valor: '${datos.incorrectas}', texto: 'incorrectas'),
              DatoResumen(valor: '${datos.omitidas}', texto: 'omitidas'),
            ],
          ),
        ],
      ),
    );
  }
}

/// «Por eje» y «Por habilidad»: correctas de cada uno y su porcentaje.
class _TarjetaGrupos extends StatefulWidget {
  const _TarjetaGrupos({required this.datos});

  final ResultadoEvaluacion datos;

  @override
  State<_TarjetaGrupos> createState() => _TarjetaGruposState();
}

class _TarjetaGruposState extends State<_TarjetaGrupos> {
  bool _porEje = true;

  @override
  Widget build(BuildContext context) {
    final grupos = _porEje ? widget.datos.ejes : widget.datos.habilidades;
    return Tarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SelectorSegmentado<bool>(
            opciones: const [(true, 'Por eje'), (false, 'Por habilidad')],
            seleccionado: _porEje,
            onChanged: (valor) => setState(() => _porEje = valor),
          ),
          for (final grupo in grupos) ...[
            const SizedBox(height: 12),
            FilaDato(
              etiqueta: grupo.nombre,
              valor:
                  '${grupo.correctas} de ${grupo.preguntas} · '
                  '${grupo.porcentaje.round()} %',
            ),
          ],
        ],
      ),
    );
  }
}
