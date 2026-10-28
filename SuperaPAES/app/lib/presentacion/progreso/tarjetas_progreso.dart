import 'package:flutter/material.dart';

import 'package:supera_paes/dominio/entidades/progreso.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';

/// «68 %» sin decimales, como en el boceto A35.
String porcentaje(double valor) => '${valor.round()} %';

/// Dificultades en el orden del boceto. Los códigos son los de
/// contenido.dificultad.
const List<(String, String)> _dificultades = [
  ('facil', 'Fácil'),
  ('media', 'Media'),
  ('dificil', 'Difícil'),
];

/// «Acierto en M1», el porcentaje, el acierto por dificultad y cuántas
/// respuestas suma (HU-38 esc. 1).
class TarjetaAcierto extends StatelessWidget {
  const TarjetaAcierto({
    required this.progreso,
    required this.nombre,
    super.key,
  });

  final ProgresoPrueba progreso;
  final String nombre;

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
              Expanded(
                child: Text(
                  'Acierto en $nombre',
                  style: TemaSuperaPaes.etiqueta.copyWith(
                    color: TemaSuperaPaes.textoSecundario,
                  ),
                ),
              ),
              Text(porcentaje(progreso.acierto), style: TemaSuperaPaes.numero),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              for (final (i, (codigo, texto)) in _dificultades.indexed) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(
                  child: _DatoDificultad(
                    texto: texto,
                    acierto: progreso.aciertoPorDificultad[codigo],
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),
          Text(
            'Suma prácticas y evaluaciones · ${progreso.respondidas} '
            '${progreso.respondidas == 1 ? 'respuesta' : 'respuestas'}',
            style: secundario,
          ),
        ],
      ),
    );
  }
}

class _DatoDificultad extends StatelessWidget {
  const _DatoDificultad({required this.texto, required this.acierto});

  final String texto;

  /// `null` sin respuestas de esa dificultad.
  final double? acierto;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
      decoration: BoxDecoration(
        color: TemaSuperaPaes.neutroSuave,
        borderRadius: BorderRadius.circular(TemaSuperaPaes.radioDato),
      ),
      child: Column(
        children: [
          Text(
            texto,
            style: TemaSuperaPaes.pequeno.copyWith(
              color: TemaSuperaPaes.textoSecundario,
            ),
          ),
          Text(switch (acierto) {
            final valor? => porcentaje(valor),
            null => '—',
          }, style: TemaSuperaPaes.cuerpoFuerte),
        ],
      ),
    );
  }
}

/// «Por eje» (en Lectora, «Por habilidad»): el acierto ponderado de cada uno
/// con su barra y «A reforzar» cuando corresponde (HU-38 esc. 2, RN-14).
class TarjetaGrupos extends StatelessWidget {
  const TarjetaGrupos({required this.progreso, super.key});

  final ProgresoPrueba progreso;

  @override
  Widget build(BuildContext context) {
    final grupos = progreso.grupos;
    final porHabilidad = progreso.porHabilidad;
    return Tarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: Text(
              porHabilidad ? 'Por habilidad' : 'Por eje',
              style: TemaSuperaPaes.h2,
            ),
          ),
          for (final grupo in grupos) ...[
            const SizedBox(height: 12),
            _FilaGrupo(grupo: grupo),
          ],
          const SizedBox(height: 12),
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

class _FilaGrupo extends StatelessWidget {
  const _FilaGrupo({required this.grupo});

  final GrupoProgreso grupo;

