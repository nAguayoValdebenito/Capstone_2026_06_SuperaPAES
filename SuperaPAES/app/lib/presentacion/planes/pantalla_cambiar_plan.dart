import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supera_paes/dominio/entidades/plan.dart';
import 'package:supera_paes/dominio/entidades/suscripcion_vigente.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/error_con_reintento.dart';
import 'package:supera_paes/presentacion/comunes/estados.dart';
import 'package:supera_paes/presentacion/comunes/fechas.dart';
import 'package:supera_paes/presentacion/comunes/navegar.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
import 'package:supera_paes/presentacion/planes/estado_planes.dart';
import 'package:supera_paes/presentacion/planes/modo_de_prueba.dart';
import 'package:supera_paes/presentacion/planes/pantalla_mi_suscripcion.dart';

/// Cambiar de plan (A45; HU-45, CU-12 4.b): el plan de ahora junto al nuevo
/// y qué cambia. El nuevo llega desde Planes; sin él, es el otro alcance con
/// la misma periodicidad. Sin cuentas de tiendas, confirmar solo avisa el
/// modo de prueba (decidido por Sebastian, 04/11).
class PantallaCambiarPlan extends ConsumerWidget {
  const PantallaCambiarPlan({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final suscripcion = ref.watch(suscripcionActualProvider);
    final planes = ref.watch(planesProvider);
    final pedido = GoRouterState.of(context).extra;
    return switch ((suscripcion, planes)) {
      (
        AsyncData(value: final SuscripcionVigente actual),
        AsyncData(value: final List<PlanOfrecido> lista),
      ) =>
        _Cambio(
          actual: actual,
          ahora: planDe(actual, lista),
          nuevo: pedido is PlanOfrecido ? pedido : _otroPlan(actual, lista),
        ),
      (AsyncData(value: null), _) => PantallaFormulario(
        hijos: [
          const EnlaceVolver(
            texto: 'Mi suscripción',
            destino: Rutas.miSuscripcion,
          ),
          const SizedBox(height: TemaSuperaPaes.espacio16),
          EstadoVacio(
            titulo: 'Estás en el plan Gratis',
            texto: 'Elige un plan para tener más preguntas y evaluaciones.',
            accion: 'Ver planes',
            alTocar: () => abrirPlanes(context),
          ),
        ],
      ),
      (AsyncError(:final error), _) ||
      (_, AsyncError(:final error)) => PantallaFormulario(
        hijos: [
          const EnlaceVolver(
            texto: 'Mi suscripción',
            destino: Rutas.miSuscripcion,
          ),
          ErrorConReintento(
            error: error,
            mensaje: 'No pudimos cargar tu plan.',
            alReintentar: () => ref
              ..invalidate(suscripcionActualProvider)
              ..invalidate(planesProvider),
          ),
        ],
      ),
      _ => const PantallaFormulario(
        hijos: [
          EnlaceVolver(texto: 'Mi suscripción', destino: Rutas.miSuscripcion),
          Encabezado(titulo: 'Cambiar de plan'),
          EsqueletoTarjeta(lineas: 3),
        ],
      ),
    };
  }

  /// El otro alcance con la misma periodicidad.
  static PlanOfrecido? _otroPlan(
    SuscripcionVigente actual,
    List<PlanOfrecido> lista,
  ) => lista
      .where(
        (plan) =>
            plan.alcance != actual.alcance &&
            plan.periodicidad == actual.periodicidad,
      )
      .firstOrNull;
}

class _Cambio extends ConsumerWidget {
  const _Cambio({required this.actual, required this.ahora, this.nuevo});

  final SuscripcionVigente actual;
  final PlanOfrecido? ahora;
  final PlanOfrecido? nuevo;

