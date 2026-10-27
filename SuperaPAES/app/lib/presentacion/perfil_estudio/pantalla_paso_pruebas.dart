import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:supera_paes/dominio/entidades/perfil_estudiante.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/perfil_estudio/borrador_perfil.dart';
import 'package:supera_paes/presentacion/perfil_estudio/con_opciones.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
import 'package:supera_paes/presentacion/perfil_estudio/guardar_paso.dart';

/// A10 · Perfil, paso 3: tus pruebas (HU-29 esc. 2 a 5, CU-05 pasos 5 a 7 y
/// 6.a). Marca las sugeridas por las áreas elegidas; Ciencias exige el
/// electivo y la prueba a reforzar es opcional. Guarda el perfil.
class PantallaPasoPruebas extends ConsumerStatefulWidget {
  const PantallaPasoPruebas({super.key});

  @override
  ConsumerState<PantallaPasoPruebas> createState() =>
      _PantallaPasoPruebasState();
}

class _PantallaPasoPruebasState extends ConsumerState<PantallaPasoPruebas>
    with GuardarPaso {
  /// Lo que se revisa antes de enviar; el resto lo revisa la API.
  String? _problema(Borrador borrador, OpcionesPerfil opciones) {
    if (borrador.pruebas.isEmpty) return 'Elige al menos una prueba.';
    final rindeCiencias = opciones.pruebas.any(
      (prueba) => prueba.esCiencias && borrador.pruebas.contains(prueba.id),
    );
    if (rindeCiencias && borrador.electivoId == null) {
      return 'Elige tu electivo de Ciencias: Biología, Física o Química.';
    }
    return null;
  }

  Future<void> _guardar(OpcionesPerfil opciones) async {
    final borrador = ref.read(borradorPerfilProvider);
    final problema = _problema(borrador, opciones);
    if (problema != null) {
      setState(() => errorGuardar = problema);
      return;
    }
    // Desde Perfil se vuelve a Perfil; en la bienvenida, a Inicio (CU-05
    // paso 7).
    await guardarYSeguir(
      () => ref.read(perfilProvider.notifier).guardar(borrador.datos(opciones)),
      borrador.modo == ModoPerfil.edicion ? Rutas.perfil : Rutas.inicio,
    );
  }

  @override
  Widget build(BuildContext context) {
    final borrador = ref.watch(borradorPerfilProvider);
    final notificador = ref.read(borradorPerfilProvider.notifier);
    return ConOpciones(
      builder: (opciones) {
        final elegidas = [for (final id in borrador.areas) ?opciones.area(id)];
        final ciencias = opciones.pruebas
            .where((prueba) => prueba.esCiencias)
            .firstOrNull;
        final rindeCiencias =
            ciencias != null && borrador.pruebas.contains(ciencias.id);
        return PantallaFormulario(
          separacion: 12,
          pie: PieConError(
            error: errorGuardar,
            boton: FilledButton(
              onPressed: guardando ? null : () => _guardar(opciones),
              child: guardando
                  ? const CargandoEnBoton()
                  : Text(
                      borrador.modo == ModoPerfil.edicion
                          ? 'Guardar cambios'
                          : 'Guardar y empezar',
                    ),
            ),
          ),
          hijos: [
            const EnlaceVolver(
              texto: 'Áreas de carrera',
              destino: Rutas.perfilAreas,
            ),
            const IndicadorPasos(paso: 3, total: 3),
            Encabezado(titulo: 'Tus pruebas', bajadaRica: _bajada(elegidas)),
            for (final prueba in opciones.pruebas)
              _TarjetaPrueba(
                prueba: prueba,
                elegidas: elegidas,
                marcada: borrador.pruebas.contains(prueba.id),
                onTap: () => notificador.alternarPrueba(prueba.id),
              ),
            if (rindeCiencias)
              _Electivo(
                ciencias: ciencias,
                elegidas: elegidas,
                electivoId: borrador.electivoId,
                onElegir: (id) {
                  notificador.elegirElectivo(id);
                  setState(() => errorGuardar = null);
                },
              ),
            _Reforzar(
              pruebas: [
                for (final prueba in opciones.pruebas)
                  if (borrador.pruebas.contains(prueba.id)) prueba,
              ],
              elegidaId: borrador.pruebaReforzarId,
              onElegir: notificador.elegirReforzar,
            ),
          ],
        );
      },
    );
  }

  /// «Marcamos las pruebas sugeridas para **Salud** y **Educación**.» Sin
  /// áreas, el estudiante elige directamente (CU-05 4.a).
  InlineSpan _bajada(List<AreaCarrera> elegidas) {
    if (elegidas.isEmpty) {
      return const TextSpan(text: 'Elige las pruebas que rendirás.');
    }
    const fuerte = TextStyle(fontWeight: FontWeight.w700);
    return TextSpan(
      children: [
        const TextSpan(text: 'Marcamos las pruebas sugeridas para '),
        for (final (i, area) in elegidas.indexed) ...[
          if (i > 0) TextSpan(text: i == elegidas.length - 1 ? ' y ' : ', '),
          TextSpan(text: area.nombre, style: fuerte),
        ],
        const TextSpan(text: '. Puedes cambiarlas.'),
      ],
    );
  }
}