  @override
  Widget build(BuildContext context) {
    final radio = BorderRadius.circular(TemaSuperaPaes.altoBarra / 2);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Wrap(
                spacing: 8,
                runSpacing: 4,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text(grupo.nombre, style: TemaSuperaPaes.cuerpoFuerte),
                  if (grupo.aReforzar)
                    const Etiqueta(
                      texto: 'A reforzar',
                      tono: TonoEtiqueta.aviso,
                    ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Text(
              porcentaje(grupo.aciertoPonderado),
              style: TemaSuperaPaes.pequenoFuerte.copyWith(
                color: TemaSuperaPaes.textoSecundario,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        // El porcentaje ya se lee arriba.
        ExcludeSemantics(
          child: Container(
            height: TemaSuperaPaes.altoBarra,
            alignment: Alignment.centerLeft,
            decoration: BoxDecoration(
              color: TemaSuperaPaes.neutroSuave,
              borderRadius: radio,
            ),
            child: FractionallySizedBox(
              widthFactor: (grupo.aciertoPonderado / 100).clamp(0, 1),
              heightFactor: 1,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: grupo.aReforzar
                      ? TemaSuperaPaes.avisoBorde
                      : TemaSuperaPaes.primario,
                  borderRadius: radio,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// «Semana a semana»: el acierto de las últimas seis semanas en barras; la
/// más reciente va en `primario` (HU-38 esc. 3).
class TarjetaSemanas extends StatelessWidget {
  const TarjetaSemanas({required this.semanas, super.key});

  final List<SemanaProgreso> semanas;

  @override
  Widget build(BuildContext context) {
    final ultimas = semanas.length > 6
        ? semanas.sublist(semanas.length - 6)
        : semanas;
    final maximo = ultimas.fold<double>(
      1,
      (mayor, s) => s.acierto > mayor ? s.acierto : mayor,
    );
    final etiqueta = TemaSuperaPaes.mini.copyWith(
      color: TemaSuperaPaes.textoSecundario,
    );
    return Tarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: const Text('Semana a semana', style: TemaSuperaPaes.h2),
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (final (i, semana) in ultimas.indexed) ...[
                if (i > 0) const SizedBox(width: 6),
                Expanded(
                  child: Semantics(
                    container: true,
                    label:
                        'Semana del ${fechaCorta(semana.lunes)}: '
                        '${porcentaje(semana.acierto)}',
                    excludeSemantics: true,
                    child: Column(
                      children: [
                        Text(porcentaje(semana.acierto), style: etiqueta),
                        const SizedBox(height: 6),
                        Container(
                          height:
                              (TemaSuperaPaes.altoBarraSemana *
                                      semana.acierto /
                                      maximo)
                                  .clamp(4, TemaSuperaPaes.altoBarraSemana),
                          decoration: BoxDecoration(
                            color: i == ultimas.length - 1
                                ? TemaSuperaPaes.primario
                                : TemaSuperaPaes.primarioSuave,
                            borderRadius: BorderRadius.circular(
                              TemaSuperaPaes.radioBarraSemana,
                            ),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text('S${i + 1}', style: etiqueta),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

/// «Ensayos completos» con la fecha y el puntaje estimado de cada uno (RN-23).
/// El puntaje PAES real llega con HU-41.
class TarjetaEnsayos extends StatelessWidget {
  const TarjetaEnsayos({required this.ensayos, super.key});

  final List<EnsayoProgreso> ensayos;

  @override
  Widget build(BuildContext context) {
    return Tarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: const Text('Ensayos completos', style: TemaSuperaPaes.h2),
          ),
          for (final ensayo in ensayos.reversed) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${fechaLarga(ensayo.cerradaEn)} · Puntaje estimado',
                    style: TemaSuperaPaes.pequeno.copyWith(
                      color: TemaSuperaPaes.textoSecundario,
                    ),
                  ),
                ),
                Text('${ensayo.puntaje}', style: TemaSuperaPaes.pequenoFuerte),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// «19/10».
String fechaCorta(DateTime fecha) => '${_dos(fecha.day)}/${_dos(fecha.month)}';

/// «18/10/2026», en la hora del teléfono.
String fechaLarga(DateTime fecha) {
  final local = fecha.toLocal();
  return '${_dos(local.day)}/${_dos(local.month)}/${local.year}';
}

String _dos(int numero) => numero.toString().padLeft(2, '0');