  /// Qué cambia: subir a todas las pruebas, bajar a una o, con el mismo
  /// alcance, solo la periodicidad.
  String _queCambia(PlanOfrecido nuevo) {
    const rige =
        'El cambio rige en cuanto la tienda lo confirma; la tienda cobra o '
        'abona la diferencia del período.';
    if (nuevo.alcance == actual.alcance) return rige;
    if (!nuevo.esUnaPrueba) {
      return 'Pasas a tener todas las pruebas, ensayos completos y el repaso '
          'de todos tus errores. $rige';
    }
    final fin = actual.periodoFin;
    return 'Pasas a tener una sola prueba incluida.'
        '${fin == null ? '' : ' En iPhone, la bajada rige desde la próxima '
                  'renovación (${fechaConAnio(fin)}).'}';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final nuevo = this.nuevo;
    final opciones = ref.watch(opcionesPerfilProvider).value;
    final incluida = actual.pruebasIncluidas.firstOrNull;
    final prueba = incluida == null
        ? null
        : opciones?.prueba(incluida)?.nombreCorto;
    return PantallaFormulario(
      pie: nuevo == null
          ? null
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                FilledButton(
                  onPressed: () async {
                    final entendido = await avisarModoDePrueba(
                      context,
                      '${nuevo.alcanceNombre}, ${_precio(nuevo)}',
                      cancelar: 'Volver',
                    );
                    if (entendido && context.mounted) {
                      context.go(Rutas.miSuscripcion);
                    }
                  },
                  child: const Text('Confirmar el cambio'),
                ),
                const SizedBox(height: TemaSuperaPaes.espacio8),
                OutlinedButton(
                  onPressed: () => context.go(Rutas.miSuscripcion),
                  child: const Text('Mantener mi plan'),
                ),
              ],
            ),
      hijos: [
        const EnlaceVolver(
          texto: 'Mi suscripción',
          destino: Rutas.miSuscripcion,
        ),
        const Encabezado(titulo: 'Cambiar de plan'),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: _Caja(
                  etiqueta: 'Ahora',
                  nombre: nombreDelPlan(actual, prueba),
                  precio: ahora == null ? null : _precio(ahora!),
                ),
              ),
              const SizedBox(width: TemaSuperaPaes.espacio12),
              Expanded(
                child: _Caja(
                  etiqueta: 'Nuevo',
                  nombre: nuevo?.alcanceNombre ?? 'Sin otro plan',
                  precio: nuevo == null ? null : _precio(nuevo),
                  destacada: true,
                ),
              ),
            ],
          ),
        ),
        if (nuevo != null)
          Aviso(tono: TonoAviso.info, texto: _queCambia(nuevo)),
        Text(
          'Modo de prueba: no se realizan cobros reales.',
          style: TemaSuperaPaes.pequeno.copyWith(
            color: TemaSuperaPaes.textoSecundario,
          ),
        ),
      ],
    );
  }

  /// «$1.990 al mes».
  static String _precio(PlanOfrecido plan) =>
      '${plan.precio} al ${plan.esAnual ? 'año' : 'mes'}';
}

/// «Ahora» y «Nuevo»: el nuevo va con el borde de la marca.
class _Caja extends StatelessWidget {
  const _Caja({
    required this.etiqueta,
    required this.nombre,
    this.precio,
    this.destacada = false,
  });

  final String etiqueta;
  final String nombre;
  final String? precio;
  final bool destacada;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(TemaSuperaPaes.espacio12),
      decoration: BoxDecoration(
        color: TemaSuperaPaes.superficie,
        borderRadius: BorderRadius.circular(TemaSuperaPaes.radioMedio),
        border: Border.all(
          color: destacada ? TemaSuperaPaes.primario : TemaSuperaPaes.borde,
          width: destacada ? 2 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            etiqueta,
            style: TemaSuperaPaes.pequeno.copyWith(
              color: TemaSuperaPaes.textoSecundario,
            ),
          ),
          const SizedBox(height: TemaSuperaPaes.espacio4),
          Text(nombre, style: TemaSuperaPaes.h2),
          if (precio case final precio?) ...[
            const SizedBox(height: TemaSuperaPaes.espacio4),
            Text(precio, style: TemaSuperaPaes.tabular(TemaSuperaPaes.pequeno)),
          ],
        ],
      ),
    );
  }
}
