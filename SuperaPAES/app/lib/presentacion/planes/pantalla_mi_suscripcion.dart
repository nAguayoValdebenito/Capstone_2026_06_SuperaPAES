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
import 'package:supera_paes/presentacion/comunes/fechas.dart';
import 'package:supera_paes/presentacion/comunes/navegar.dart';
import 'package:supera_paes/presentacion/comunes/sello_prueba.dart';
import 'package:supera_paes/presentacion/mis_datos/estado_mis_datos.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
import 'package:supera_paes/presentacion/planes/estado_planes.dart';

/// Mi suscripción (A44, y A46 con el pago pendiente; HU-43 esc. 3, HU-45,
/// CU-12 1.a y 4.b): plan, estado, periodicidad, renovación y tienda.
/// Cancelar abre la gestión de la tienda, que es la única que puede hacerlo
/// (RN-05). «Cambiar de plan» abre A45. En el plan Gratis, invita a ver los
/// planes y resume lo que incluye.
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
          const EnlaceVolver(texto: 'Perfil', destino: Rutas.perfil),
          ErrorConReintento(
            error: error,
            mensaje: 'No pudimos cargar tu suscripción.',
            alReintentar: () => ref.invalidate(suscripcionActualProvider),
          ),
        ],
      ),
      _ => const PantallaFormulario(
        hijos: [
          EnlaceVolver(texto: 'Perfil', destino: Rutas.perfil),
          Encabezado(titulo: 'Mi suscripción'),
          EsqueletoTarjeta(lineas: 4),
        ],
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
        const EnlaceVolver(texto: 'Perfil', destino: Rutas.perfil),
        const SizedBox(height: TemaSuperaPaes.espacio16),
        EstadoVacio(
          titulo: 'Estás en el plan Gratis',
          texto:
              'Con un plan tienes más preguntas y evaluaciones. Tu progreso es '
              'el mismo con cualquier plan.',
          accion: 'Ver planes',
          alTocar: () => abrirPlanes(context),
        ),
        const Tarjeta(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Hoy en Gratis', style: TemaSuperaPaes.h2),
              Beneficio('10 preguntas al día, 20 con el correo verificado'),
              Beneficio('1 mini-ensayo al mes por prueba'),
              Beneficio('Repaso de tus 10 falladas más recientes'),
            ],
          ),
        ),
      ],
    );
  }
}

/// «✓ Ensayos completos con puntaje estimado» (A43 y A44).
class Beneficio extends StatelessWidget {
  const Beneficio(this.texto, {super.key});

  final String texto;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: TemaSuperaPaes.espacio8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const ExcludeSemantics(
            child: Icon(
              Icons.check_rounded,
              size: 18,
              color: TemaSuperaPaes.exito,
            ),
          ),
          const SizedBox(width: TemaSuperaPaes.espacio8),
          Expanded(child: Text(texto, style: TemaSuperaPaes.pequeno)),
        ],
      ),
    );
  }
}

/// «Una prueba · M1» o «Todas las pruebas», con el nombre corto de la prueba
/// incluida cuando se conoce.
String nombreDelPlan(SuscripcionVigente suscripcion, String? prueba) =>
    suscripcion.alcance == 'una_prueba' && prueba != null
    ? '${suscripcion.plan} · $prueba'
    : suscripcion.plan;

/// El plan que se ofrece con el mismo alcance y periodicidad que la
/// suscripción, para mostrar su precio.
PlanOfrecido? planDe(
  SuscripcionVigente suscripcion,
  List<PlanOfrecido>? planes,
) => planes
    ?.where(
      (plan) =>
          plan.alcanceNombre == suscripcion.plan &&
          plan.periodicidad == suscripcion.periodicidad,
    )
    .firstOrNull;

class _Detalle extends ConsumerStatefulWidget {
  const _Detalle({required this.suscripcion});

  final SuscripcionVigente suscripcion;

  @override
  ConsumerState<_Detalle> createState() => _DetalleState();
}

class _DetalleState extends ConsumerState<_Detalle> {
  String? _error;

  /// Solo la tienda puede cancelar o corregir el pago (CU-12 1.a).
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

