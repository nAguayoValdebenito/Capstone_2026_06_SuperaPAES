import 'package:flutter/material.dart';
import 'package:supera_paes/dominio/entidades/progreso.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/animados.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/ejes.dart';
import 'package:supera_paes/presentacion/comunes/fechas.dart';
import 'package:supera_paes/presentacion/comunes/movimiento.dart';
import 'package:supera_paes/presentacion/comunes/sello_prueba.dart';

/// «68 %» sin decimales, como en el boceto A35.
String porcentaje(double valor) => '${valor.round()} %';

/// Dificultades en el orden del boceto. Los códigos son los de
/// contenido.dificultad.
const List<(String, String)> _dificultades = [
  ('facil', 'Fácil'),
  ('media', 'Media'),
  ('dificil', 'Difícil'),
];

/// Título de sección fuera de la tarjeta («Por eje», «Semana a semana»),
/// como en la maqueta A35.
class TituloSeccion extends StatelessWidget {
  const TituloSeccion(this.texto, {super.key});

  final String texto;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: TemaSuperaPaes.espacio8),
    child: Semantics(
      header: true,
      child: Text(texto, style: TemaSuperaPaes.h2),
    ),
  );
}

/// «Acierto en M1» con el sello de la prueba, el porcentaje que cuenta, cuántas
/// respuestas suma y el acierto por dificultad en barras (HU-38 esc. 1).
class TarjetaAcierto extends StatelessWidget {
  const TarjetaAcierto({
    required this.progreso,
    required this.nombre,
    required this.prueba,
    super.key,
  });

  final ProgresoPrueba progreso;
  final String nombre;
  final Prueba prueba;

  @override
  Widget build(BuildContext context) {
    final secundario = TemaSuperaPaes.pequeno.copyWith(
      color: TemaSuperaPaes.textoSecundario,
    );
    return Tarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              SelloPrueba(prueba, tamano: 32),
              const SizedBox(width: TemaSuperaPaes.espacio12),
              Expanded(
                child: Text(
                  'Acierto en $nombre',
                  style: TemaSuperaPaes.cuerpoFuerte,
                ),
              ),
            ],
          ),
          const SizedBox(height: TemaSuperaPaes.espacio12),
          ContadorAnimado(
            valor: progreso.acierto.round(),
            sufijo: ' %',
            estilo: TemaSuperaPaes.display,
          ),
          Text(
            'Suma prácticas y evaluaciones · ${progreso.respondidas} '
            '${progreso.respondidas == 1 ? 'respuesta' : 'respuestas'}',
            style: secundario,
          ),
          const SizedBox(height: TemaSuperaPaes.espacio16),
          Text(
            'Por dificultad',
            style: TemaSuperaPaes.pequenoFuerte.copyWith(
              color: TemaSuperaPaes.textoSecundario,
            ),
          ),
          for (final (i, (codigo, texto)) in _dificultades.indexed)
            _FilaDificultad(
              texto: texto,
              acierto: progreso.aciertoPorDificultad[codigo],
              indice: i,
            ),
        ],
      ),
    );
  }
}

/// «Fácil ▬▬▬ 82 %». Sin respuestas de esa dificultad, la barra queda vacía
/// y el valor es «—».
class _FilaDificultad extends StatelessWidget {
  const _FilaDificultad({
    required this.texto,
    required this.acierto,
    required this.indice,
  });

  final String texto;
  final double? acierto;
  final int indice;

