import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/inicio/estado_inicio.dart';
import 'package:supera_paes/presentacion/inicio/pruebas_inicio.dart';
import 'package:supera_paes/presentacion/practicar/con_datos_practica.dart';
import 'package:supera_paes/presentacion/practicar/empezar_practica.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';

/// Pestaña Practicar: personaliza la práctica (A13; HU-30 esc. 1 a 3,
/// RF-A06, CU-06b). La prueba, qué practicar (toda la prueba o un eje,
/// contenido o habilidad, que se eligen en A14), la dificultad o la mezcla y
/// la cantidad, con las preguntas que quedan hoy.
class PantallaPersonalizarPractica extends ConsumerStatefulWidget {
  const PantallaPersonalizarPractica({super.key});

  @override
  ConsumerState<PantallaPersonalizarPractica> createState() =>
      _PantallaPersonalizarPracticaState();
}

class _PantallaPersonalizarPracticaState
    extends ConsumerState<PantallaPersonalizarPractica>
    with EmpezarPractica {
  @override
  Widget build(BuildContext context) {
    return ConDatosPractica(builder: _contenido);
  }

  Widget _contenido(DatosDePractica datos) {
    final borrador = ref.watch(borradorPracticaProvider);
    final pruebaId = pruebaElegida(borrador, datos.perfil);
    final prueba = pruebaId == null ? null : datos.opciones.prueba(pruebaId);
    // El alcance del borrador es de su prueba; con otra, toda la prueba.
    final alcance = borrador.pruebaId == pruebaId
        ? borrador.alcance
        : Alcance.todaLaPrueba;
    return PantallaFormulario(
      separacion: 12,
      hijos: [
        const EnlaceVolver(texto: 'Inicio', destino: Rutas.inicio),
        const Encabezado(titulo: 'Personaliza tu práctica'),
        _Seccion(
          titulo: 'Prueba',
          child: _ChipsPrueba(datos: datos, pruebaId: pruebaId),
        ),
        if (prueba != null)
          _Seccion(
            titulo: 'Qué practicar',
            child: _QuePracticar(prueba: prueba, alcance: alcance),
          ),
        _Seccion(
          titulo: 'Dificultad',
          child: _Dificultad(
            dificultades: datos.opciones.dificultades,
            elegida: borrador.dificultadId,
          ),
        ),
        _Seccion(
          titulo: 'Cantidad de preguntas',
          child: _Cantidad(cantidad: borrador.cantidad),
        ),
      ],
      pie: PieConError(
        error: errorEmpezar,
        boton: FilledButton(
          onPressed: pruebaId == null || empezando
              ? null
              : () => empezar(
                  DatosPractica(
                    pruebaId: pruebaId,
                    alcance: alcance,
                    dificultadId: borrador.dificultadId,
                    cantidad: borrador.cantidad,
                  ),
                ),
          child: empezando
              ? const CargandoEnBoton()
              : const Text('Empezar práctica'),
        ),
      ),
    );
  }
}

/// Título de un grupo (Texto/Etiqueta) con su contenido debajo.
class _Seccion extends StatelessWidget {
  const _Seccion({required this.titulo, required this.child});

  final String titulo;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(titulo, style: TemaSuperaPaes.etiqueta),
        const SizedBox(height: 8),
        child,
      ],
    );
  }
}

/// Las pruebas del perfil, con la prueba a reforzar primero («M1 ·
/// reforzar»).
class _ChipsPrueba extends ConsumerWidget {
  const _ChipsPrueba({required this.datos, required this.pruebaId});

  final DatosDePractica datos;
  final int? pruebaId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reforzar = datos.perfil.pruebaReforzarId;
    return GrupoChips(
      chips: [
        for (final (:id, titulo: _, reforzar: _) in pruebasDeInicio(
          datos.perfil,
          datos.nombres,
        ))
          ChipSeleccion(
            texto: [
              datos.nombres.prueba(id)?.nombreCorto ?? '',
              if (id == reforzar) 'reforzar',
            ].join(' · '),
            seleccionado: id == pruebaId,
            onTap: () =>
                ref.read(borradorPracticaProvider.notifier).elegirPrueba(id),
          ),
      ],
    );
  }
}

/// Toda la prueba, o un eje, contenido o habilidad que se elige en A14. Solo
/// se ofrece lo que la prueba tiene para el curso del estudiante.
class _QuePracticar extends ConsumerWidget {
  const _QuePracticar({required this.prueba, required this.alcance});

