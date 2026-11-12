import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/dominio/entidades/plan.dart';
import 'package:supera_paes/dominio/entidades/suscripcion_vigente.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/animados.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/error_con_reintento.dart';
import 'package:supera_paes/presentacion/comunes/estado_cuenta.dart';
import 'package:supera_paes/presentacion/comunes/estados.dart';
import 'package:supera_paes/presentacion/comunes/hoja_confirmacion.dart';
import 'package:supera_paes/presentacion/comunes/sello_prueba.dart';
import 'package:supera_paes/presentacion/inicio/pruebas_inicio.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
import 'package:supera_paes/presentacion/planes/estado_planes.dart';
import 'package:supera_paes/presentacion/planes/modo_de_prueba.dart';
import 'package:supera_paes/presentacion/planes/pantalla_mi_suscripcion.dart';

/// Planes (A43; HU-43, CU-12 pasos 1 a 3, RN-05): mensual o anual, lo que
/// incluye cada uno y su precio. Las suscripciones solo agregan preguntas y
/// evaluaciones: el progreso es igual en todos. Sin cuentas de tiendas no hay
/// compra: elegir un plan avisa el modo de prueba y no contrata nada. Con un
/// plan, el otro se ofrece como cambio (A45).
class PantallaPlanes extends ConsumerStatefulWidget {
  const PantallaPlanes({super.key});

  @override
  ConsumerState<PantallaPlanes> createState() => _PantallaPlanesState();
}

class _PantallaPlanesState extends ConsumerState<PantallaPlanes> {
  /// Sin elegir, la periodicidad del plan actual; en Gratis, mensual.
  bool? _anual;

  @override
  Widget build(BuildContext context) {
    final planes = ref.watch(planesProvider);
    final actual = ref.watch(suscripcionActualProvider).value;
    final anual = _anual ?? actual?.periodicidad == 'anual';
    final secundario = TemaSuperaPaes.pequeno.copyWith(
      color: TemaSuperaPaes.textoSecundario,
    );
    return PantallaFormulario(
      separacion: 12,
      hijos: [
        const EnlaceVolver(texto: 'Volver', destino: Rutas.perfil),
        const Encabezado(
          titulo: 'Planes',
          bajada: 'Tu progreso es el mismo con cualquier plan.',
        ),
        SelectorSegmentado<bool>(
          conMovimiento: true,
          opciones: const [(false, 'Mensual'), (true, 'Anual')],
          seleccionado: anual,
          onChanged: (valor) => setState(() => _anual = valor),
        ),
        Cambiante(
          clave: anual,
          child: _LineaPeriodo(anual: anual),
        ),
        ...switch (planes) {
          AsyncData(value: final List<PlanOfrecido> lista) => [
            // «Todas las pruebas», el recomendado, va primero (A43).
            for (final (i, plan) in [
              ...lista.where((p) => p.esAnual == anual && !p.esUnaPrueba),
              ...lista.where((p) => p.esAnual == anual && p.esUnaPrueba),
            ].indexed)
              AparecerEscalonado(
                indice: i,
                child: _TarjetaPlan(plan: plan, actual: actual),
              ),
          ],
          AsyncError(:final error) => [
            ErrorConReintento(
              error: error,
              mensaje: 'No pudimos cargar los planes.',
              alReintentar: () => ref.invalidate(planesProvider),
            ),
          ],
          _ => const [
            GrupoEsqueleto(
              child: Column(
                children: [
                  EsqueletoTarjeta(lineas: 4),
                  SizedBox(height: TemaSuperaPaes.espacio12),
                  EsqueletoTarjeta(lineas: 4),
                ],
              ),
            ),
          ],
        },
        if (actual == null) const _TarjetaGratis(),
        Text(
          'La suscripción se renueva automáticamente. Puedes cancelarla en '
          'cualquier momento en Google Play o en la App Store. En el plan '
          'anual te avisamos por correo 7 días antes de renovar. Versión de '
          'prueba: las compras no generan cobros reales.',
          style: secundario,
        ),
      ],
    );
  }
}

/// «Pagas mes a mes…» o «El plan anual da 12 meses…», con su ícono.
class _LineaPeriodo extends StatelessWidget {
  const _LineaPeriodo({required this.anual});

  final bool anual;

  @override
  Widget build(BuildContext context) {
    return Row(
      key: ValueKey(anual),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ExcludeSemantics(
          child: Icon(
            anual ? Icons.savings_rounded : Icons.calendar_month_rounded,
            size: 18,
            color: TemaSuperaPaes.primario,
          ),
        ),
        const SizedBox(width: TemaSuperaPaes.espacio8),
        Expanded(
          child: Text(
            anual
                ? 'El plan anual da 12 meses de acceso al precio de 8.'
                : 'Pagas mes a mes y cancelas cuando quieras.',
            style: TemaSuperaPaes.pequenoFuerte.copyWith(
              color: TemaSuperaPaes.primarioOscuro,
            ),
          ),
        ),
      ],
    );
  }
}