  @override
  Widget build(BuildContext context) {
    final valor = switch (acierto) {
      final a? => porcentaje(a),
      null => '—',
    };
    final secundario = TemaSuperaPaes.pequeno.copyWith(
      color: TemaSuperaPaes.textoSecundario,
    );
    final barra = BarraAnimada(
      valor: ((acierto ?? 0) / 100).clamp(0, 1),
      alto: TemaSuperaPaes.altoAvance,
      retraso: duracion(context, TemaSuperaPaes.pasoEscalonado) * (indice + 1),
    );
    final cifra = Text(
      valor,
      textAlign: TextAlign.end,
      style: TemaSuperaPaes.tabular(TemaSuperaPaes.pequenoFuerte),
    );
    // Con letra grande, el nombre y la cifra van sobre la barra (RNF-12).
    final grande = MediaQuery.textScalerOf(context).scale(1) > 1.5;
    return Semantics(
      label: '$texto: $valor',
      child: ExcludeSemantics(
        child: Padding(
          padding: const EdgeInsets.only(top: TemaSuperaPaes.espacio8),
          child: grande
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(child: Text(texto, style: secundario)),
                        cifra,
                      ],
                    ),
                    const SizedBox(height: TemaSuperaPaes.espacio4),
                    barra,
                  ],
                )
              : Row(
                  children: [
                    ConstrainedBox(
                      constraints: const BoxConstraints(minWidth: 56),
                      child: Text(texto, style: secundario),
                    ),
                    const SizedBox(width: TemaSuperaPaes.espacio8),
                    Expanded(child: barra),
                    const SizedBox(width: TemaSuperaPaes.espacio8),
                    ConstrainedBox(
                      constraints: const BoxConstraints(minWidth: 44),
                      child: cifra,
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}

/// El nivel de un eje según la marca del servidor: «Reforzar» solo si
/// [GrupoProgreso.aReforzar] (RN-14 exige además 5 respuestas); si no,
/// «En camino» bajo 70 % y «Firme» desde ahí.
({String texto, IconData icono, TonoEtiqueta tono}) nivelDeGrupo(
  GrupoProgreso grupo,
) {
  if (grupo.aReforzar) return nivelDeEje(0);
  final valor = grupo.aciertoPonderado / 100;
  return nivelDeEje(valor < 0.6 ? 0.6 : valor);
}

/// «Por eje» (en Lectora, «Por habilidad»): el acierto ponderado de cada uno
/// con su nivel y su barra (HU-38 esc. 2, RN-14).
class TarjetaGrupos extends StatelessWidget {
  const TarjetaGrupos({required this.progreso, super.key});

  final ProgresoPrueba progreso;

  @override
  Widget build(BuildContext context) {
    final porHabilidad = progreso.porHabilidad;
    return Tarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (i, grupo) in progreso.grupos.indexed)
            FilaEje(
              nombre: grupo.nombre,
              valor: (grupo.aciertoPonderado / 100).clamp(0, 1),
              indice: i,
              nivel: nivelDeGrupo(grupo),
            ),
          const SizedBox(height: TemaSuperaPaes.espacio8),
          Text(
            '${porHabilidad ? 'Una habilidad' : 'Un eje'} se refuerza con '
            'menos de 60 % de acierto ponderado y al menos 5 respuestas. Las '
            'difíciles pesan más.',
            style: TemaSuperaPaes.pequeno.copyWith(
              color: TemaSuperaPaes.textoSecundario,
            ),
          ),
        ],
      ),
    );
  }
}

/// «Semana a semana»: el acierto de las últimas seis semanas en barras que
/// crecen escalonadas; la más reciente va en `primario` y las pasadas en
/// `primarioMedio` (HU-38 esc. 3). Abajo, cuánto subió respecto de la semana
/// anterior o, en la primera, que la próxima se verá el cambio.
class TarjetaSemanas extends StatelessWidget {
  const TarjetaSemanas({required this.semanas, super.key});

  final List<SemanaProgreso> semanas;

  @override
  Widget build(BuildContext context) {
    final ultimas = semanas.length > 6
        ? semanas.sublist(semanas.length - 6)
        : semanas;
    final etiqueta = TemaSuperaPaes.pequeno.copyWith(
      color: TemaSuperaPaes.textoSecundario,
    );
    final cambio = _cambio(ultimas);
    return Tarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (final (i, semana) in ultimas.indexed)
                Expanded(
                  child: Semantics(
                    container: true,
                    label:
                        'Semana del ${fechaCorta(semana.lunes)}: '
                        '${porcentaje(semana.acierto)}',
                    excludeSemantics: true,
                    child: _BarraSemana(
                      semana: semana,
                      actual: i == ultimas.length - 1,
                      indice: i,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: TemaSuperaPaes.espacio8),
          ExcludeSemantics(
            child: Row(
              children: [
                for (final semana in ultimas)
                  Expanded(
                    child: Text(
                      fechaCorta(semana.lunes),
                      textAlign: TextAlign.center,
                      style: TemaSuperaPaes.tabular(etiqueta),
                    ),
                  ),
              ],
            ),
          ),
          if (cambio != null) ...[
            const SizedBox(height: TemaSuperaPaes.espacio12),
            cambio,
          ],
        ],
      ),
    );
  }

  /// La frase bajo las barras. Solo se dice cuando sube: una baja no se
  /// anuncia (la maqueta no la trae).
  Widget? _cambio(List<SemanaProgreso> ultimas) {
    if (ultimas.length == 1) {
      return Text(
        'Tu primera semana. La próxima verás cómo vas.',
        textAlign: TextAlign.center,
        style: TemaSuperaPaes.pequeno.copyWith(
          color: TemaSuperaPaes.textoSecundario,
        ),
      );
    }
    final anterior = ultimas[ultimas.length - 2];
    final subida = ultimas.last.acierto.round() - anterior.acierto.round();
    if (subida <= 0) return null;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const ExcludeSemantics(
          child: Icon(
            Icons.trending_up_rounded,
            size: 18,
            color: TemaSuperaPaes.primario,
          ),
        ),
        const SizedBox(width: TemaSuperaPaes.espacio8),
        Expanded(
          child: Text(
            'Subiste $subida ${subida == 1 ? 'punto' : 'puntos'} desde la '
            'semana del ${fechaCorta(anterior.lunes)}.',
            style: TemaSuperaPaes.pequenoFuerte.copyWith(
              color: TemaSuperaPaes.primario,
            ),
          ),
        ),
      ],
    );
  }
}

