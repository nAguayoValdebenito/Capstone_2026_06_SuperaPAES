import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/animados.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/cuenta_regresiva_cupo.dart';
import 'package:supera_paes/presentacion/comunes/estado_usuario.dart';
import 'package:supera_paes/presentacion/comunes/estados.dart';
import 'package:supera_paes/presentacion/comunes/sello_prueba.dart';
import 'package:supera_paes/presentacion/inicio/estado_inicio.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
import 'package:supera_paes/presentacion/planes/estado_planes.dart';

class SaludoInicio extends ConsumerWidget {
  const SaludoInicio({required this.nombre, super.key});
  final String nombre;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final racha = ref.watch(estadoUsuarioProvider).value?.cupo.racha;
    return Wrap(
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: TemaSuperaPaes.espacio12,
      runSpacing: TemaSuperaPaes.espacio8,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Hola,',
              style: TemaSuperaPaes.cuerpo.copyWith(
                color: TemaSuperaPaes.textoSecundario,
              ),
            ),
            Semantics(
              header: true,
              child: Text(
                nombre.trim().split(RegExp(r'\s+')).first,
                style: TemaSuperaPaes.h1,
              ),
            ),
          ],
        ),
        if (racha != null)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const MarcaRacha(),
              const SizedBox(width: TemaSuperaPaes.espacio8),
              Flexible(
                child: Text(
                  textoDeRacha(racha),
                  style: TemaSuperaPaes.pequenoFuerte,
                ),
              ),
            ],
          ),
      ],
    );
  }
}

String textoDeRacha(int dias) => switch (dias) {
  0 => 'Empieza tu racha hoy',
  1 => '1 día seguido',
  _ => '$dias días seguidos',
};

class TarjetaCupo extends ConsumerWidget {
  const TarjetaCupo({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final estado = ref.watch(estadoUsuarioProvider);
    if (estado.hasError) {
      return EstadoError(
        error: estado.error!,
        mensaje: 'No se pudo cargar tu cupo de hoy.',
        alReintentar: () => ref
          ..invalidate(cupoDeHoyProvider)
          ..invalidate(suscripcionActualProvider),
      );
    }
    final usuario = estado.value;
    if (usuario == null) return const EsqueletoTarjeta();
    final secundario = TemaSuperaPaes.pequeno.copyWith(
      color: TemaSuperaPaes.textoSecundario,
    );
    final nombres = ref.watch(opcionesPerfilProvider).value;
    return Tarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (usuario.todasIncluidas) ...[
            const Text('Practicas sin límite', style: TemaSuperaPaes.h2),
            const SizedBox(height: TemaSuperaPaes.espacio8),
            Text(
              'Plan Todas las pruebas, '
              '${usuario.enMora ? 'con pago pendiente' : 'activo'}.',
              style: secundario,
            ),
            const SizedBox(height: TemaSuperaPaes.espacio12),
            Wrap(
              spacing: TemaSuperaPaes.espacio8,
              children: [
                for (final p in Prueba.values) SelloPrueba(p, tamano: 24),
              ],
            ),
          ] else ...[
            Text(
              'Tus preguntas de hoy',
              style: TemaSuperaPaes.etiqueta.copyWith(
                color: TemaSuperaPaes.textoSecundario,
              ),
            ),
            const SizedBox(height: TemaSuperaPaes.espacio4),
            Wrap(
              spacing: TemaSuperaPaes.espacio8,
              crossAxisAlignment: WrapCrossAlignment.end,
              children: [
                ContadorAnimado(
                  valor: usuario.cupoRestante,
                  estilo: TemaSuperaPaes.numero,
                ),
                Text(
                  'disponibles · ${usuario.cupo.usadas} de '
                  '${usuario.cupo.maximo} usadas',
                  style: secundario,
                ),
              ],
            ),
            const SizedBox(height: TemaSuperaPaes.espacio8),
            BarraAnimada(
              valor: usuario.cupo.maximo <= 0
                  ? 0
                  : usuario.cupoRestante / usuario.cupo.maximo,
              etiquetaSemantica:
                  '${usuario.cupoRestante} de ${usuario.cupo.maximo} '
                  'disponibles',
            ),
            const SizedBox(height: TemaSuperaPaes.espacio8),
            Text('Se reinicia a las 00:00 (hora de Chile)', style: secundario),
            if (usuario.bonos > 0)
              Padding(
                padding: const EdgeInsets.only(top: TemaSuperaPaes.espacio8),
                child: Text(
                  'Extra: ${usuario.bonos}',
                  style: TemaSuperaPaes.cuerpoFuerte,
                ),
              ),
            if (usuario.suscripcion?.coberturaVigente == true) ...[
              const SizedBox(height: TemaSuperaPaes.espacio8),
              Text(
                'El cupo se usa solo en las demás pruebas.',
                style: secundario,
              ),
              for (final id in usuario.suscripcion!.pruebasIncluidas)
                Text(
                  '${nombres?.prueba(id)?.nombreCorto ?? 'Prueba'} '
                  'incluida en tu plan · sin límite',
                  style: secundario,
                ),
            ],
            if (usuario.cupo.agotado) ...[
              const SizedBox(height: TemaSuperaPaes.espacio12),
              const Text(
                'Por hoy completaste tu cupo',
                style: TemaSuperaPaes.h2,
              ),
              CuentaRegresivaCupo(reiniciaEn: usuario.cupo.reiniciaEn),
              TextButton(
                onPressed: () => context.push(Rutas.cupoAgotado),
                child: const Text('Ver cómo seguir hoy'),
              ),
            ],
          ],
          if (usuario.enMora) ...[
            const SizedBox(height: TemaSuperaPaes.espacio12),
            const Aviso(
              tono: TonoAviso.info,
              texto:
                  'No pudimos cobrar la renovación. Mantienes tu plan '
                  'mientras la tienda reintenta.',
            ),
            TextButton(
              onPressed: () => context.push(Rutas.miSuscripcion),
              child: const Text('Ver mi suscripción'),
            ),
          ],
        ],
      ),
    );
  }
}
