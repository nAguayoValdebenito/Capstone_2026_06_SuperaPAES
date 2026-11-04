import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/dominio/entidades/plan.dart';
import 'package:supera_paes/dominio/entidades/suscripcion_vigente.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/error_con_reintento.dart';
import 'package:supera_paes/presentacion/comunes/estados.dart';
import 'package:supera_paes/presentacion/comunes/hoja_confirmacion.dart';
import 'package:supera_paes/presentacion/inicio/pruebas_inicio.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
import 'package:supera_paes/presentacion/planes/estado_planes.dart';

/// Planes (A43; HU-43, CU-12 pasos 1 a 3, RN-05): mensual o anual, lo que
/// incluye cada uno y su precio. Las suscripciones solo agregan preguntas y
/// evaluaciones: el progreso es igual en todos. Sin cuentas de tiendas no hay
/// compra: elegir un plan avisa el modo de prueba y no contrata nada.
class PantallaPlanes extends ConsumerStatefulWidget {
  const PantallaPlanes({super.key});

  @override
  ConsumerState<PantallaPlanes> createState() => _PantallaPlanesState();
}

class _PantallaPlanesState extends ConsumerState<PantallaPlanes> {
  bool _anual = true;

  @override
  Widget build(BuildContext context) {
    final planes = ref.watch(planesProvider);
    final actual = ref.watch(suscripcionActualProvider).value;
    return PantallaFormulario(
      separacion: 12,
      hijos: [
        const EnlaceVolver(texto: 'Volver', destino: Rutas.perfil),
        const Encabezado(titulo: 'Planes'),
        SelectorSegmentado<bool>(
          opciones: const [(false, 'Mensual'), (true, 'Anual')],
          seleccionado: _anual,
          onChanged: (anual) => setState(() => _anual = anual),
        ),
        if (_anual)
          Text(
            'El plan anual da 12 meses de acceso al precio de 8.',
            style: TemaSuperaPaes.pequeno.copyWith(
              color: TemaSuperaPaes.textoSecundario,
            ),
          ),
        _TarjetaGratis(esTuPlan: actual == null),
        ...switch (planes) {
          AsyncData(value: final List<PlanOfrecido> lista) => _planes(
            lista,
            actual,
          ),
          AsyncError(:final error) => [
            ErrorConReintento(
              error: error,
              mensaje: 'No pudimos cargar los planes.',
              alReintentar: () => ref.invalidate(planesProvider),
            ),
          ],
          _ => const [EsqueletoTarjeta(lineas: 4), EsqueletoTarjeta(lineas: 4)],
        },
      ],
    );
  }

  List<Widget> _planes(List<PlanOfrecido> lista, SuscripcionVigente? actual) {
    final delPeriodo = lista.where((plan) => plan.esAnual == _anual);
    final delOtro = lista.where((plan) => plan.esAnual != _anual);
    return [
      for (final plan in delPeriodo)
        _TarjetaPlan(
          plan: plan,
          esTuPlan:
              actual?.plan == plan.alcanceNombre &&
              actual?.periodicidad == plan.periodicidad,
        ),
      Text(
        _nota(delOtro),
        style: TemaSuperaPaes.pequeno.copyWith(
          color: TemaSuperaPaes.textoSecundario,
        ),
      ),
    ];
  }

  /// La nota del pie, con los precios de la otra periodicidad.
  String _nota(Iterable<PlanOfrecido> otros) {
    final precios = [
      for (final plan in otros) '${plan.alcanceNombre} ${plan.precio}',
    ].join(' y ');
    return 'Tu progreso es el mismo con cualquier plan. '
        '${_anual ? 'Mensual' : 'Anual'}: $precios. '
        'Pagas con Google Play o App Store, en modo de prueba y sin dinero '
        'real. El plan anual se renueva solo y te avisamos por correo 7 días '
        'antes. Cancelas desde la tienda.';
  }
}

class _Beneficio extends StatelessWidget {
  const _Beneficio(this.texto);

  final String texto;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const ExcludeSemantics(
            child: Icon(Icons.check, size: 20, color: TemaSuperaPaes.exito),
          ),
          const SizedBox(width: 8),
          Expanded(child: Text(texto, style: TemaSuperaPaes.pequeno)),
        ],
      ),
    );
  }
}

/// El nombre a la izquierda y, a la derecha, el precio o «Tu plan». Baja de
/// línea con letra grande (RNF-12).
class _Cabecera extends StatelessWidget {
  const _Cabecera({required this.nombre, required this.lado});