/// Gratis solo se muestra mientras es el plan del estudiante.
class _TarjetaGratis extends ConsumerWidget {
  const _TarjetaGratis();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final verificado =
        ref.watch(
          sesionProvider.select(
            (sesion) => sesion.value?.estudiante.correoVerificado,
          ),
        ) ??
        false;
    return Tarjeta(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Gratis', style: TemaSuperaPaes.h2),
                const SizedBox(height: TemaSuperaPaes.espacio4),
                Text(
                  '${verificado ? 20 : 10} preguntas al día, 1 mini-ensayo al '
                  'mes por prueba y repaso de 10.',
                  style: TemaSuperaPaes.pequeno.copyWith(
                    color: TemaSuperaPaes.textoSecundario,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: TemaSuperaPaes.espacio8),
          const Text('Tu plan', style: TemaSuperaPaes.pequenoFuerte),
        ],
      ),
    );
  }
}

class _TarjetaPlan extends ConsumerWidget {
  const _TarjetaPlan({required this.plan, required this.actual});

  final PlanOfrecido plan;
  final SuscripcionVigente? actual;

  bool get _esTuPlan =>
      actual?.plan == plan.alcanceNombre &&
      actual?.periodicidad == plan.periodicidad;

  /// Sin plan: elegir avisa el modo de prueba (decidido por Sebastian,
  /// 04/11). «Una prueba» pregunta antes cuál. Con plan: abre A45.
  Future<void> _elegir(
    BuildContext context,
    List<PruebaDeInicio> pruebas,
    OpcionesPerfil? nombres,
  ) async {
    if (actual != null) {
      unawaited(context.push(Rutas.cambiarPlan, extra: plan));
      return;
    }
    if (!plan.esUnaPrueba) {
      await avisarModoDePrueba(context, plan.alcanceNombre);
      return;
    }
    final pruebaId = await mostrarHoja<int>(
      context,
      _HojaElegirPrueba(pruebas: pruebas, nombres: nombres),
    );
    if (pruebaId == null || !context.mounted) return;
    final nombre =
        nombres?.prueba(pruebaId)?.nombreEnInicio ??
        pruebas.firstWhere((p) => p.id == pruebaId).titulo;
    await avisarModoDePrueba(context, '${plan.alcanceNombre} ($nombre)');
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final perfil = ref.watch(perfilProvider).value;
    final nombres = ref.watch(opcionesPerfilProvider).value;
    final pruebas = perfil == null || nombres == null
        ? const <PruebaDeInicio>[]
        : pruebasDeInicio(perfil, nombres);
    final todas = !plan.esUnaPrueba;
    final esTuPlan = _esTuPlan;
    final incluidas = actual?.alcance == 'una_prueba'
        ? actual!.pruebasIncluidas
        : [for (final prueba in pruebas) prueba.id];
    final sellos = todas
        ? Prueba.values
        : [
            for (final id in incluidas)
              if (nombres?.prueba(id)?.codigo case final codigo?)
                Prueba.deCodigo(codigo),
          ];
    final destacada = esTuPlan || (todas && actual == null);
    final accion =
        '${actual == null ? 'Elegir' : 'Cambiar a'} ${plan.alcanceNombre}';
    return Tarjeta(
      borde: destacada ? TemaSuperaPaes.primario : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: TemaSuperaPaes.espacio8,
            runSpacing: TemaSuperaPaes.espacio4,
            children: [
              Text(plan.alcanceNombre, style: TemaSuperaPaes.h2),
              if (esTuPlan)
                const Etiqueta(
                  texto: 'Tu plan',
                  icono: Icons.check_circle_rounded,
                )
              else if (todas)
                const Etiqueta(texto: 'Recomendado', icono: Icons.star_rounded),
            ],
          ),
          if (sellos.isNotEmpty) ...[
            const SizedBox(height: TemaSuperaPaes.espacio8),
            Wrap(
              spacing: TemaSuperaPaes.espacio8,
              runSpacing: TemaSuperaPaes.espacio8,
              children: [
                for (final prueba in sellos) SelloPrueba(prueba, tamano: 28),
              ],
            ),
          ],
          const SizedBox(height: TemaSuperaPaes.espacio12),
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.end,
            spacing: TemaSuperaPaes.espacio8,
            children: [
              Text(
                plan.precio,
                style: TemaSuperaPaes.tabular(
                  TemaSuperaPaes.h1.copyWith(
                    fontSize: 30,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Text(
                  plan.esAnual ? 'al año' : 'al mes',
                  style: TemaSuperaPaes.pequeno.copyWith(
                    color: TemaSuperaPaes.textoSecundario,
                  ),
                ),
              ),
            ],
          ),
          if (todas) ...const [
            Beneficio(
              'Práctica y mini-ensayos sin límite en todas las pruebas',
            ),
            Beneficio('Ensayos completos con puntaje estimado'),
            Beneficio('Repaso de todos tus errores'),
          ] else
            const Beneficio(
              'Práctica y mini-ensayos sin límite en la prueba que elijas',
            ),
          if (!esTuPlan) ...[
            const SizedBox(height: TemaSuperaPaes.espacio16),
            if (destacada)
              FilledButton(
                onPressed: () => _elegir(context, pruebas, nombres),
                child: Text(accion),
              )
            else
              OutlinedButton(
                onPressed: () => _elegir(context, pruebas, nombres),
                child: Text(accion),
              ),
          ],
        ],
      ),
    );
  }
}

