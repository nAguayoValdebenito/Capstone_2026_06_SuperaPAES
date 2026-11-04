import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/evaluacion_con_tiempo.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/estados.dart';
import 'package:supera_paes/presentacion/comunes/sello_prueba.dart';
import 'package:supera_paes/presentacion/comunes/trazo.dart';
import 'package:supera_paes/presentacion/evaluaciones/estado_evaluaciones.dart';
import 'package:supera_paes/presentacion/inicio/evaluacion_sin_terminar.dart';
import 'package:supera_paes/presentacion/inicio/pruebas_inicio.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';

/// Código de Competencia Lectora, que se mide por habilidad y no por eje.
const String _lectora = 'CL';

/// Lo primero en Inicio: qué hacer hoy, una sola cosa (plan de mejora visual
/// del 02/11, tanda C). En orden: lo que quedó sin terminar (HU-60), el
/// diagnóstico pendiente de sus pruebas (HU-36, la prueba a reforzar primero),
/// la prueba a reforzar o la práctica libre. Un diagnóstico que pospuso en
/// A16 no se vuelve a sugerir hasta que se abra de nuevo la app.
class TarjetaHoy extends ConsumerWidget {
  const TarjetaHoy({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (haySinTerminar(ref.watch(evaluacionAbiertaProvider).value)) {
      return const EvaluacionSinTerminar();
    }
    final perfil = ref.watch(perfilProvider);
    final opciones = ref.watch(opcionesPerfilProvider);
    // «Tus pruebas» ya muestra el error del perfil.
    if (perfil.hasError || opciones.hasError) return const SizedBox.shrink();
    final (guardado, catalogo) = (perfil.value, opciones.value);
    if (guardado == null || catalogo == null) {
      return const EsqueletoTarjeta(lineas: 1);
    }
    final pruebas = pruebasDeInicio(guardado, catalogo);
    final pospuestos = ref.watch(diagnosticosPospuestosProvider);
    for (final prueba in pruebas) {
      final consulta = ref.watch(disponibilidadDiagnosticoProvider(prueba.id));
      if (!consulta.hasValue && !consulta.hasError) {
        return const EsqueletoTarjeta(lineas: 1);
      }
      final diagnostico = consulta.value;
      if (diagnostico != null &&
          diagnostico.disponible &&
          !pospuestos.contains(prueba.id)) {
        return _HoyDiagnostico(
          nombre: catalogo.prueba(prueba.id)?.nombreCorto ?? prueba.titulo,
          codigo: catalogo.prueba(prueba.id)?.codigo ?? '',
          diagnostico: diagnostico,
        );
      }
    }
    for (final prueba in pruebas) {
      if (prueba.reforzar) {
        return _HoyReforzar(
          pruebaId: prueba.id,
          nombre: catalogo.prueba(prueba.id)?.nombreCorto ?? prueba.titulo,
          codigo: catalogo.prueba(prueba.id)?.codigo ?? '',
        );
      }
    }
    return _Hoy(
      titulo: 'Hoy: elige qué practicar.',
      detalle: 'Tú decides la prueba, el tema y cuántas preguntas.',
      simbolo: const Trazo(ancho: 48),
      onPressed: () => context.go(Rutas.practicar),
    );
  }
}

class _HoyDiagnostico extends ConsumerWidget {
  const _HoyDiagnostico({
    required this.nombre,
    required this.codigo,
    required this.diagnostico,
  });

  final String nombre;
  final String codigo;
  final DisponibilidadDiagnostico diagnostico;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final medida = codigo == _lectora ? 'habilidades' : 'ejes';
    return _Hoy(
      titulo: 'Hoy: haz el diagnóstico de $nombre.',
      detalle:
          '${diagnostico.cantidad} preguntas, no usa tu cupo. Con él sabremos '
          'qué $medida reforzar primero.',
      simbolo: SelloPrueba(codigo: codigo),
      onPressed: () {
        ref.read(ofertaDiagnosticoProvider.notifier).ofrecer(diagnostico);
        unawaited(context.push(Rutas.ofrecerDiagnostico));
      },
    );
  }
}

class _HoyReforzar extends ConsumerWidget {
  const _HoyReforzar({
    required this.pruebaId,
    required this.nombre,
    required this.codigo,
  });

  final int pruebaId;
  final String nombre;
  final String codigo;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return _Hoy(
      titulo: 'Hoy: refuerza $nombre.',
      detalle: 'Tu práctica parte por lo que más necesitas.',
      simbolo: SelloPrueba(codigo: codigo),
      onPressed: () {
        ref.read(borradorPracticaProvider.notifier).elegirPrueba(pruebaId);
        context.go(Rutas.practicar);
      },
    );
  }
}

/// La tarjeta: en azul suave, con el título, su detalle, el sello o el trazo
/// a la derecha y «Empezar» a lo ancho.
class _Hoy extends StatelessWidget {
  const _Hoy({
    required this.titulo,
    required this.detalle,
    required this.simbolo,
    required this.onPressed,
  });

  final String titulo;
  final String detalle;
  final Widget simbolo;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Tarjeta(
      color: TemaSuperaPaes.primarioSuave,
      borde: TemaSuperaPaes.primarioSuave,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Semantics(
                      header: true,
                      child: Text(titulo, style: TemaSuperaPaes.h2),
                    ),
                    const SizedBox(height: TemaSuperaPaes.espacio4),
                    Text(
                      detalle,
                      style: TemaSuperaPaes.pequeno.copyWith(
                        color: TemaSuperaPaes.textoSecundario,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: TemaSuperaPaes.espacio12),
              simbolo,
            ],
          ),
          const SizedBox(height: TemaSuperaPaes.espacio12),
          FilledButton(onPressed: onPressed, child: const Text('Empezar')),
        ],
      ),
    );
  }
}