/// Una barra de la semana con su porcentaje encima. Crece desde abajo en
/// 400 ms, escalonada; con movimiento reducido aparece completa.
class _BarraSemana extends StatelessWidget {
  const _BarraSemana({
    required this.semana,
    required this.actual,
    required this.indice,
  });

  final SemanaProgreso semana;
  final bool actual;
  final int indice;

  @override
  Widget build(BuildContext context) {
    final alto = (TemaSuperaPaes.altoBarraSemana * semana.acierto / 100).clamp(
      4.0,
      TemaSuperaPaes.altoBarraSemana,
    );
    final color = actual
        ? TemaSuperaPaes.primario
        : TemaSuperaPaes.primarioMedio;
    final base = duracion(context, TemaSuperaPaes.movimientoLento);
    final retraso =
        duracion(context, TemaSuperaPaes.pasoEscalonado) *
        indice.clamp(0, TemaSuperaPaes.topeEscalonado - 1);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          porcentaje(semana.acierto),
          style: TemaSuperaPaes.tabular(
            TemaSuperaPaes.pequenoFuerte.copyWith(
              color: actual ? TemaSuperaPaes.primario : TemaSuperaPaes.texto,
            ),
          ),
        ),
        const SizedBox(height: TemaSuperaPaes.espacio4),
        SizedBox(
          height: TemaSuperaPaes.altoBarraSemana,
          width: TemaSuperaPaes.anchoBarraSemana,
          child: Align(
            alignment: Alignment.bottomCenter,
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: base == Duration.zero ? 1 : 0, end: 1),
              duration: base + retraso,
              curve: Interval(
                base == Duration.zero
                    ? 0
                    : retraso.inMilliseconds / (base + retraso).inMilliseconds,
                1,
                curve: TemaSuperaPaes.curvaEntrada,
              ),
              builder: (context, avance, _) => Transform.scale(
                scaleY: avance,
                alignment: Alignment.bottomCenter,
                child: Container(
                  height: alto,
                  decoration: BoxDecoration(
                    color: color,
                    borderRadius: BorderRadius.circular(
                      TemaSuperaPaes.radioBarraSemana,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// «Ensayos completos» con la fecha y el puntaje estimado de cada uno
/// (RN-23). El puntaje PAES real para compararlos va en la fila de abajo.
class TarjetaEnsayos extends StatelessWidget {
  const TarjetaEnsayos({required this.ensayos, super.key});

  final List<EnsayoProgreso> ensayos;

  @override
  Widget build(BuildContext context) {
    return Tarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (i, ensayo) in ensayos.reversed.indexed) ...[
            if (i > 0) const SizedBox(height: TemaSuperaPaes.espacio12),
            FilaDato(
              etiqueta: '${fechaLarga(ensayo.cerradaEn)} · Puntaje estimado',
              valor: '${ensayo.puntaje}',
            ),
          ],
          const SizedBox(height: TemaSuperaPaes.espacio12),
          Text(
            'Es una estimación, no un resultado oficial.',
            style: TemaSuperaPaes.pequeno.copyWith(
              color: TemaSuperaPaes.textoSecundario,
            ),
          ),
        ],
      ),
    );
  }
}
