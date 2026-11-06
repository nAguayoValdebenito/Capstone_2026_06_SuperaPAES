import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/plan.dart';
import 'package:supera_paes/dominio/entidades/suscripcion_vigente.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/error_con_reintento.dart';
import 'package:supera_paes/presentacion/comunes/estados.dart';
import 'package:supera_paes/presentacion/mis_datos/estado_mis_datos.dart';
import 'package:supera_paes/presentacion/planes/estado_planes.dart';
import 'package:supera_paes/presentacion/progreso/tarjetas_progreso.dart';

/// Mi suscripción (A44, y A46 en mora; HU-43 esc. 3, HU-45, CU-12 1.a y 4.b):
/// plan, estado, periodicidad, renovación y tienda. Cancelar abre la gestión
/// de la tienda, que es la única que puede hacerlo (RN-05). Cambiar de plan
/// lleva a los planes. En el plan Gratis, invita a verlos.
class PantallaMiSuscripcion extends ConsumerWidget {
  const PantallaMiSuscripcion({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final suscripcion = ref.watch(suscripcionActualProvider);
    return switch (suscripcion) {
      AsyncData(value: final SuscripcionVigente vigente) => _Detalle(
        suscripcion: vigente,
      ),
      AsyncData() => const _PlanGratis(),
      AsyncError(:final error) => PantallaFormulario(
        hijos: [
          const EnlaceVolver(texto: 'Volver', destino: Rutas.perfil),
          ErrorConReintento(
            error: error,
            mensaje: 'No pudimos cargar tu suscripción.',
            alReintentar: () => ref.invalidate(suscripcionActualProvider),
          ),
        ],
      ),
      _ => const PantallaFormulario(
        hijos: [SizedBox(height: 32), EsqueletoTarjeta(lineas: 4)],
      ),
    };
  }
}

class _PlanGratis extends StatelessWidget {
  const _PlanGratis();

  @override
  Widget build(BuildContext context) {
    return PantallaFormulario(
      hijos: [
        const EnlaceVolver(texto: 'Volver', destino: Rutas.perfil),
        const SizedBox(height: 32),
        EstadoVacio(
          titulo: 'Estás en el plan Gratis',
          texto:
              'Con un plan tienes más preguntas y evaluaciones. Tu progreso es '
              'el mismo con cualquier plan.',
          accion: 'Ver planes',
          alTocar: () => unawaited(context.push(Rutas.planes)),
        ),
      ],
    );
  }
}

class _Detalle extends ConsumerStatefulWidget {
  const _Detalle({required this.suscripcion});

  final SuscripcionVigente suscripcion;

  @override
  ConsumerState<_Detalle> createState() => _DetalleState();
}

class _DetalleState extends ConsumerState<_Detalle> {
  String? _error;

  /// Solo la tienda puede cancelar (CU-12 1.a).
  Future<void> _abrirTienda() async {
    final suscripcion = widget.suscripcion;
    bool abierta;
    try {
      abierta = await ref.read(abrirEnlaceProvider)(
        enlaceDeGestion(suscripcion),
      );
    } on Exception {
      abierta = false;
    }
    if (!abierta && mounted) {
      setState(
        () => _error =
            'No se pudo abrir ${suscripcion.tienda.nombre}. Hazlo desde la app '
            'de la tienda.',
      );
    }
  }

  /// «Mensual · $2.990»: el precio llega con los planes.
  String _periodicidad(List<PlanOfrecido>? planes) {
    final suscripcion = widget.suscripcion;
    final nombre = suscripcion.periodicidad == 'anual' ? 'Anual' : 'Mensual';
    final plan = planes
        ?.where(
          (plan) =>
              plan.alcanceNombre == suscripcion.plan &&
              plan.periodicidad == suscripcion.periodicidad,
        )
        .firstOrNull;
    return plan == null ? nombre : '$nombre · ${plan.precio}';
  }

  @override
  Widget build(BuildContext context) {
    final suscripcion = widget.suscripcion;
    final tienda = suscripcion.tienda.nombre;
    final fin = suscripcion.periodoFin;
    final planes = ref.watch(planesProvider).value;
    final secundario = TemaSuperaPaes.pequeno.copyWith(
      color: TemaSuperaPaes.textoSecundario,
    );
    return PantallaFormulario(
      separacion: 14,
      hijos: [
        const EnlaceVolver(texto: 'Volver', destino: Rutas.perfil),
        const Encabezado(titulo: 'Mi suscripción'),
        if (suscripcion.enMora)
          Aviso(
            tono: TonoAviso.aviso,
            texto:
                'No se pudo cobrar la renovación. Mantienes tu plan mientras '
                'la tienda reintenta. Revisa tu medio de pago en $tienda.',
          ),
        Tarjeta(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Wrap(
                alignment: WrapAlignment.spaceBetween,
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 8,
                runSpacing: 4,
                children: [
                  Text(suscripcion.plan, style: TemaSuperaPaes.h2),
                  Etiqueta(
                    texto: suscripcion.enMora ? 'En mora' : 'Activa',
                    tono: suscripcion.enMora
                        ? TonoEtiqueta.aviso
                        : TonoEtiqueta.exito,
                  ),
                ],
              ),
              _Dato('Periodicidad', _periodicidad(planes)),
              if (fin != null)
                _Dato(
                  suscripcion.renuevaAutomaticamente
                      ? 'Próxima renovación'
                      : 'Termina el',
                  fechaLarga(fin),
                ),
              _Dato('Pagas con', tienda),
              const SizedBox(height: 8),
              Text('Modo de prueba: sin dinero real', style: secundario),
            ],
          ),
        ),
        if (!suscripcion.enMora)
          ListaDeFilas(
            filas: [
              if (suscripcion.periodicidad == 'mensual')
                FilaNavegacion(
                  texto: 'Cambiar a anual',
                  onTap: () => context.push(Rutas.planes),
                ),
              FilaNavegacion(
                texto: 'Cambiar de plan',
                onTap: () => context.push(Rutas.planes),
              ),
            ],
          ),
        if (!suscripcion.enMora)
          Text(
            'Los cambios rigen en cuanto la tienda los confirma. La tienda '
            'cobra o abona la diferencia del período.',
            style: secundario,
          ),
      ],
      pie: PieConError(
        error: _error,
        boton: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            OutlinedButton(
              onPressed: _abrirTienda,
              child: Text(
                suscripcion.renuevaAutomaticamente
                    ? 'Cancelar suscripción en $tienda'
                    : 'Ver en $tienda',
              ),
            ),
            if (fin != null && suscripcion.renuevaAutomaticamente) ...[
              const SizedBox(height: 8),
              Text(
                'Si cancelas, mantienes el plan hasta el ${fechaLarga(fin)}.',
                style: secundario,
                textAlign: TextAlign.center,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Texto gris a la izquierda y su valor a la derecha. Baja de línea con letra
/// grande (RNF-12).
class _Dato extends StatelessWidget {
  const _Dato(this.nombre, this.valor);

  final String nombre;
  final String valor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        spacing: 8,
        children: [
          Text(
            nombre,
            style: TemaSuperaPaes.pequeno.copyWith(
              color: TemaSuperaPaes.textoSecundario,
            ),
          ),
          Text(valor, style: TemaSuperaPaes.pequenoFuerte),
        ],
      ),
    );
  }
}