  final String nombre;
  final Widget lado;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 8,
      runSpacing: 4,
      children: [
        Text(nombre, style: TemaSuperaPaes.h2),
        lado,
      ],
    );
  }
}

class _TarjetaGratis extends StatelessWidget {
  const _TarjetaGratis({required this.esTuPlan});

  final bool esTuPlan;

  @override
  Widget build(BuildContext context) {
    return Tarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _Cabecera(
            nombre: 'Gratis',
            lado: esTuPlan
                ? const Etiqueta(texto: 'Tu plan')
                : const SizedBox.shrink(),
          ),
          const _Beneficio(
            '10 preguntas al día, 20 con el correo verificado, más tus '
            'preguntas extra',
          ),
          const _Beneficio('1 mini-ensayo al mes por prueba'),
          const _Beneficio('Repaso de tus 10 falladas más recientes'),
        ],
      ),
    );
  }
}

class _TarjetaPlan extends ConsumerStatefulWidget {
  const _TarjetaPlan({required this.plan, required this.esTuPlan});

  final PlanOfrecido plan;
  final bool esTuPlan;

  @override
  ConsumerState<_TarjetaPlan> createState() => _TarjetaPlanState();
}

class _TarjetaPlanState extends ConsumerState<_TarjetaPlan> {
  int? _pruebaId;

  /// Sin comprar: no hay cuentas de tiendas (decidido por Sebastian, 04/11).
  Future<void> _elegir(String? prueba) async {
    final plan = widget.plan;
    final periodo = plan.esAnual ? 'año' : 'mes';
    final detalle = [plan.alcanceNombre, ?prueba].join(' · ');
    await mostrarHoja<bool>(
      context,
      HojaConfirmacion(
        titulo: 'Modo de prueba',
        contenido: Text(
          'Por ahora, en esta versión no se realizan compras. Elegiste '
          '$detalle, ${plan.precio} al $periodo.',
          style: TemaSuperaPaes.cuerpo.copyWith(
            color: TemaSuperaPaes.textoSecundario,
          ),
        ),
        confirmar: 'Entendido',
        cancelar: 'Ver otros planes',
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final plan = widget.plan;
    final perfil = ref.watch(perfilProvider).value;
    final nombres = ref.watch(opcionesPerfilProvider).value;
    final pruebas = perfil == null || nombres == null
        ? const <PruebaDeInicio>[]
        : pruebasDeInicio(perfil, nombres);
    final pruebaId = _pruebaId ?? pruebas.firstOrNull?.id;
    final nombre = pruebaId == null
        ? null
        : nombres?.prueba(pruebaId)?.nombreEnInicio;
    final todas = !plan.esUnaPrueba;
    return Tarjeta(
      borde: todas ? TemaSuperaPaes.primario : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _Cabecera(
            nombre: plan.alcanceNombre,
            lado: widget.esTuPlan
                ? const Etiqueta(texto: 'Tu plan')
                : Text(
                    '${plan.precio} /${plan.esAnual ? 'año' : 'mes'}',
                    style: TemaSuperaPaes.cuerpoFuerte.copyWith(
                      color: TemaSuperaPaes.primario,
                    ),
                  ),
          ),
          if (todas) ...const [
            _Beneficio(
              'Práctica y mini-ensayos sin límite en todas las pruebas',
            ),
            _Beneficio('Ensayos completos con puntaje estimado'),
            _Beneficio('Repaso de todos tus errores'),
          ] else ...[
            const _Beneficio(
              'Práctica y mini-ensayos sin límite en la prueba que elijas',
            ),
            if (pruebas.isNotEmpty) ...[
              const SizedBox(height: 12),
              CampoConEtiqueta(
                etiqueta: 'Prueba',
                child: DropdownButtonFormField<int>(
                  initialValue: pruebaId,
                  isExpanded: true,
                  items: [
                    for (final prueba in pruebas)
                      DropdownMenuItem(
                        value: prueba.id,
                        child: Text(
                          nombres?.prueba(prueba.id)?.nombreEnInicio ??
                              prueba.titulo,
                        ),
                      ),
                  ],
                  onChanged: (id) => setState(() => _pruebaId = id),
                ),
              ),
            ],
          ],
          if (!widget.esTuPlan) ...[
            const SizedBox(height: 12),
            FilledButton(
              style: todas
                  ? null
                  : FilledButton.styleFrom(
                      backgroundColor: TemaSuperaPaes.primarioSuave,
                      foregroundColor: TemaSuperaPaes.primario,
                    ),
              onPressed: () => _elegir(todas ? null : nombre),
              child: Text('Elegir ${plan.alcanceNombre}'),
            ),
          ],
        ],
      ),
    );
  }
}
