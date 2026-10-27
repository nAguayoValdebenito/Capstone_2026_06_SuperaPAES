import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/perfil_estudio/borrador_perfil.dart';
import 'package:supera_paes/presentacion/perfil_estudio/con_opciones.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';

/// A09 · Perfil, paso 2: áreas de carrera, y A09b al intentar una cuarta
/// (HU-29 esc. 5 y 6, CU-05 pasos 4 y 5, 4.a y 4.b, RN-25). Es opcional.
class PantallaPasoAreas extends ConsumerStatefulWidget {
  const PantallaPasoAreas({super.key});

  @override
  ConsumerState<PantallaPasoAreas> createState() => _PantallaPasoAreasState();
}

class _PantallaPasoAreasState extends ConsumerState<PantallaPasoAreas> {
  /// Área que no se marcó por el tope de tres (A09b).
  String? _areaRechazada;

  void _alternar(int id, String nombre) {
    final aceptada = ref.read(borradorPerfilProvider.notifier).alternarArea(id);
    setState(() => _areaRechazada = aceptada ? null : nombre);
  }

  Future<void> _siguiente({bool omitir = false}) async {
    final notificador = ref.read(borradorPerfilProvider.notifier);
    if (omitir) notificador.omitirAreas();
    // Las opciones ya llegaron: esta pantalla se arma con ellas.
    final opciones = ref.read(opcionesPerfilProvider).value;
    if (opciones != null) notificador.aplicarSugerencias(opciones);
    setState(() => _areaRechazada = null);
    await context.push(Rutas.perfilPruebas);
  }

  @override
  Widget build(BuildContext context) {
    final borrador = ref.watch(borradorPerfilProvider);
    final gris = TemaSuperaPaes.pequeno.copyWith(
      color: TemaSuperaPaes.textoSecundario,
    );
    return ConOpciones(
      builder: (opciones) => PantallaFormulario(
        separacion: 14,
        pie: FilledButton(
          onPressed: _siguiente,
          child: const Text('Ver pruebas sugeridas'),
        ),
        hijos: [
          IndicadorPasos(
            paso: 2,
            total: 3,
            opcional: true,
            accion: TextButton(
              style: TextButton.styleFrom(
                padding: EdgeInsets.zero,
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              onPressed: () => _siguiente(omitir: true),
              child: const Text('Omitir'),
            ),
          ),
          const Encabezado(
            titulo: '¿Qué te gustaría estudiar?',
            bajada:
                'Marca hasta 3 áreas y te sugerimos qué pruebas rendir. Tú '
                'decides.',
          ),
          Row(
            children: [
              const Expanded(
                child: Text('Áreas de carrera', style: TemaSuperaPaes.etiqueta),
              ),
              Text(
                '${borrador.areas.length} de $maximoAreasCarrera',
                style: TemaSuperaPaes.pequenoFuerte.copyWith(
                  color: TemaSuperaPaes.primario,
                ),
              ),
            ],
          ),
          GrupoChips(
            chips: [
              for (final area in opciones.areasCarrera)
                ChipSeleccion(
                  texto: area.nombre,
                  seleccionado: borrador.areas.contains(area.id),
                  onTap: () => _alternar(area.id, area.nombre),
                ),
            ],
          ),
          if (_areaRechazada case final area?)
            Aviso(
              tono: TonoAviso.aviso,
              textoRico: TextSpan(
                children: [
                  const TextSpan(
                    text: 'Puedes marcar hasta 3 áreas. Para elegir ',
                  ),
                  TextSpan(
                    text: area,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const TextSpan(text: ', primero desmarca otra.'),
                ],
              ),
            )
          else
            Text(
              'Es una orientación general: cada universidad fija los '
              'requisitos de sus carreras.',
              style: gris,
            ),
        ],
      ),
    );
  }
}