  @override
  Widget build(BuildContext context) {
    final suscripcion = widget.suscripcion;
    final tienda = suscripcion.tienda.nombre;
    final fin = suscripcion.periodoFin;
    final secundario = TemaSuperaPaes.pequeno.copyWith(
      color: TemaSuperaPaes.textoSecundario,
    );
    final renueva = suscripcion.renuevaAutomaticamente;
    return PantallaFormulario(
      separacion: 16,
      hijos: [
        const EnlaceVolver(texto: 'Perfil', destino: Rutas.perfil),
        const Encabezado(titulo: 'Mi suscripción'),
        if (suscripcion.enMora)
          Aviso(
            tono: TonoAviso.aviso,
            texto:
                'No pudimos cobrar la renovación. Mantienes tu plan mientras '
                'la tienda reintenta. Revisa tu medio de pago en $tienda.',
          ),
        _TarjetaPlan(suscripcion: suscripcion),
        if (suscripcion.enMora)
          FilledButton(
            onPressed: _abrirTienda,
            child: Text('Revisar el pago en $tienda'),
          )
        else
          OutlinedButton(
            onPressed: () => unawaited(context.push(Rutas.cambiarPlan)),
            child: const Text('Cambiar de plan'),
          ),
        Text(
          'Los cambios rigen en cuanto la tienda los confirma. Te avisamos por '
          'correo 7 días antes de renovar un plan anual.',
          style: secundario,
        ),
        if (_error case final mensaje?)
          Aviso(tono: TonoAviso.error, texto: mensaje),
        TextButton(
          onPressed: _abrirTienda,
          child: Text(
            renueva ? 'Cancelar suscripción en $tienda' : 'Ver en $tienda',
            textAlign: TextAlign.center,
          ),
        ),
        if (fin != null && renueva)
          Text(
            'Si cancelas, mantienes el plan hasta el ${fechaConAnio(fin)}.',
            style: secundario,
            textAlign: TextAlign.center,
          ),
      ],
    );
  }
}

/// El plan con su sello, periodicidad y precio, el estado y los datos de la
/// renovación y del pago.
class _TarjetaPlan extends ConsumerWidget {
  const _TarjetaPlan({required this.suscripcion});

  final SuscripcionVigente suscripcion;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final opciones = ref.watch(opcionesPerfilProvider).value;
    final incluida = suscripcion.pruebasIncluidas.firstOrNull;
    final datosPrueba = incluida == null ? null : opciones?.prueba(incluida);
    final plan = planDe(suscripcion, ref.watch(planesProvider).value);
    final periodicidad = suscripcion.periodicidad == 'anual'
        ? 'Anual'
        : 'Mensual';
    final fin = suscripcion.periodoFin;
    return Tarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              if (suscripcion.alcance == 'una_prueba' && datosPrueba != null)
                SelloPrueba(Prueba.deCodigo(datosPrueba.codigo))
              else
                const _SelloTodas(),
              const SizedBox(width: TemaSuperaPaes.espacio12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      nombreDelPlan(suscripcion, datosPrueba?.nombreCorto),
                      style: TemaSuperaPaes.h2,
                    ),
                    Text(
                      plan == null
                          ? periodicidad
                          : '$periodicidad · ${plan.precio}',
                      style: TemaSuperaPaes.pequeno.copyWith(
                        color: TemaSuperaPaes.textoSecundario,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: TemaSuperaPaes.espacio8),
              Etiqueta(
                texto: suscripcion.enMora ? 'En mora' : 'Activa',
                tono: suscripcion.enMora
                    ? TonoEtiqueta.aviso
                    : TonoEtiqueta.exito,
                icono: suscripcion.enMora ? null : Icons.check_rounded,
              ),
            ],
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: TemaSuperaPaes.espacio12),
            child: Divider(height: 1),
          ),
          if (fin != null) ...[
            FilaDato(
              etiqueta: suscripcion.enMora
                  ? 'Se reintenta el cobro'
                  : suscripcion.renuevaAutomaticamente
                  ? 'Próxima renovación'
                  : 'Termina el',
              valor: fechaConAnio(fin),
            ),
            const SizedBox(height: TemaSuperaPaes.espacio12),
          ],
          FilaDato(etiqueta: 'Pagas con', valor: suscripcion.tienda.nombre),
          const SizedBox(height: TemaSuperaPaes.espacio12),
          const Aviso(
            tono: TonoAviso.neutro,
            texto: 'Modo de prueba: sin dinero real.',
          ),
        ],
      ),
    );
  }
}

/// El plan «Todas las pruebas» no tiene una prueba propia: su sello es el
/// ícono del plan sobre el fondo de la marca.
class _SelloTodas extends StatelessWidget {
  const _SelloTodas();

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: TemaSuperaPaes.primarioSuave,
        borderRadius: BorderRadius.circular(TemaSuperaPaes.radioChico),
      ),
      child: const Icon(
        Icons.workspace_premium_rounded,
        size: 24,
        color: TemaSuperaPaes.primario,
      ),
    ),
  );
}
