import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supera_paes/dominio/entidades/por_repasar.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/nucleo/tema.dart';
import 'package:supera_paes/presentacion/comunes/boton_principal.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/comunes/error_con_reintento.dart';
import 'package:supera_paes/presentacion/comunes/estados.dart';
import 'package:supera_paes/presentacion/comunes/sello_prueba.dart';
import 'package:supera_paes/presentacion/practicar/empezar_practica.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';

/// Repasar errores (A24; HU-39, RF-A15, CU-09): las preguntas cuya última
/// respuesta fue incorrecta u omitida, por prueba y eje. No usa cupo (RN-04).
/// Cada repaso es de una prueba, porque así se guarda cada evaluación: por eso
/// el filtro no tiene «Todas», como el boceto. El botón repasa la prueba y
/// cada fila, ese eje; después sigue como una práctica (A17 a A21).
class PantallaRepaso extends ConsumerStatefulWidget {
  const PantallaRepaso({super.key});

  @override
  ConsumerState<PantallaRepaso> createState() => _PantallaRepasoState();
}

class _PantallaRepasoState extends ConsumerState<PantallaRepaso>
    with EmpezarPractica {
  int? _pruebaId;

  Future<void> _actualizar() async {
    ref.invalidate(porRepasarProvider);
    await ref.read(porRepasarProvider.future);
  }

  @override
  Widget build(BuildContext context) {
    return ref
        .watch(porRepasarProvider)
        .when(
          data: (datos) => datos == null || datos.pruebas.isEmpty
              ? const _SinErrores()
              : _contenido(datos),
          loading: () => const PantallaFormulario(
            hijos: [SizedBox(height: 32), EsqueletoTarjeta(lineas: 4)],
          ),
          error: (error, _) => PantallaFormulario(
            hijos: [
              const SizedBox(height: 32),
              ErrorConReintento(
                error: error,
                mensaje: 'No pudimos cargar tus errores.',
                alReintentar: () => ref.invalidate(porRepasarProvider),
              ),
            ],
          ),
        );
  }

  Widget _contenido(PorRepasar datos) {
    final prueba = datos.pruebas.firstWhere(
      (prueba) => prueba.id == _pruebaId,
      orElse: () => datos.pruebas.first,
    );
    return PantallaFormulario(
      separacion: 14,
      alActualizar: _actualizar,
      hijos: [
        const EnlaceVolver(texto: 'Volver', destino: Rutas.practicar),
        const Encabezado(
          titulo: 'Repasar errores',
          bajada:
              'Si aciertas al repasar, la pregunta sale de tu lista. No usa '
              'tu cupo.',
        ),
        GrupoChips(
          chips: [
            for (final opcion in datos.pruebas)
              ChipSeleccion(
                texto: '${opcion.codigo} (${opcion.preguntas})',
                seleccionado: opcion.id == prueba.id,
                onTap: () => setState(() => _pruebaId = opcion.id),
              ),
          ],
        ),
        Tarjeta(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  SelloPrueba(Prueba.deCodigo(prueba.codigo)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(prueba.codigo, style: TemaSuperaPaes.h2),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              for (final eje in prueba.ejes)
                FilaNavegacion(
                  texto: eje.nombre,
                  detalle: eje.preguntas == 1
                      ? '1 pregunta'
                      : '${eje.preguntas} preguntas',
                  onTap: () =>
                      empezando ? null : empezarRepaso(prueba, eje: eje),
                ),
            ],
          ),
        ),
        if (datos.limite case final limite?)
          Aviso(
            tono: TonoAviso.info,
            textoRico: TextSpan(
              children: [
                TextSpan(
                  text:
                      'Con tu plan repasas tus $limite preguntas falladas más '
                      'recientes. Con ',
                ),
                const TextSpan(
                  text: 'Todas las pruebas',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                const TextSpan(text: ' las repasas todas.'),
              ],
            ),
          ),
      ],
      pie: PieConError(
        error: errorEmpezar,
        boton: BotonPrincipal(
          texto: _textoBoton(prueba),
          estado: empezando ? EstadoBoton.cargando : EstadoBoton.normal,
          onPressed: () => empezarRepaso(prueba),
        ),
      ),
    );
  }

  /// «Repasar las 5», o «Repasar 10 de 14» si hay más de las que trae un
  /// repaso.
  static String _textoBoton(PruebaPorRepasar prueba) =>
      switch (prueba.preguntas) {
        1 => 'Repasar la pregunta',
        final preguntas when preguntas > prueba.delRepaso =>
          'Repasar ${prueba.delRepaso} de $preguntas',
        final preguntas => 'Repasar las $preguntas',
      };
}

class _SinErrores extends StatelessWidget {
  const _SinErrores();

  @override
  Widget build(BuildContext context) {
    return PantallaFormulario(
      hijos: [
        const EnlaceVolver(texto: 'Volver', destino: Rutas.practicar),
        const SizedBox(height: 32),
        EstadoVacio(
          titulo: 'No tienes errores por repasar',
          texto:
              'Las preguntas que falles en una práctica o una evaluación '
              'aparecerán aquí.',
          accion: 'Ir a practicar',
          alTocar: () => context.go(Rutas.practicar),
        ),
      ],
    );
  }
}
