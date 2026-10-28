import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:supera_paes/dominio/entidades/practica.dart';
import 'package:supera_paes/nucleo/constantes.dart';
import 'package:supera_paes/presentacion/comunes/componentes.dart';
import 'package:supera_paes/presentacion/comunes/componentes_seleccion.dart';
import 'package:supera_paes/presentacion/perfil_estudio/estado_perfil.dart';
import 'package:supera_paes/presentacion/practicar/empezar_practica.dart';
import 'package:supera_paes/presentacion/practicar/estado_practica.dart';

/// No hay suficientes preguntas para lo elegido (A15; HU-30 esc. 4, CU-06
/// alternativo 4.a). Propone lo que la API dice que sí alcanza: la mezcla de
/// dificultad o toda la prueba, y siempre volver a elegir.
class PantallaSinPreguntas extends ConsumerStatefulWidget {
  const PantallaSinPreguntas({super.key});

  @override
  ConsumerState<PantallaSinPreguntas> createState() =>
      _PantallaSinPreguntasState();
}

class _PantallaSinPreguntasState extends ConsumerState<PantallaSinPreguntas>
    with EmpezarPractica {
  @override
  bool get esAvisoSinPreguntas => true;

  /// Usa lo que se eligió en A13 para la próxima vez y empieza.
  Future<void> _empezarCon(DatosPractica datos) async {
    ref.read(borradorPracticaProvider.notifier).usar(datos);
    await empezar(datos);
  }

  void _elegirOtraCosa() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(Rutas.practicar);
    }
  }

  @override
  Widget build(BuildContext context) {
    final aviso = ref.watch(practicaProvider).sinPreguntas;
    final nombres = ref.watch(opcionesPerfilProvider).value;
    final dificultades =
        ref.watch(opcionesPracticaProvider).value?.dificultades ?? const [];
    final prueba = aviso == null
        ? null
        : nombres?.prueba(aviso.datos.pruebaId)?.nombreEnInicio;
    return PantallaFormulario(
      hijos: [
        const EnlaceVolver(
          texto: 'Personaliza tu práctica',
          destino: Rutas.practicar,
        ),
        Encabezado(
          titulo: 'No hay suficientes preguntas',
          bajadaRica: aviso == null
              ? null
              : _explicacion(aviso, prueba, dificultades),
          bajada: aviso == null ? 'Vuelve a elegir qué practicar.' : null,
        ),
        ListaDeFilas(
          filas: [
            if (aviso case final aviso? when aviso.usarMezcla)
              FilaNavegacion(
                texto: 'Usar la mezcla de dificultad',
                onTap: empezando
                    ? () {}
                    : () => _empezarCon(_conMezcla(aviso.datos)),
              ),
            if (aviso case final aviso? when aviso.ampliarAlcance)
              FilaNavegacion(
                texto: ['Practicar toda la prueba', ?prueba].join(' '),
                onTap: empezando
                    ? () {}
                    : () => _empezarCon(_todaLaPrueba(aviso.datos)),
              ),
            FilaNavegacion(texto: 'Elegir otra cosa', onTap: _elegirOtraCosa),
          ],
        ),
        if (empezando) const Center(child: CircularProgressIndicator()),
        if (errorEmpezar case final error?)
          Aviso(tono: TonoAviso.error, texto: error),
      ],
    );
  }

  /// «Por ahora no hay 10 preguntas difíciles de **Logaritmos** para ti.»
  static InlineSpan _explicacion(
    SinPreguntas aviso,
    String? prueba,
    List<Dificultad> dificultades,
  ) {
    final datos = aviso.datos;
    final alcance = datos.alcance.nombre ?? prueba ?? 'esta prueba';
    final dificultad = [
      for (final d in dificultades)
        if (d.id == datos.dificultadId) _plural(d),
    ].firstOrNull;
    return TextSpan(
      children: [
        TextSpan(
          text:
              'Por ahora no hay ${datos.cantidad} preguntas'
              '${dificultad == null ? '' : ' $dificultad'} de ',
        ),
        TextSpan(
          text: alcance,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        TextSpan(
          text: aviso.disponibles > 0
              ? ' para ti (hay ${aviso.disponibles}). Puedes cambiar lo que '
                    'elegiste:'
              : ' para ti. Puedes cambiar lo que elegiste:',
        ),
      ],
    );
  }

  /// «difíciles», «fáciles» o «de dificultad media».
  static String _plural(Dificultad dificultad) => switch (dificultad.codigo) {
    'facil' => 'fáciles',
    'dificil' => 'difíciles',
    _ => 'de dificultad ${dificultad.nombre.toLowerCase()}',
  };

  static DatosPractica _conMezcla(DatosPractica datos) => DatosPractica(
    pruebaId: datos.pruebaId,
    alcance: datos.alcance,
    dificultadId: null,
    cantidad: datos.cantidad,
  );

  static DatosPractica _todaLaPrueba(DatosPractica datos) => DatosPractica(
    pruebaId: datos.pruebaId,
    alcance: Alcance.todaLaPrueba,
    dificultadId: datos.dificultadId,
    cantidad: datos.cantidad,
  );
}