  final PruebaPractica prueba;
  final Alcance alcance;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hayContenidos = prueba.ejes.any((eje) => eje.contenidos.isNotEmpty);
    final opciones = [
      (TipoAlcance.prueba, 'Toda la prueba'),
      if (prueba.ejes.isNotEmpty) (TipoAlcance.eje, 'Un eje'),
      if (hayContenidos) (TipoAlcance.contenido, 'Un contenido'),
      if (prueba.habilidades.isNotEmpty)
        (TipoAlcance.habilidad, 'Una habilidad'),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (i, (tipo, texto)) in opciones.indexed) ...[
          if (i > 0) const SizedBox(height: 8),
          OpcionRadio(
            texto: texto,
            seleccionada: alcance.tipo == tipo,
            detalle: alcance.tipo == tipo ? alcance.nombre : null,
            onTap: () async {
              final borrador = ref.read(borradorPracticaProvider.notifier)
                ..elegirPrueba(prueba.id);
              if (tipo == TipoAlcance.prueba) {
                borrador.elegirAlcance(Alcance.todaLaPrueba);
              } else {
                await context.push('${Rutas.elegirAlcance}?tipo=${tipo.name}');
              }
            },
          ),
        ],
      ],
    );
  }
}

/// La mezcla equilibrada o una dificultad (HU-30 esc. 2, RN-09).
class _Dificultad extends ConsumerWidget {
  const _Dificultad({required this.dificultades, required this.elegida});

  final List<Dificultad> dificultades;
  final int? elegida;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final nombre = [
      for (final dificultad in dificultades)
        if (dificultad.id == elegida) dificultad.nombre,
    ].firstOrNull;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SelectorSegmentado<int?>(
          opciones: [
            (null, 'Mezcla'),
            for (final dificultad in dificultades)
              (dificultad.id, dificultad.nombre),
          ],
          seleccionado: elegida,
          onChanged: (id) =>
              ref.read(borradorPracticaProvider.notifier).elegirDificultad(id),
        ),
        const SizedBox(height: 8),
        Text(
          nombre == null
              ? 'Mezcla equilibrada: ${_mezcla(dificultades)}.'
              : 'Solo preguntas de dificultad ${nombre.toLowerCase()}.',
          style: TemaSuperaPaes.pequeno.copyWith(
            color: TemaSuperaPaes.textoSecundario,
          ),
        ),
      ],
    );
  }

  /// «30 % fácil, 45 % media y 25 % difícil», con los valores de la base.
  static String _mezcla(List<Dificultad> dificultades) {
    final partes = [
      for (final d in dificultades) '${d.mezcla} % ${d.nombre.toLowerCase()}',
    ];
    if (partes.length < 2) return partes.join();
    return '${partes.sublist(0, partes.length - 1).join(', ')} y '
        '${partes.last}';
  }
}

/// De 5 a 20 preguntas, sugiere 10 (HU-30 esc. 3), con las que quedan hoy.
class _Cantidad extends ConsumerWidget {
  const _Cantidad({required this.cantidad});

  final int cantidad;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final borrador = ref.read(borradorPracticaProvider.notifier);
    final cupo = ref.watch(cupoDeHoyProvider).value;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            _BotonRedondo(
              icono: Icons.remove,
              tooltip: 'Menos preguntas',
              onPressed: cantidad > BorradorPractica.cantidadMinima
                  ? () => borrador.cambiarCantidad(-1)
                  : null,
            ),
            const SizedBox(width: 12),
            Column(
              children: [
                Text('$cantidad', style: TemaSuperaPaes.numero),
                Text(
                  'de ${BorradorPractica.cantidadMinima} a '
                  '${BorradorPractica.cantidadMaxima}',
                  style: TemaSuperaPaes.pequeno.copyWith(
                    color: TemaSuperaPaes.textoSecundario,
                  ),
                ),
              ],
            ),
            const SizedBox(width: 12),
            _BotonRedondo(
              icono: Icons.add,
              tooltip: 'Más preguntas',
              onPressed: cantidad < BorradorPractica.cantidadMaxima
                  ? () => borrador.cambiarCantidad(1)
                  : null,
            ),
          ],
        ),
        if (cupo != null) ...[
          const SizedBox(height: 8),
          Text(
            cupo.saldoExtra > 0
                ? 'Hoy te quedan ${cupo.restantes + cupo.saldoExtra} '
                      'preguntas: ${cupo.restantes} del cupo diario y '
                      '${cupo.saldoExtra} extra.'
                : 'Hoy te quedan ${cupo.restantes} preguntas del cupo diario.',
            style: TemaSuperaPaes.pequeno.copyWith(
              color: TemaSuperaPaes.textoSecundario,
            ),
          ),
        ],
      ],
    );
  }
}

/// Botón redondo de 44 con borde, para sumar o restar preguntas.
class _BotonRedondo extends StatelessWidget {
  const _BotonRedondo({
    required this.icono,
    required this.tooltip,
    required this.onPressed,
  });

  final IconData icono;
  final String tooltip;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return IconButton.outlined(
      tooltip: tooltip,
      onPressed: onPressed,
      style: IconButton.styleFrom(
        fixedSize: const Size.square(TemaSuperaPaes.botonRedondo),
        side: const BorderSide(color: TemaSuperaPaes.bordeInput),
        backgroundColor: TemaSuperaPaes.superficie,
        foregroundColor: TemaSuperaPaes.texto,
      ),
      icon: Icon(icono, size: 20),
    );
  }
}