/// Une nombres como en los bocetos: «Salud y Ciencias naturales».
String unirNombres(List<String> nombres) => nombres.length < 2
    ? nombres.join()
    : '${nombres.sublist(0, nombres.length - 1).join(', ')} y ${nombres.last}';

class _TarjetaPrueba extends StatelessWidget {
  const _TarjetaPrueba({
    required this.prueba,
    required this.elegidas,
    required this.marcada,
    required this.onTap,
  });

  final PruebaPerfil prueba;
  final List<AreaCarrera> elegidas;
  final bool marcada;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final sugerentes = [
      for (final area in elegidas)
        if (area.pruebasSugeridas.contains(prueba.id)) area.nombre,
    ];
    return TarjetaCasilla(
      titulo: prueba.nombre,
      marcada: marcada,
      onTap: onTap,
      detalle: sugerentes.isEmpty ? null : 'Por ${unirNombres(sugerentes)}',
      etiqueta: sugerentes.isEmpty ? null : 'Sugerida',
    );
  }
}

/// Título de una sección del paso, con una nota gris opcional al lado.
class _TituloSeccion extends StatelessWidget {
  const _TituloSeccion(this.titulo, {this.nota});

  final String titulo;
  final String? nota;

  @override
  Widget build(BuildContext context) {
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(text: titulo, style: TemaSuperaPaes.etiqueta),
          if (nota case final texto?)
            TextSpan(
              text: '  $texto',
              style: TemaSuperaPaes.pequeno.copyWith(
                color: TemaSuperaPaes.textoSecundario,
              ),
            ),
        ],
      ),
    );
  }
}

/// Electivo de Ciencias (HU-29 esc. 3, CU-05 6.a): Biología, Física o
/// Química, con la sugerencia de las áreas elegidas.
class _Electivo extends StatelessWidget {
  const _Electivo({
    required this.ciencias,
    required this.elegidas,
    required this.electivoId,
    required this.onElegir,
  });

  final PruebaPerfil ciencias;
  final List<AreaCarrera> elegidas;
  final int? electivoId;
  final ValueChanged<int> onElegir;

  @override
  Widget build(BuildContext context) {
    final sugerente = elegidas
        .where((area) => area.electivoSugeridoId != null)
        .firstOrNull;
    final sugerido = ciencias.electivos
        .where((electivo) => electivo.id == sugerente?.electivoSugeridoId)
        .firstOrNull;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _TituloSeccion(
          'Electivo de Ciencias',
          nota: 'Obligatorio si rindes Ciencias.',
        ),
        const SizedBox(height: 8),
        GrupoChips(
          chips: [
            for (final electivo in ciencias.electivos)
              ChipSeleccion(
                texto: electivo.nombre,
                seleccionado: electivo.id == electivoId,
                onTap: () => onElegir(electivo.id),
              ),
          ],
        ),
        if (sugerente != null && sugerido != null) ...[
          const SizedBox(height: 8),
          Text(
            '${sugerido.nombre} es la sugerida para ${sugerente.nombre}.',
            style: TemaSuperaPaes.pequeno.copyWith(
              color: TemaSuperaPaes.textoSecundario,
            ),
          ),
        ],
      ],
    );
  }
}

/// Prueba que quiere reforzar (HU-29 esc. 4): opcional, entre las elegidas.
class _Reforzar extends StatelessWidget {
  const _Reforzar({
    required this.pruebas,
    required this.elegidaId,
    required this.onElegir,
  });

  final List<PruebaPerfil> pruebas;
  final int? elegidaId;
  final ValueChanged<int?> onElegir;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _TituloSeccion('Prueba que quieres reforzar (opcional)'),
        const SizedBox(height: 8),
        Text(
          'La proponemos primero al practicar.',
          style: TemaSuperaPaes.pequeno.copyWith(
            color: TemaSuperaPaes.textoSecundario,
          ),
        ),
        const SizedBox(height: 8),
        GrupoChips(
          chips: [
            ChipSeleccion(
              texto: 'Ninguna',
              seleccionado: elegidaId == null,
              onTap: () => onElegir(null),
            ),
            for (final prueba in pruebas)
              ChipSeleccion(
                texto: prueba.nombreCorto,
                seleccionado: prueba.id == elegidaId,
                onTap: () => onElegir(prueba.id),
              ),
          ],
        ),
      ],
    );
  }
}