/// «¿Qué prueba incluye tu plan?»: las pruebas del perfil con su sello.
/// Devuelve el id de la elegida.
class _HojaElegirPrueba extends StatefulWidget {
  const _HojaElegirPrueba({required this.pruebas, required this.nombres});

  final List<PruebaDeInicio> pruebas;
  final OpcionesPerfil? nombres;

  @override
  State<_HojaElegirPrueba> createState() => _HojaElegirPruebaState();
}

class _HojaElegirPruebaState extends State<_HojaElegirPrueba> {
  late int? _elegida = widget.pruebas.firstOrNull?.id;

  String _nombre(PruebaDeInicio prueba) =>
      widget.nombres?.prueba(prueba.id)?.nombreEnInicio ?? prueba.titulo;

  @override
  Widget build(BuildContext context) {
    final elegida = widget.pruebas
        .where((prueba) => prueba.id == _elegida)
        .firstOrNull;
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(
          TemaSuperaPaes.margenPantalla,
          0,
          TemaSuperaPaes.margenPantalla,
          TemaSuperaPaes.margenPantalla,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Semantics(
              header: true,
              child: const Text(
                '¿Qué prueba incluye tu plan?',
                style: TemaSuperaPaes.numero,
              ),
            ),
            const SizedBox(height: TemaSuperaPaes.espacio8),
            Text(
              'Sin límite en la prueba que elijas. Puedes cambiarla después.',
              style: TemaSuperaPaes.cuerpo.copyWith(
                color: TemaSuperaPaes.textoSecundario,
              ),
            ),
            const SizedBox(height: TemaSuperaPaes.espacio16),
            for (final prueba in widget.pruebas) ...[
              _OpcionPrueba(
                prueba: Prueba.deCodigo(
                  widget.nombres?.prueba(prueba.id)?.codigo ?? '',
                ),
                nombre: _nombre(prueba),
                seleccionada: prueba.id == _elegida,
                onTap: () => setState(() => _elegida = prueba.id),
              ),
              const SizedBox(height: TemaSuperaPaes.espacio8),
            ],
            const SizedBox(height: TemaSuperaPaes.espacio12),
            FilledButton(
              onPressed: elegida == null
                  ? null
                  : () => Navigator.of(context).pop(elegida.id),
              child: Text(
                elegida == null ? 'Elegir' : 'Elegir ${_nombre(elegida)}',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OpcionPrueba extends StatelessWidget {
  const _OpcionPrueba({
    required this.prueba,
    required this.nombre,
    required this.seleccionada,
    required this.onTap,
  });

  final Prueba prueba;
  final String nombre;
  final bool seleccionada;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final radio = BorderRadius.circular(TemaSuperaPaes.radioMedio);
    return Semantics(
      inMutuallyExclusiveGroup: true,
      checked: seleccionada,
      button: true,
      child: Material(
        color: seleccionada
            ? TemaSuperaPaes.primarioSuave
            : TemaSuperaPaes.superficie,
        shape: RoundedRectangleBorder(
          borderRadius: radio,
          side: BorderSide(
            color: seleccionada
                ? TemaSuperaPaes.primario
                : TemaSuperaPaes.borde,
            width: seleccionada ? 2 : 1,
          ),
        ),
        child: InkWell(
          borderRadius: radio,
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(TemaSuperaPaes.espacio12),
            child: Row(
              children: [
                SelloPrueba(prueba, tamano: 32),
                const SizedBox(width: TemaSuperaPaes.espacio12),
                Expanded(
                  child: Text(nombre, style: TemaSuperaPaes.cuerpoFuerte),
                ),
                if (seleccionada)
                  const ExcludeSemantics(
                    child: Icon(
                      Icons.check_circle_rounded,
                      color: TemaSuperaPaes.primario,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
